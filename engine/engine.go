// Package mtorrent is M's built-in torrent streaming engine (anacrolix/torrent).
// It serves torrent files over a local HTTP server so the normal video player can play them:
//   http://127.0.0.1:<port>/stream/<infohash>/<fileIdx>
// Built with gomobile for iOS (xcframework) and Android (aar).
package mtorrent

import (
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/anacrolix/torrent"
	"github.com/anacrolix/torrent/metainfo"
	"github.com/anacrolix/torrent/storage"
	"golang.org/x/time/rate"
)

var (
	mu      sync.Mutex
	client  *torrent.Client
	srv     *http.Server
	port    int
	dataDir string
	lastUse = map[string]time.Time{}
)

// Start launches the engine. uploadKBps <= 0 disables uploading beyond the protocol minimum.
// Returns the local HTTP port.
func Start(dir string, uploadKBps int) (int, error) {
	mu.Lock()
	defer mu.Unlock()
	if client != nil {
		return port, nil
	}
	dataDir = dir
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return 0, err
	}
	cfg := torrent.NewDefaultClientConfig()
	cfg.DefaultStorage = storage.NewFileByInfoHash(dir)
	cfg.Seed = false
	cfg.NoUpload = false
	cfg.ListenPort = 0
	cfg.DisableIPv6 = false
	cfg.EstablishedConnsPerTorrent = 40
	if uploadKBps <= 0 {
		uploadKBps = 16
	}
	cfg.UploadRateLimiter = rate.NewLimiter(rate.Limit(uploadKBps*1024), 256*1024)
	c, err := torrent.NewClient(cfg)
	if err != nil {
		return 0, err
	}
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		c.Close()
		return 0, err
	}
	client = c
	port = ln.Addr().(*net.TCPAddr).Port
	mux := http.NewServeMux()
	mux.HandleFunc("/stream/", serveStream)
	srv = &http.Server{Handler: mux}
	go srv.Serve(ln)
	return port, nil
}

type fileInfo struct {
	Index  int    `json:"index"`
	Path   string `json:"path"`
	Length int64  `json:"length"`
}

type addResult struct {
	InfoHash string     `json:"infoHash"`
	Name     string     `json:"name"`
	Files    []fileInfo `json:"files"`
}

// Add adds a magnet link (or bare info-hash) and waits up to timeoutSec for metadata.
// Returns JSON: {infoHash, name, files:[{index,path,length}]}.
func Add(magnetOrHash string, timeoutSec int) (string, error) {
	mu.Lock()
	c := client
	mu.Unlock()
	if c == nil {
		return "", errors.New("engine not started")
	}
	m := strings.TrimSpace(magnetOrHash)
	if !strings.HasPrefix(strings.ToLower(m), "magnet:") {
		m = "magnet:?xt=urn:btih:" + m
	}
	t, err := c.AddMagnet(m)
	if err != nil {
		return "", err
	}
	if timeoutSec <= 0 {
		timeoutSec = 60
	}
	select {
	case <-t.GotInfo():
	case <-time.After(time.Duration(timeoutSec) * time.Second):
		return "", errors.New("timeout: no metadata (no peers?)")
	}
	ih := t.InfoHash().HexString()
	mu.Lock()
	lastUse[ih] = time.Now()
	mu.Unlock()
	res := addResult{InfoHash: ih, Name: t.Name()}
	for i, f := range t.Files() {
		res.Files = append(res.Files, fileInfo{Index: i, Path: f.DisplayPath(), Length: f.Length()})
	}
	b, _ := json.Marshal(res)
	return string(b), nil
}

func serveStream(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/stream/"), "/")
	if len(parts) < 2 {
		http.Error(w, "bad path", 400)
		return
	}
	var h metainfo.Hash
	if err := h.FromHexString(parts[0]); err != nil {
		http.Error(w, "bad hash", 400)
		return
	}
	idx, err := strconv.Atoi(parts[1])
	if err != nil {
		http.Error(w, "bad index", 400)
		return
	}
	mu.Lock()
	c := client
	lastUse[h.HexString()] = time.Now()
	mu.Unlock()
	if c == nil {
		http.Error(w, "stopped", 503)
		return
	}
	t, ok := c.Torrent(h)
	if !ok {
		http.Error(w, "unknown torrent", 404)
		return
	}
	select {
	case <-t.GotInfo():
	case <-r.Context().Done():
		return
	}
	files := t.Files()
	if idx < 0 || idx >= len(files) {
		http.Error(w, "bad index", 404)
		return
	}
	f := files[idx]
	rd := f.NewReader()
	defer rd.Close()
	rd.SetReadahead(32 << 20)
	rd.SetResponsive()
	rd.SetContext(r.Context())
	w.Header().Set("Content-Type", mimeOf(f.DisplayPath()))
	http.ServeContent(w, r, filepath.Base(f.DisplayPath()), time.Time{}, rd)
}

func mimeOf(p string) string {
	switch strings.ToLower(filepath.Ext(p)) {
	case ".mp4", ".m4v":
		return "video/mp4"
	case ".mkv":
		return "video/x-matroska"
	case ".webm":
		return "video/webm"
	case ".mov":
		return "video/quicktime"
	case ".avi":
		return "video/x-msvideo"
	case ".ts":
		return "video/mp2t"
	}
	return "application/octet-stream"
}

// Stats returns JSON {peers, seeds, down, up, completed, length} for a torrent.
func Stats(infoHash string) string {
	mu.Lock()
	c := client
	mu.Unlock()
	var h metainfo.Hash
	if c == nil || h.FromHexString(infoHash) != nil {
		return "{}"
	}
	t, ok := c.Torrent(h)
	if !ok {
		return "{}"
	}
	s := t.Stats()
	var length int64
	if t.Info() != nil {
		length = t.Length()
	}
	b, _ := json.Marshal(map[string]any{
		"peers": s.ActivePeers, "seeds": s.ConnectedSeeders,
		"down": s.BytesReadUsefulData.Int64(), "up": s.BytesWrittenData.Int64(),
		"completed": t.BytesCompleted(), "length": length,
	})
	return string(b)
}

// Drop removes a torrent from the engine (stops downloading and sharing it).
func Drop(infoHash string) {
	mu.Lock()
	defer mu.Unlock()
	var h metainfo.Hash
	if client == nil || h.FromHexString(infoHash) != nil {
		return
	}
	if t, ok := client.Torrent(h); ok {
		t.Drop()
	}
	delete(lastUse, infoHash)
}

// DropAll removes every torrent (called when playback ends).
func DropAll() {
	mu.Lock()
	defer mu.Unlock()
	if client == nil {
		return
	}
	for _, t := range client.Torrents() {
		t.Drop()
	}
	lastUse = map[string]time.Time{}
}

// Stop shuts the engine down.
func Stop() {
	mu.Lock()
	defer mu.Unlock()
	if srv != nil {
		srv.Close()
		srv = nil
	}
	if client != nil {
		client.Close()
		client = nil
	}
}

// CacheSize returns the bytes used by the cache directory.
func CacheSize() int64 {
	var n int64
	filepath.Walk(dataDir, func(_ string, fi os.FileInfo, err error) error {
		if err == nil && !fi.IsDir() {
			n += fi.Size()
		}
		return nil
	})
	return n
}

// TrimCache deletes the oldest torrent folders until the cache is under maxMB.
// Torrents currently loaded in the engine are kept. maxMB <= 0 clears everything not in use.
func TrimCache(maxMB int) string {
	mu.Lock()
	active := map[string]bool{}
	if client != nil {
		for _, t := range client.Torrents() {
			active[t.InfoHash().HexString()] = true
		}
	}
	dir := dataDir
	mu.Unlock()
	entries, err := os.ReadDir(dir)
	if err != nil {
		return err.Error()
	}
	type item struct {
		path string
		size int64
		mod  time.Time
	}
	var items []item
	var total int64
	for _, e := range entries {
		if !e.IsDir() || active[e.Name()] {
			continue
		}
		p := filepath.Join(dir, e.Name())
		var sz int64
		filepath.Walk(p, func(_ string, fi os.FileInfo, err error) error {
			if err == nil && !fi.IsDir() {
				sz += fi.Size()
			}
			return nil
		})
		info, _ := e.Info()
		items = append(items, item{p, sz, info.ModTime()})
		total += sz
	}
	sort.Slice(items, func(i, j int) bool { return items[i].mod.Before(items[j].mod) })
	limit := int64(maxMB) << 20
	removed := 0
	for _, it := range items {
		if total <= limit {
			break
		}
		os.RemoveAll(it.path)
		total -= it.size
		removed++
	}
	return fmt.Sprintf("removed %d", removed)
}

// AddTorrentFile adds a .torrent file from disk (used for tests and local files). Returns the same JSON as Add.
func AddTorrentFile(path string) (string, error) {
	mu.Lock()
	c := client
	mu.Unlock()
	if c == nil {
		return "", errors.New("engine not started")
	}
	t, err := c.AddTorrentFromFile(path)
	if err != nil {
		return "", err
	}
	<-t.GotInfo()
	return Add(t.InfoHash().HexString(), 5)
}

// AddTorrentURL downloads a .torrent file over HTTP(S) and adds it (diagnostics: works even before peers are found,
// since the metadata comes from the file and data can come from web seeds). Returns the same JSON as Add.
func AddTorrentURL(url string) (string, error) {
	mu.Lock()
	c := client
	mu.Unlock()
	if c == nil {
		return "", errors.New("engine not started")
	}
	hc := &http.Client{Timeout: 30 * time.Second}
	resp, err := hc.Get(url)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	mi, err := metainfo.Load(resp.Body)
	if err != nil {
		return "", err
	}
	t, err := c.AddTorrent(mi)
	if err != nil {
		return "", err
	}
	<-t.GotInfo()
	return Add(t.InfoHash().HexString(), 5)
}
