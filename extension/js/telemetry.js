/**
 * Netflix Connect - Telemetry Module
 * Handles sending playback state to the server
 */

const ncTelemetry = {
  started: false,
  tickCallback: null,
  
  // Send telemetry payload using shared POST helper
  async push(extra = {}) {
    const video = ncGetVideo();
    if (!video) return;

    const p = ncDescribeVideo(video);
    const playing = ncIsPlaying(video);
    const payload = {
      user: ncUser.current,
      time: new Date().toISOString(),
      id: p.sourceId || 'unknown',
      url: p.sourceUrl || window.location?.href || '',
      rate: p.playbackRate ?? 1,
      paused: !playing,
      position_s: Number.isFinite(p.currentTimeS) ? p.currentTimeS : 0,
      position_ms: Number.isFinite(p.currentTimeS) ? Math.round(p.currentTimeS * 1000) : null,
      ready_state: p.readyState ?? -1,
      network: ncNetworkStateLabel(p.networkState),
      frames: p.frames != null ? Number(p.frames) : 0,
      dropped: p.dropped ?? 0,
      ...extra,
    };

    try {
      await ncPost(NC_CONFIG.ENDPOINTS.TELEMETRY, payload);
    } catch (e) {
      // Ignore network errors
    }
  },
  
  // Start the telemetry loop using unified ticker
  start() {
    if (this.started) return;
    this.started = true;
    
    this.push();
    this.tickCallback = () => this.push();
    ncTicker.onSlowTick(this.tickCallback);
    console.log('[Netflix Connect] Telemetry started');
  },
  
  stop() {
    if (this.tickCallback) {
      ncTicker.off(this.tickCallback);
      this.tickCallback = null;
    }
    this.started = false;
  }
};

// Debounced telemetry pushers
const ncDebouncedPush = {
  // Slow debounce for spammy actions (arrow keys, seeking) - 400ms
  _slowTimer: null,
  _slowLastAction: null,
  
  slow(action) {
    this._slowLastAction = action;
    if (this._slowTimer) clearTimeout(this._slowTimer);
    this._slowTimer = setTimeout(() => {
      this._slowTimer = null;
      const actionToSend = this._slowLastAction;
      this._slowLastAction = null;
      ncDeferredCall(() => ncTelemetry.push({ action: actionToSend }));
    }, NC_CONFIG.SLOW_DEBOUNCE_MS);
  },
  
  // Fast debounce for normal interactions - 100ms
  _fastTimer: null,
  
  fast(action) {
    if (this._fastTimer) clearTimeout(this._fastTimer);
    this._fastTimer = setTimeout(() => {
      this._fastTimer = null;
      ncDeferredCall(() => ncTelemetry.push(action ? { action } : {}));
    }, NC_CONFIG.FAST_DEBOUNCE_MS);
  },
  
  // Throttled push for skip buttons - max once per 300ms
  // Now uses push with action instead of removed pushAction
  _throttled: null,
  
  throttledSkip(action) {
    if (!this._throttled) {
      this._throttled = ncThrottle((a) => {
        ncDeferredCall(() => ncTelemetry.push({ action: a }));
      }, NC_CONFIG.THROTTLE_MS);
    }
    this._throttled(action);
  }
};
