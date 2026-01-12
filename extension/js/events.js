/**
 * Netflix Connect - Event Listeners
 * Handles user interaction events (clicks, keyboard)
 */

const ncEvents = {
  videoListenersAttached: false,
  isPageUnloading: false,  // Track if page is being unloaded
  tabHidden: false,  // Track if tab is hidden (for auto-pause)
  
  // Sync state tracking
  syncState: {
    lastKnownTime: 0,
    lastPaused: true,
    lastPlaybackRate: 1.0,  // Track playback rate for speed sync
    ignoreNextEvent: false,  // Prevent echo when we receive a sync command
    ignoreNextRateChange: false,  // Prevent echo for rate changes
    syncThreshold: 1.0,  // Seconds threshold for seek detection
    pausedByTabSwitch: false,  // Track if we paused due to tab switch
  },
  
  // Send sync command to server
  async sendSyncCommand(command, time, extra = {}) {
    if (!ncUser.current) return;
    
    // Don't send sync commands if page is unloading (reload/close)
    if (this.isPageUnloading) {
      console.log('[Netflix Connect] Skipping sync - page unloading');
      return;
    }
    
    // Don't send sync if video element doesn't exist
    const video = ncGetVideo();
    if (!video) {
      console.log('[Netflix Connect] Skipping sync - no video element');
      return;
    }
    
    // Round time down to nearest second for sync
    const syncTime = Math.floor(time);
    
    const payload = {
      command: command,
      seconds: syncTime,
      source_user: ncUser.current,
      ...extra
    };
    
    console.log(`[Netflix Connect] Sending sync: ${command} @ ${syncTime}s`, extra);
    
    try {
      await ncPost(NC_CONFIG.ENDPOINTS.SYNC, payload);
    } catch (e) {
      // Server offline is expected, silently ignore
    }
  },
  
  // Setup click event listeners
  setupClickListeners() {
    document.addEventListener('click', (e) => {
      // Skip buttons
      const fwd = e.target.closest('button[data-uia="control-forward10"]');
      const back = e.target.closest('button[data-uia="control-back10"]');

      if (fwd) {
        console.log('[Netflix Connect] forward 10 pressed');
        ncDebouncedPush.throttledSkip('forward10');
        return;
      }

      if (back) {
        console.log('[Netflix Connect] back 10 pressed');
        ncDebouncedPush.throttledSkip('back10');
        return;
      }

      // Other Netflix player controls
      const playPause = e.target.closest('button[data-uia="control-play-pause-play"], button[data-uia="control-play-pause-pause"]');
      const muteBtn = e.target.closest('button[data-uia="control-mute-unmute-mute"], button[data-uia="control-mute-unmute-unmute"]');
      const fullscreen = e.target.closest('button[data-uia="control-fullscreen-enter"], button[data-uia="control-fullscreen-exit"]');
      const nextEp = e.target.closest('button[data-uia="next-episode-seamless-button"], button[data-uia="next-episode-seamless-button-draining"]');
      const skipIntro = e.target.closest('button[data-uia="player-skip-intro"]');
      const skipRecap = e.target.closest('button[data-uia="player-skip-recap"]');
      const skipCredits = e.target.closest('button[data-uia="next-episode-seamless-button-credits"]');

      if (playPause) {
        console.log('[Netflix Connect] play/pause clicked');
        ncDebouncedPush.fast('click_playpause');
      } else if (muteBtn) {
        console.log('[Netflix Connect] mute toggled');
        ncDebouncedPush.fast('click_mute');
      } else if (fullscreen) {
        console.log('[Netflix Connect] fullscreen toggled');
        ncDebouncedPush.fast('click_fullscreen');
      } else if (nextEp) {
        console.log('[Netflix Connect] next episode clicked');
        ncDebouncedPush.fast('click_next_episode');
      } else if (skipIntro) {
        console.log('[Netflix Connect] skip intro clicked - syncing to partner');
        ncDebouncedPush.fast('click_skip_intro');
        // Sync skip intro to partner
        const video = ncGetVideo();
        if (video) {
          setTimeout(() => {
            this.sendSyncCommand('sync_skip', video.currentTime, { skip_type: 'intro' });
          }, 100);
        }
      } else if (skipRecap) {
        console.log('[Netflix Connect] skip recap clicked - syncing to partner');
        ncDebouncedPush.fast('click_skip_recap');
        // Sync skip recap to partner
        const video = ncGetVideo();
        if (video) {
          setTimeout(() => {
            this.sendSyncCommand('sync_skip', video.currentTime, { skip_type: 'recap' });
          }, 100);
        }
      } else if (skipCredits) {
        console.log('[Netflix Connect] skip credits clicked - syncing to partner');
        ncDebouncedPush.fast('click_skip_credits');
        // Sync skip credits to partner (will navigate to next episode)
        const video = ncGetVideo();
        if (video) {
          setTimeout(() => {
            this.sendSyncCommand('sync_skip', video.currentTime, { skip_type: 'credits' });
          }, 100);
        }
      }
    }, true);
  },
  
  // Setup keyboard event listeners
  setupKeyboardListeners() {
    document.addEventListener('keydown', (e) => {
      const video = ncGetVideo();
      if (!video) return;

      const key = e.key || e.code;

      // Use slow debounce for spammy arrow key actions
      switch (key) {
        case 'ArrowLeft':
        case 'Left':
        case 'ArrowRight':
        case 'Right':
        case 'ArrowUp':
        case 'Up':
        case 'ArrowDown':
        case 'Down':
          ncDebouncedPush.slow('key_' + key.replace('Arrow', '').toLowerCase());
          return;
      }

      // Regular actions
      let action = null;
      switch (key) {
        case ' ':
        case 'Space':
          action = 'key_space';
          break;
        case 'Enter':
          action = 'key_enter';
          break;
        case 'm':
        case 'M':
          action = 'key_mute';
          break;
        case 'f':
        case 'F':
          action = 'key_fullscreen';
          break;
        case 'Escape':
          action = 'key_escape';
          break;
        case 's':
        case 'S':
          action = 'key_skip';
          break;
      }

      if (action) {
        console.log(`[Netflix Connect] ${action}`);
        ncDebouncedPush.fast(action);
      }
    }, true);
  },
  
  // Attach listeners to video element
  attachVideoListeners() {
    const video = ncGetVideo();
    if (!video || video.__ncListenersAttached) return;
    
    video.__ncListenersAttached = true;
    
    // Initialize sync state
    this.syncState.lastKnownTime = video.currentTime;
    this.syncState.lastPaused = video.paused;

    video.addEventListener('play', () => {
      console.log('[Netflix Connect] video play event');
      // IMMEDIATE dashboard update for play
      ncTelemetry.push({ action: 'video_play', dashboard_instant: true });
      // Send sync play command (unless this was triggered by incoming sync)
      if (this.syncState.ignoreNextEvent) {
        this.syncState.ignoreNextEvent = false;
        return;
      }
      if (this.syncState.lastPaused) {
        this.sendSyncCommand('sync_play', video.currentTime);
      }
      this.syncState.lastPaused = false;
    });

    video.addEventListener('pause', () => {
      console.log('[Netflix Connect] video pause event');
      // IMMEDIATE dashboard update for pause
      ncTelemetry.push({ action: 'video_pause', dashboard_instant: true });
      // Send sync pause command (unless this was triggered by incoming sync)
      if (this.syncState.ignoreNextEvent) {
        this.syncState.ignoreNextEvent = false;
        return;
      }
      if (!this.syncState.lastPaused) {
        this.sendSyncCommand('sync_pause', video.currentTime);
      }
      this.syncState.lastPaused = true;
    });

    video.addEventListener('seeked', () => {
      // IMMEDIATE dashboard update for seek
      ncTelemetry.push({ action: 'video_seeked', dashboard_instant: true });
      ncDebouncedPush.slow('video_seeked');
      // Check if this was triggered by incoming sync
      if (this.syncState.ignoreNextEvent) {
        this.syncState.ignoreNextEvent = false;
        this.syncState.lastKnownTime = video.currentTime;
        return;
      }
      // Detect significant time change (more than 1 second = user seek/fast forward)
      const timeDiff = Math.abs(video.currentTime - this.syncState.lastKnownTime);
      if (timeDiff > this.syncState.syncThreshold) {
        console.log(`[Netflix Connect] Seek detected: ${timeDiff.toFixed(1)}s difference`);
        this.sendSyncCommand('sync_seek', video.currentTime);
      }
      this.syncState.lastKnownTime = video.currentTime;
    });
    
    // Also track time updates to detect fast forward/rewind
    video.addEventListener('timeupdate', () => {
      // Only check every so often to avoid spam
      const timeDiff = Math.abs(video.currentTime - this.syncState.lastKnownTime);
      
      // If time jumped more than 2 seconds in a single update, it's a seek
      if (timeDiff > 2 && !this.syncState.ignoreNextEvent) {
        console.log(`[Netflix Connect] Time jump detected: ${timeDiff.toFixed(1)}s`);
        this.sendSyncCommand('sync_seek', video.currentTime);
      }
      
      this.syncState.lastKnownTime = video.currentTime;
    });

    video.addEventListener('ratechange', () => {
      console.log('[Netflix Connect] video rate changed to', video.playbackRate);
      ncDeferredCall(() => ncTelemetry.push({ action: 'video_ratechange' }));
      
      // Sync playback rate to partner (unless this was triggered by incoming sync)
      if (this.syncState.ignoreNextRateChange) {
        this.syncState.ignoreNextRateChange = false;
        this.syncState.lastPlaybackRate = video.playbackRate;
        return;
      }
      
      // Only sync if rate actually changed
      if (video.playbackRate !== this.syncState.lastPlaybackRate) {
        console.log(`[Netflix Connect] Speed changed: ${this.syncState.lastPlaybackRate}x -> ${video.playbackRate}x`);
        this.sendSyncCommand('sync_speed', video.currentTime, { playback_rate: video.playbackRate });
        this.syncState.lastPlaybackRate = video.playbackRate;
      }
    });
    
    console.log('[Netflix Connect] Video listeners attached with sync support');
  },
  
  // Setup tab visibility detection for auto-pause
  setupTabVisibility() {
    document.addEventListener('visibilitychange', () => {
      const video = ncGetVideo();
      
      if (document.hidden) {
        // Tab became hidden
        this.tabHidden = true;
        console.log('[Netflix Connect] Tab hidden - auto-pausing');
        
        if (video && !video.paused) {
          this.syncState.pausedByTabSwitch = true;
          this.syncState.ignoreNextEvent = true;
          video.pause();
          
          // Notify partner we switched away
          this.sendSyncCommand('sync_tab_away', video.currentTime);
          
          if (typeof ncNotifications !== 'undefined') {
            ncNotifications.showNote('Video paused (tab hidden)', 2000);
          }
        }
      } else {
        // Tab became visible
        this.tabHidden = false;
        console.log('[Netflix Connect] Tab visible again');
        
        // Notify partner we're back
        if (video) {
          this.sendSyncCommand('sync_tab_back', video.currentTime);
        }
      }
    });
    
    console.log('[Netflix Connect] Tab visibility listener attached');
  },
  
  // Try to attach video listeners with retry
  tryAttachVideoListeners(attempts = 0) {
    if (ncGetVideo()) {
      this.attachVideoListeners();
      return;
    }
    if (attempts < 30) {
      setTimeout(() => this.tryAttachVideoListeners(attempts + 1), 500);
    }
  },
  
  // Initialize all event listeners
  init() {
    this.setupClickListeners();
    this.setupKeyboardListeners();
    this.tryAttachVideoListeners();
    this.setupTabVisibility();
    
    // Track page unload to prevent sending sync commands during reload/close
    window.addEventListener('beforeunload', () => {
      this.isPageUnloading = true;
      console.log('[Netflix Connect] Page unloading - sync disabled');
    });
  }
};


/**
 * Drift Checker - Periodically checks if users are out of sync
 * Notifies the person who is ahead so they can sync back
 */
const ncDriftChecker = {
  intervalId: null,
  lastNotificationTime: 0,
  
  // Start checking for drift every 2 minutes
  start() {
    if (this.intervalId) return;
    
    this.intervalId = setInterval(() => this.check(), NC_CONFIG.DRIFT_CHECK_INTERVAL_MS);
    console.log('[Netflix Connect] Drift checker started (every 2 min)');
  },
  
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  },
  
  async check() {
    if (!ncUser.current || ncUser.current === 'unknown') return;
    
    // Only check if we're on a watch page
    if (ncGetPageType() !== 'watch') return;
    
    try {
      const url = `${NC_CONFIG.ENDPOINTS.SYNC_DRIFT}?user=${encodeURIComponent(ncUser.current)}`;
      const res = await fetch(url);
      if (!res.ok) return;
      
      const data = await res.json();
      
      if (data.status === 'ahead' && data.drift > NC_CONFIG.DRIFT_THRESHOLD_S) {
        // Don't spam notifications - wait at least 2 minutes between them
        const now = Date.now();
        if (now - this.lastNotificationTime < NC_CONFIG.DRIFT_CHECK_INTERVAL_MS) return;
        this.lastNotificationTime = now;
        
        console.log(`[Netflix Connect] Drift detected: ${data.drift}s ahead of ${data.partner}`);
        this.showDriftNotification(data);
      }
    } catch (e) {
      // Server offline, silently ignore
    }
  },
  
  showDriftNotification(data) {
    const driftSeconds = Math.round(data.drift);
    const syncTo = data.sync_to;
    
    // Format sync time nicely
    const mins = Math.floor(syncTo / 60);
    const secs = syncTo % 60;
    const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;
    
    if (typeof ncNotifications !== 'undefined' && ncNotifications.container) {
      ncNotifications.show({
        type: 'sync',
        title: `You're ${driftSeconds}s ahead`,
        message: `${data.partner} is at ${timeStr}. Sync up?`,
        duration: 0,  // Don't auto-dismiss
        actions: [
          { 
            label: 'Sync Now', 
            primary: true, 
            action: () => this.syncToPartner(syncTo) 
          },
          { 
            label: 'Ignore', 
            primary: false, 
            action: () => {} 
          }
        ]
      });
    }
  },
  
  syncToPartner(seconds) {
    const video = ncGetVideo();
    if (!video) return;
    
    console.log(`[Netflix Connect] Syncing to partner's position: ${seconds}s`);
    ncEvents.syncState.ignoreNextEvent = true;
    window.dispatchEvent(
      new CustomEvent('np-seek', { detail: { ms: Number(seconds) * 1000 } })
    );
    
    if (typeof ncNotifications !== 'undefined') {
      ncNotifications.showNote('Synced with partner!', 2000);
    }
  }
};
