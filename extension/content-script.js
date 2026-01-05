(() => {
  // Skip sandboxed/child frames to avoid CSP/sandbox errors.
  if (window.top !== window) return;

  const API_BASE = 'https://api.stormeydev.com';
  let currentUser = 'unknown';

  async function loadUser() {
    try {
      const res = await chrome.storage.sync.get(['user']);
      if (res?.user) currentUser = res.user;
    } catch (_) {
      currentUser = 'unknown';
    }
  }

  loadUser();
  const forceHttps = (url) => url.replace(/^http:\/\//i, 'https://');
  const apiUrl = (path) => forceHttps(new URL(path, API_BASE).toString());

  const API_URL = apiUrl('/telemetry');
  const ACTION_URL = apiUrl('/action');
  const COMMAND_STREAM_URL = apiUrl('/command/stream');

  // Inject a page-context helper via an external script (avoids page CSP blocking inline code).
  (function injectSeekHook() {
    if (!chrome.runtime?.id) return;
    const already = document.querySelector('script[data-np-bridge="seek"]');
    if (already) return;
    const s = document.createElement('script');
    s.dataset.npBridge = 'seek';
    try {
      s.src = chrome.runtime.getURL('page-bridge.js');
      (document.head || document.documentElement).appendChild(s);
    } catch (_) {
      s.remove();
    }
  })();

  // Inject page UI helper to show/hide marker based on player active state.
  (function injectPageUi() {
    if (!chrome.runtime?.id) return;
    const already = document.querySelector('script[data-np-bridge="ui"]');
    if (already) return;
    const s = document.createElement('script');
    s.dataset.npBridge = 'ui';
    try {
      s.src = chrome.runtime.getURL('page-ui.js');
      (document.head || document.documentElement).appendChild(s);
    } catch (_) {
      s.remove();
    }
  })();

  function getVideo() {
    return document.querySelector('video');
  }

  function readQuality(video) {
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

  function extractSourceId(url) {
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

  function describeVideo(video) {
    const { frames, dropped } = readQuality(video);
    const pageUrl = window.location?.href || null;
    const cleanPageUrl = pageUrl ? pageUrl.split('?')[0] : null;
    const sourceId = extractSourceId(cleanPageUrl);
    const sourceUrl = cleanPageUrl;

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
      sourceUrl,
    };
  }

  function networkStateLabel(state) {
    switch (state) {
      case 0:
        return 'NETWORK_EMPTY';
      case 1:
        return 'NETWORK_IDLE';
      case 2:
        return 'NETWORK_LOADING';
      case 3:
        return 'NETWORK_NO_SOURCE';
      default:
        return 'UNKNOWN';
    }
  }

  // Capture-phase delegation for the 10s skip buttons; also push an action marker to the API.
  document.addEventListener(
    'click',
    (e) => {
      const fwd = e.target.closest('button[data-uia="control-forward10"]');
      const back = e.target.closest('button[data-uia="control-back10"]');

      if (fwd) {
        console.log('forward 10 pressed');
        pushAction('forward10');
      }

      if (back) {
        console.log('back 10 pressed');
        pushAction('back10');
      }
    },
    true
  );

  function isPlaying(video) {
    // Treat as playing only when it is not paused, not ended, has enough data, and is advancing.
    return !video.paused && !video.ended && video.playbackRate > 0 && video.readyState >= 2;
  }

  async function pushTelemetry(extra = {}) {
    const video = getVideo();
    if (!video) return;

    const p = describeVideo(video);
    const playing = isPlaying(video);
    const payload = {
      user: currentUser,
      time: new Date().toISOString(),
      id: p.sourceId || 'unknown',
      url: p.sourceUrl || window.location?.href || '',
      rate: p.playbackRate ?? 1,
      paused: !playing,
      position_s: Number.isFinite(p.currentTimeS) ? p.currentTimeS : 0,
      position_ms: Number.isFinite(p.currentTimeS) ? Math.round(p.currentTimeS * 1000) : null,
      ready_state: p.readyState ?? -1,
      network: networkStateLabel(p.networkState),
      frames: p.frames != null ? Number(p.frames) : 0,
      dropped: p.dropped ?? 0,
      ...extra,
    };

    try {
      await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (e) {
      // Ignore network errors so the rest of the script keeps running.
    }
  }

  setInterval(pushTelemetry, 2000);

  let commandSource = null;
  let commandRetryMs = 500;

  function startCommandStream() {
    if (commandSource) {
      commandSource.close();
      commandSource = null;
    }

    const es = new EventSource(COMMAND_STREAM_URL);
    commandSource = es;

    es.onopen = () => {
      commandRetryMs = 500;
    };

    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data || '{}');
        if (!data?.command) return;
        if (data.target_user && data.target_user !== currentUser) return;
        const video = getVideo();
        if (!video) return;
        if (data.command === 'play') {
          video.play().catch(() => {});
          pushTelemetry({ action: 'dashboard_play' });
        }
        if (data.command === 'pause') {
          video.pause();
          pushTelemetry({ action: 'dashboard_pause' });
        }
        if (data.command === 'seek' && Number.isFinite(data.seconds)) {
          // Dispatch to the page context so Netflix player APIs are reachable.
          window.dispatchEvent(
            new CustomEvent('np-seek', { detail: { ms: Number(data.seconds) * 1000 } })
          );
          pushTelemetry({ action: 'dashboard_seek' });
        }
      } catch (_) {
        // ignore decode errors
      }
    };

    es.onerror = () => {
      es.close();
      commandSource = null;
      // simple backoff to avoid tight reconnect loops
      const delay = Math.min(commandRetryMs, 5000);
      commandRetryMs = Math.min(commandRetryMs * 2, 5000);
      setTimeout(startCommandStream, delay);
    };
  }

  async function pushAction(action) {
    // Fire-and-forget to the dedicated action endpoint for faster dashboard updates.
    try {
      await fetch(ACTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
    } catch (e) {
      // Ignore errors; dashboard polling will still pick up next telemetry.
    }
    // Also include action in the next full telemetry push for consistency.
    pushTelemetry({ action });
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    (async () => {
      try {
        const video = getVideo();

        if (msg?.type === 'np.getState') {
          if (!video) {
            sendResponse({ ok: true, hasVideo: false, paused: true });
            return;
          }
          sendResponse({ ok: true, hasVideo: true, paused: !!video.paused, player: describeVideo(video) });
          return;
        }

        if (msg?.type === 'np.localPlay') {
          if (video) video.play().catch(() => {});
          sendResponse({ ok: true });
          return;
        }

        if (msg?.type === 'np.localPause') {
          if (video) video.pause();
          sendResponse({ ok: true });
          return;
        }

        sendResponse({ ok: false, error: 'Unknown message.' });
      } catch (e) {
        sendResponse({ ok: false, error: e.message || String(e) });
      }
    })();

    return true;
  });

  // Begin listening for dashboard commands via SSE instead of aggressive polling.
  startCommandStream();
})();
