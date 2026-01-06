/**
 * Netflix Connect - Navigation Module
 * Handles navigation tracking and sync between users
 */

const ncNavigation = {
  lastReportedUrl: null,
  stream: null,
  lastUrl: window.location.href,
  urlCheckCallback: null,
  
  // Report current page to server using shared POST helper
  async report() {
    if (!ncUser.current || ncUser.current === 'unknown') return;
    
    const currentUrl = window.location.href;
    if (currentUrl === this.lastReportedUrl) return;
    this.lastReportedUrl = currentUrl;
    
    const pageType = ncGetPageType();
    const watchId = ncGetWatchId();
    
    // Get current playback position if watching
    let positionS = null;
    const video = ncGetVideo();
    if (video && Number.isFinite(video.currentTime)) {
      positionS = Math.floor(video.currentTime);
    }
    
    console.log(`[Netflix Connect] Navigation: ${pageType}` + (watchId ? ` (${watchId})` : '') + (positionS ? ` @ ${positionS}s` : ''));
    
    try {
      await ncPost(NC_CONFIG.ENDPOINTS.NAV_UPDATE, {
        user: ncUser.current,
        url: currentUrl,
        page_type: pageType,
        watch_id: watchId,
        position_s: positionS,
      });
    } catch (e) {
      // Server offline is expected, silently ignore
    }
  },
  
  // Start listening for navigation sync events using shared SSE factory
  startStream() {
    if (this.stream) {
      this.stream.stop();
    }

    this.stream = ncCreateSSE(
      NC_CONFIG.ENDPOINTS.NAV_STREAM,
      (data) => this.handleMessage(data),
      { onOpen: () => console.log('[Netflix Connect] Nav stream connected') }
    );
    this.stream.start();
  },
  
  // Stop navigation stream
  stopStream() {
    if (this.stream) {
      this.stream.stop();
      this.stream = null;
    }
  },
  
  // Handle incoming navigation message
  handleMessage(data) {
    if (!data?.action || data.action !== 'navigate') return;
    if (data.target_user && data.target_user !== ncUser.current) return;
    
    console.log(`[Netflix Connect] Nav sync: ${data.reason} -> ${data.url}`);
    
    // Use new notification system
    if (typeof ncNotifications !== 'undefined' && ncNotifications.container) {
      ncNotifications.showSyncing(data.reason || 'Following your partner...');
    } else if (typeof window.npShowHelperNote === 'function') {
      window.npShowHelperNote(data.reason || 'Syncing with partner...');
    }
    
    setTimeout(() => {
      window.location.href = data.url;
    }, NC_CONFIG.NAV_DELAY_MS);
  },
  
  // URL change check callback for ticker
  checkUrlChange() {
    if (window.location.href !== this.lastUrl) {
      this.lastUrl = window.location.href;
      console.log('[Netflix Connect] URL changed:', this.lastUrl);
      this.report();
    }
  },
  
  // Setup URL change detection using unified ticker
  setupUrlTracking() {
    // Register with ticker for URL polling
    this.urlCheckCallback = () => this.checkUrlChange();
    ncTicker.onFastTick(this.urlCheckCallback);
    
    // Listen for popstate
    window.addEventListener('popstate', () => {
      setTimeout(() => this.report(), 100);
    });
    
    // Patch pushState and replaceState
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    const self = this;
    
    history.pushState = function (...args) {
      originalPushState.apply(this, args);
      setTimeout(() => self.report(), 100);
    };
    
    history.replaceState = function (...args) {
      originalReplaceState.apply(this, args);
      setTimeout(() => self.report(), 100);
    };
  },
  
  // Initialize navigation module
  init() {
    this.setupUrlTracking();
    this.startStream();
    this.report(); // Report initial page
  }
};
