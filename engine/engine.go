// Package mtorrent is M's built-in torrent streaming engine (anacrolix/torrent).
// It serves torrent files over a local HTTP server so the normal video player can play them:
//
//	http://127.0.0.1:<port>/stream/<infohash>/<fileIdx>
//
// Built with gomobile for iOS (xcframework) and Android (aar).
package mtorrent

import (
	crand "crypto/rand"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/anacrolix/dht/v2"
	"net"
	"net/http"
	"net/url"
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
	// Random per-session secret required in every stream URL, so other apps on the device can't use the server.
	token    string
	saveStop chan struct{}
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
	cfg.ListenPort = stablePort(dir)
	cfg.PeerID = stablePeerID(dir)
	cfg.DisableIPv6 = false
	cfg.DisableUTP = false
	cfg.DisableTCP = false
	cfg.DisablePEX = false
	cfg.EstablishedConnsPerTorrent = 40
	if uploadKBps <= 0 {
		uploadKBps = 16
	}
	cfg.UploadRateLimiter = rate.NewLimiter(rate.Limit(uploadKBps*1024), 256*1024)
	c, err := torrent.NewClient(cfg)
	if err != nil && cfg.ListenPort != 0 {
		// saved port busy: fall back to any port
		cfg.ListenPort = 0
		c, err = torrent.NewClient(cfg)
	}
	if err != nil {
		return 0, err
	}
	// Warm DHT: reuse the routing table saved last session, then keep saving it.
	nodesFile := filepath.Join(dir, ".dht-nodes")
	for _, d := range c.DhtServers() {
		if w, ok := d.(torrent.AnacrolixDhtServerWrapper); ok {
			w.Server.AddNodesFromFile(nodesFile) // the client bootstraps on its own
		}
	}
	stopSave := make(chan struct{})
	saveStop = stopSave
	go func() {
		tk := time.NewTicker(45 * time.Second)
		defer tk.Stop()
		for {
			select {
			case <-tk.C:
				saveNodes(c, nodesFile)
			case <-stopSave:
				return
			}
		}
	}()
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		c.Close()
		return 0, err
	}
	client = c
	port = ln.Addr().(*net.TCPAddr).Port
	tb := make([]byte, 16)
	if _, err := crand.Read(tb); err != nil {
		c.Close()
		ln.Close()
		return 0, err
	}
	token = hex.EncodeToString(tb)
	mux := http.NewServeMux()
	mux.HandleFunc("/stream/", serveStream)
	srv = &http.Server{Handler: mux, ReadHeaderTimeout: 10 * time.Second}
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
	t, err := c.AddMagnet(withTrackers(m))
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

// Token returns the per-session secret that stream URLs must include ("" before Start).
func Token() string {
	mu.Lock()
	defer mu.Unlock()
	return token
}

func serveStream(w http.ResponseWriter, r *http.Request) {
	// /stream/<token>/<infohash>/<fileIndex>[/<name.ext>]
	all := strings.Split(strings.TrimPrefix(r.URL.Path, "/stream/"), "/")
	mu.Lock()
	tok := token
	mu.Unlock()
	if len(all) < 3 || tok == "" || subtle.ConstantTimeCompare([]byte(all[0]), []byte(tok)) != 1 {
		http.Error(w, "forbidden", 403)
		return
	}
	parts := all[1:]
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
		"known": s.TotalPeers, "pending": s.PendingPeers, "halfOpen": s.HalfOpenPeers,
		"hasInfo": t.Info() != nil, "dht": DhtNodes(),
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
	if saveStop != nil {
		close(saveStop)
		saveStop = nil
	}
	if client != nil {
		saveNodes(client, filepath.Join(dataDir, ".dht-nodes"))
		client.Close()
		client = nil
		token = ""
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

// Well-known public trackers appended to every magnet (helps the first metadata fetch a lot).
var defaultTrackers = []string{
	"udp://tracker.opentrackr.org:1337/announce",
	"udp://open.stealth.si:80/announce",
	"udp://tracker.torrent.eu.org:451/announce",
	"udp://exodus.desync.com:6969/announce",
	"udp://open.demonii.com:1337/announce",
	"udp://explodie.org:6969/announce",
	"udp://tracker.openbittorrent.com:6969/announce",
	"https://tracker.tamersunion.org:443/announce",
	"http://tracker.opentrackr.org:1337/announce",
}

func saveNodes(c *torrent.Client, file string) {
	for _, d := range c.DhtServers() {
		if w, ok := d.(torrent.AnacrolixDhtServerWrapper); ok {
			if ns := w.Server.Nodes(); len(ns) > 20 {
				dht.WriteNodesToFile(ns, file)
			}
		}
	}
}

// stablePort keeps the same listen port across sessions (peers and DHT nodes remember us).
func stablePort(dir string) int {
	f := filepath.Join(dir, ".port")
	if b, err := os.ReadFile(f); err == nil {
		if p, err := strconv.Atoi(strings.TrimSpace(string(b))); err == nil && p > 1024 && p < 65535 {
			return p
		}
	}
	var b [2]byte
	crand.Read(b[:])
	p := 42000 + (int(b[0])<<8|int(b[1]))%20000
	os.WriteFile(f, []byte(strconv.Itoa(p)), 0o644)
	return p
}

// stablePeerID keeps the same 20-byte peer ID across sessions.
func stablePeerID(dir string) string {
	f := filepath.Join(dir, ".peerid")
	if b, err := os.ReadFile(f); err == nil && len(b) == 20 {
		return string(b)
	}
	id := make([]byte, 20)
	copy(id, "-MA0140-")
	crand.Read(id[8:])
	for i := 8; i < 20; i++ {
		id[i] = "0123456789abcdefghijklmnopqrstuvwxyz"[int(id[i])%36]
	}
	os.WriteFile(f, id, 0o644)
	return string(id)
}

func withTrackers(m string) string {
	low := strings.ToLower(m)
	for _, tr := range defaultTrackers {
		if !strings.Contains(low, strings.ToLower(url.QueryEscape(tr))) && !strings.Contains(low, strings.ToLower(tr)) {
			m += "&tr=" + url.QueryEscape(tr)
		}
	}
	return m
}

// AddAsync adds a magnet without waiting. Returns the info-hash; poll Info() for the file list.
// Re-adding an existing torrent is instant (it is kept after failures so a retry is fast).
func AddAsync(magnetOrHash string) (string, error) {
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
	t, err := c.AddMagnet(withTrackers(m))
	if err != nil {
		return "", err
	}
	ih := t.InfoHash().HexString()
	mu.Lock()
	lastUse[ih] = time.Now()
	mu.Unlock()
	return ih, nil
}

// Info returns the file list JSON once metadata is known, or "" while still fetching.
func Info(infoHash string) string {
	mu.Lock()
	c := client
	mu.Unlock()
	var h metainfo.Hash
	if c == nil || h.FromHexString(infoHash) != nil {
		return ""
	}
	t, ok := c.Torrent(h)
	if !ok || t.Info() == nil {
		return ""
	}
	res := addResult{InfoHash: t.InfoHash().HexString(), Name: t.Name()}
	for i, f := range t.Files() {
		res.Files = append(res.Files, fileInfo{Index: i, Path: f.DisplayPath(), Length: f.Length()})
	}
	b, _ := json.Marshal(res)
	return string(b)
}

// DhtNodes reports the number of good DHT nodes (warm-up progress).
func DhtNodes() int {
	mu.Lock()
	c := client
	mu.Unlock()
	n := 0
	if c == nil {
		return 0
	}
	for _, d := range c.DhtServers() {
		if w, ok := d.(torrent.AnacrolixDhtServerWrapper); ok {
			n += w.Server.Stats().GoodNodes
		}
	}
	return n
}
