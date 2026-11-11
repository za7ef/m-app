import React, { forwardRef } from 'react';
import { requireOptionalNativeModule, requireNativeView } from 'expo-modules-core';

// libVLC video view (iOS). Null on platforms/builds without it.
const mod = requireOptionalNativeModule('MVlc');
// iOS: true when MobileVLCKit is embedded (it is only dlopen'ed on first use).
export const vlcAvailable = !!mod && mod.embedded !== false;
export const loadVlc = async () => (mod?.load ? mod.load() : null);
const Native = mod ? requireNativeView('MVlc') : null;

export const VlcView = forwardRef((props, ref) => (Native ? <Native ref={ref} {...props} /> : null));

// Minimal event emitter compatible with expo's useEvent (addListener → { remove }).
export class VlcPlayer {
  constructor() {
    this.ls = {}; this.view = null;
    this.playing = false; this.status = 'idle'; this.duration = 0; this._time = 0; this._rate = 1;
    this.src = null; this.paused = false;
    this.tracks = { audio: [], subtitles: [], audioId: -1, subtitleId: -1 };
    this.onChange = null; // set by the screen to re-render props
  }
  addListener(ev, fn) { (this.ls[ev] = this.ls[ev] || new Set()).add(fn); return { remove: () => this.ls[ev].delete(fn) }; }
  emit(ev, p) { (this.ls[ev] || []).forEach((f) => f(p)); }
  _set(k, v) { this[k] = v; this.onChange && this.onChange(); }
  get currentTime() { return this._time; }
  set currentTime(v) { this._time = v; this.view?.seek(v); }
  get playbackRate() { return this._rate; }
  set playbackRate(v) { this._set('_rate', v); }
  seekBy(d) { this.currentTime = Math.max(0, Math.min(this.duration || 1e9, this._time + d)); }
  play() { this._set('paused', false); }
  pause() { this._set('paused', true); }
  replace(src) { this._time = 0; this._set('src', src); }
  // native event handlers
  handleStatus = (e) => { const p = e.nativeEvent; this.status = p.status; this.emit('statusChange', { status: p.status, error: p.error ? { message: p.error } : null }); if (p.ended) this.emit('playToEnd', {}); };
  handleTime = (e) => { const p = e.nativeEvent; this._time = p.currentTime; this.duration = p.duration; this.emit('timeUpdate', { currentTime: p.currentTime, bufferedPosition: 0 }); };
  handlePlaying = (e) => { this.playing = e.nativeEvent.isPlaying; this.emit('playingChange', { isPlaying: this.playing }); };
  handleTracks = (e) => { this.tracks = e.nativeEvent; this.emit('tracksChange', this.tracks); };
}
