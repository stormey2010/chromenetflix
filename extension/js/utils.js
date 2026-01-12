/**
 * Netflix Connect - Utilities
 * Helper functions used across the extension
 */

// Get the video element
function ncGetVideo() {
  return document.querySelector('video');
}

// Check if video is playing
function ncIsPlaying(video) {
  return !video.paused && !video.ended && video.playbackRate > 0 && video.readyState >= 2;
}

// Network state label mapper
function ncNetworkStateLabel(state) {
  switch (state) {
    case 0: return 'NETWORK_EMPTY';
    case 1: return 'NETWORK_IDLE';
    case 2: return 'NETWORK_LOADING';
    case 3: return 'NETWORK_NO_SOURCE';
    default: return 'UNKNOWN';
  }
}

// Read video quality info
function ncReadQuality(video) {
  let frames = null;
  let dropped = null;
  try {
    if (typeof video.getVideoPlaybackQuality === 'function') {
      const q = video.getVideoPlaybackQuality();
      if (q) {
        frames = Number.isFinite(q.totalVideoFrames) ? q.totalVideoFrames : null;
        dropped = Number.isFinite(q.droppedVideoFrames) ? q.droppedVideoFrames : null;
      }
    } else {
      const total = video.webkitDecodedFrameCount;
      const drop = video.webkitDroppedFrameCount;
      frames = Number.isFinite(total) ? total : null;
      dropped = Number.isFinite(drop) ? drop : null;
    }
  } catch {}
  return { frames, dropped };
}

// Extract source ID from URL
function ncExtractSourceId(url) {
  if (!url) return null;
  let candidate = url;
  if (candidate.startsWith('blob:')) candidate = candidate.slice(5);
  try {
    const u = new URL(candidate);
    const pathParts = u.pathname.split('/').filter(Boolean);
    if (pathParts.length > 0) return pathParts[pathParts.length - 1];
  } catch {}
  const parts = candidate.split('/').filter(Boolean);
  if (parts.length > 0) return parts[parts.length - 1];
  return null;
}

// Get comprehensive video description
function ncDescribeVideo(video) {
  const { frames, dropped } = ncReadQuality(video);
  const pageUrl = window.location?.href || null;
  const cleanPageUrl = pageUrl ? pageUrl.split('?')[0] : null;
  const sourceId = ncExtractSourceId(cleanPageUrl);

  return {
    currentTimeS: Number.isFinite(video.currentTime) ? video.currentTime : null,
    durationS: Number.isFinite(video.duration) ? video.duration : null,
    playbackRate: Number.isFinite(video.playbackRate) ? video.playbackRate : null,
    volume: Number.isFinite(video.volume) ? video.volume : null,
    muted: !!video.muted,
    ended: !!video.ended,
    seeking: !!video.seeking,
    readyState: video.readyState,
    networkState: video.networkState,
    frames: frames != null ? String(frames) : null,
    dropped,
    sourceId,
    sourceUrl: cleanPageUrl,
  };
}

// Throttle helper - fires immediately, then ignores calls for `ms` duration
function ncThrottle(fn, ms) {
  let lastCall = 0;
  return function (...args) {
    const now = Date.now();
    if (now - lastCall >= ms) {
      lastCall = now;
      fn.apply(this, args);
    }
  };
}

// Deferred API call - schedules work when browser is idle
function ncDeferredCall(fn) {
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(() => fn(), { timeout: 500 });
  } else {
    setTimeout(fn, 0);
  }
}

// Page type detection
function ncGetPageType() {
  const url = window.location.href;
  if (url.includes('/watch/')) return 'watch';
  if (url.includes('/title/')) return 'browse';
  if (url.includes('/browse')) return 'browse';
  if (url.includes('/search')) return 'search';
  return 'other';
}

// Extract watch ID from URL
function ncGetWatchId() {
  const url = window.location.href;
  if (url.includes('/watch/')) {
    try {
      return url.split('/watch/')[1].split('?')[0].split('/')[0];
    } catch {
      return null;
    }
  }
  return null;
}

// === Shared Network Utilities ===

// Shared POST helper - eliminates duplicate fetch patterns
async function ncPost(endpoint, data) {
  const apiKey = (typeof NC_CONFIG !== 'undefined' && NC_CONFIG.API_KEY) ? NC_CONFIG.API_KEY : 'changeme-supersecret-key';
  const headers = {
    'Content-Type': 'application/json',
    'X-API-Key': apiKey,
  };

  // Also include the key in the body (for servers that ignore custom headers)
  const body = { api_key: apiKey, ...data };

  // Append api_key as a query param for extra redundancy (covers proxies stripping headers)
  const url = new URL(endpoint);
  if (!url.searchParams.get('api_key')) {
    url.searchParams.set('api_key', apiKey);
  }

  const response = await fetch(url.toString(), {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  return response.json();
}

// Shared SSE factory with automatic retry logic
function ncCreateSSE(url, onMessage, options = {}) {
  const state = {
    source: null,
    retryMs: NC_CONFIG.INITIAL_RETRY_MS,
    stopped: false,
  };
  
  function connect() {
    if (state.stopped) return;
    if (state.source) {
      state.source.close();
      state.source = null;
    }

    // Add api_key to SSE URL to avoid header dependency
    const apiKey = (typeof NC_CONFIG !== 'undefined' && NC_CONFIG.API_KEY) ? NC_CONFIG.API_KEY : null;
    const fullUrl = (() => {
      if (!apiKey) return url;
      try {
        const u = new URL(url);
        if (!u.searchParams.get('api_key')) {
          u.searchParams.set('api_key', apiKey);
        }
        return u.toString();
      } catch (_) {
        return url;
      }
    })();

    const es = new EventSource(fullUrl);
    state.source = es;
    
    es.onopen = () => {
      state.retryMs = NC_CONFIG.INITIAL_RETRY_MS;
      if (options.onOpen) options.onOpen();
    };
    
    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data || '{}');
        onMessage(data);
      } catch (_) {}
    };
    
    es.onerror = () => {
      es.close();
      state.source = null;
      if (state.stopped) return;
      const delay = Math.min(state.retryMs, NC_CONFIG.MAX_RETRY_MS);
      state.retryMs = Math.min(state.retryMs * 2, NC_CONFIG.MAX_RETRY_MS);
      setTimeout(connect, delay);
    };
  }
  
  return {
    start: connect,
    stop: () => {
      state.stopped = true;
      if (state.source) {
        state.source.close();
        state.source = null;
      }
    },
    restart: () => {
      state.stopped = false;
      connect();
    },
    isConnected: () => state.source?.readyState === EventSource.OPEN,
  };
}

// === Unified Ticker System ===
// Consolidates multiple intervals into two ticks: fast (300ms) and slow (2000ms)

const ncTicker = {
  fastCallbacks: [],
  slowCallbacks: [],
  fastIntervalId: null,
  slowIntervalId: null,
  started: false,
  
  // Register a callback for fast tick (300ms) - URL polling, modal checks
  onFastTick(fn) {
    this.fastCallbacks.push(fn);
  },
  
  // Register a callback for slow tick (2000ms) - telemetry
  onSlowTick(fn) {
    this.slowCallbacks.push(fn);
  },
  
  // Remove a callback
  off(fn) {
    this.fastCallbacks = this.fastCallbacks.filter(f => f !== fn);
    this.slowCallbacks = this.slowCallbacks.filter(f => f !== fn);
  },
  
  // Start the ticker
  start() {
    if (this.started) return;
    this.started = true;
    
    this.fastIntervalId = setInterval(() => {
      this.fastCallbacks.forEach(fn => {
        try { fn(); } catch (e) { console.error('[ncTicker] Fast tick error:', e); }
      });
    }, 300);
    
    this.slowIntervalId = setInterval(() => {
      this.slowCallbacks.forEach(fn => {
        try { fn(); } catch (e) { console.error('[ncTicker] Slow tick error:', e); }
      });
    }, NC_CONFIG.TELEMETRY_INTERVAL_MS);
  },
  
  // Stop the ticker
  stop() {
    if (this.fastIntervalId) clearInterval(this.fastIntervalId);
    if (this.slowIntervalId) clearInterval(this.slowIntervalId);
    this.fastIntervalId = null;
    this.slowIntervalId = null;
    this.started = false;
  }
};
