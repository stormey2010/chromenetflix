/**
 * Netflix Connect - Share Button Module
 * Handles the share and watchlist buttons in detail modals
 */

const ncShareButton = {
  injected: false,
  observer: null,
  lastUrlForModal: window.location.href,
  urlCheckCallback: null,
  currentNetflixId: null,
  
  // Create the share button element
  create() {
    const btn = document.createElement('div');
    btn.id = 'netflix-connect-share-btn';
    btn.className = 'previewModal-close';
    btn.style.cssText = 'opacity: 1; position: relative; cursor: pointer;';
    btn.innerHTML = `
      <span data-uia="netflix-connect-share" role="button" aria-label="Share with partner" tabindex="0" title="Share with partner">
        <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" role="img">
          <path fill="currentColor" d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z"></path>
        </svg>
      </span>
    `;
    
    btn.addEventListener('click', () => this.handleShare());
    return btn;
  },
  
  // Track if item is in watchlist for toggle
  isInWatchlist: false,
  watchlistBtn: null,
  
  // Create the watchlist button element
  createWatchlistButton() {
    const btn = document.createElement('div');
    btn.id = 'netflix-connect-watchlist-btn';
    btn.className = 'previewModal-close';
    btn.style.cssText = 'opacity: 1; position: relative; cursor: pointer;';
    btn.innerHTML = `
      <span data-uia="netflix-connect-watchlist" role="button" aria-label="Add to shared watchlist" tabindex="0" title="Add to shared watchlist">
        <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" role="img">
          <path fill="currentColor" d="M13 4v7h7v2h-7v7h-2v-7H4v-2h7V4h2z"></path>
        </svg>
      </span>
    `;
    
    btn.addEventListener('click', () => this.handleWatchlistToggle());
    this.watchlistBtn = btn;
    return btn;
  },
  
  // Get current modal info
  getModalInfo() {
    const urlParams = new URLSearchParams(window.location.search);
    let netflixId = urlParams.get('jbv');
    
    if (!netflixId && window.location.pathname.includes('/title/')) {
      const titleMatch = window.location.pathname.match(/\/title\/(\d+)/);
      if (titleMatch) netflixId = titleMatch[1];
    }
    
    const modal = document.querySelector('[data-uia="modal-motion-container-DETAIL_MODAL"]');
    const titleImg = modal?.querySelector('.previewModal--player-titleTreatment-logo');
    const titleAlt = titleImg?.alt || '';
    const boxartImg = modal?.querySelector('.previewModal--boxart');
    const boxartAlt = boxartImg?.alt || '';
    const title = titleAlt || boxartAlt || 'this show';
    
    // Try to get image URL
    let imageUrl = null;
    if (boxartImg?.src) {
      imageUrl = boxartImg.src;
    } else if (titleImg?.src) {
      imageUrl = titleImg.src;
    }
    
    return { netflixId, title, imageUrl };
  },
  
  // Handle share button click
  async handleShare() {
    const { netflixId, title } = this.getModalInfo();
    
    if (netflixId) {
      const titleUrl = `https://www.netflix.com/title/${netflixId}`;
      
      try {
        await ncPost(NC_CONFIG.ENDPOINTS.COMMAND, {
          command: 'share',
          url: titleUrl,
          title: title,
          source_user: ncUser.current,
        });
        
        if (typeof ncNotifications !== 'undefined' && ncNotifications.container) {
          ncNotifications.showShareSent(title);
        } else if (typeof window.npShowHelperNote === 'function') {
          window.npShowHelperNote(`Shared "${title}" with your partner!`);
        }
      } catch (e) {
        console.error('[Netflix Connect] Share failed:', e);
        if (typeof ncNotifications !== 'undefined' && ncNotifications.container) {
          ncNotifications.showNote('Failed to share with partner');
        }
      }
    } else {
      console.warn('[Netflix Connect] No jbv ID found to share');
    }
  },
  
  // Handle watchlist button click - toggle add/remove
  async handleWatchlistToggle() {
    const { netflixId, title, imageUrl } = this.getModalInfo();
    
    if (!netflixId) {
      console.warn('[Netflix Connect] No Netflix ID found for watchlist');
      return;
    }
    
    // Store previous state for rollback on error
    const wasInWatchlist = this.isInWatchlist;
    
    // Optimistically update UI immediately
    this.isInWatchlist = !wasInWatchlist;
    this.updateWatchlistButtonState(this.isInWatchlist);
    
    try {
      if (wasInWatchlist) {
        // Remove from watchlist
        console.log('[Netflix Connect] Removing from watchlist:', netflixId);
        const response = await ncPost(NC_CONFIG.ENDPOINTS.WATCHLIST_REMOVE, {
          netflix_id: netflixId,
          title: title,
          removed_by: ncUser.current
        });
        console.log('[Netflix Connect] Remove response:', response);
        
        if (response.status !== 'removed') {
          // Revert on unexpected response
          this.isInWatchlist = wasInWatchlist;
          this.updateWatchlistButtonState(wasInWatchlist);
        }
      } else {
        // Add to watchlist
        console.log('[Netflix Connect] Adding to watchlist:', netflixId);
        const response = await ncPost(NC_CONFIG.ENDPOINTS.WATCHLIST_ADD, {
          netflix_id: netflixId,
          title: title,
          added_by: ncUser.current,
          image_url: imageUrl,
          content_type: 'unknown'
        });
        console.log('[Netflix Connect] Add response:', response);
        
        if (response.status !== 'added' && response.status !== 'exists') {
          // Revert on unexpected response
          this.isInWatchlist = wasInWatchlist;
          this.updateWatchlistButtonState(wasInWatchlist);
        }
      }
    } catch (e) {
      console.error('[Netflix Connect] Watchlist operation failed:', e);
      // Revert UI on error
      this.isInWatchlist = wasInWatchlist;
      this.updateWatchlistButtonState(wasInWatchlist);
      
      if (typeof ncNotifications !== 'undefined' && ncNotifications.container) {
        ncNotifications.showNote('Failed to update watchlist');
      }
    }
  },
  
  // Update watchlist button state (added/not added)
  updateWatchlistButtonState(isInWatchlist) {
    const btn = this.watchlistBtn || document.getElementById('netflix-connect-watchlist-btn');
    if (!btn) {
      console.warn('[Netflix Connect] Watchlist button not found');
      return;
    }
    
    const span = btn.querySelector('span');
    if (!span) {
      console.warn('[Netflix Connect] Watchlist button span not found');
      return;
    }
    
    if (isInWatchlist) {
      span.innerHTML = `
        <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" role="img">
          <path fill="#46d369" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"></path>
        </svg>
      `;
      span.title = 'Remove from watchlist';
      span.setAttribute('aria-label', 'Remove from watchlist');
    } else {
      span.innerHTML = `
        <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" role="img">
          <path fill="currentColor" d="M13 4v7h7v2h-7v7h-2v-7H4v-2h7V4h2z"></path>
        </svg>
      `;
      span.title = 'Add to shared watchlist';
      span.setAttribute('aria-label', 'Add to shared watchlist');
    }
    
    console.log('[Netflix Connect] Button state updated:', isInWatchlist ? 'in watchlist' : 'not in watchlist');
  },
  
  // Check if current item is in watchlist
  async checkWatchlistStatus(netflixId) {
    if (!netflixId) return;
    
    try {
      console.log('[Netflix Connect] Checking watchlist status for:', netflixId);
      const response = await fetch(`${NC_CONFIG.API_BASE}/watchlist/check/${netflixId}`);
      if (response.ok) {
        const data = await response.json();
        console.log('[Netflix Connect] Watchlist check result:', data);
        this.isInWatchlist = data.in_watchlist;
        this.updateWatchlistButtonState(data.in_watchlist);
      }
    } catch (e) {
      console.error('[Netflix Connect] Watchlist check failed:', e);
    }
  },
  
  // Inject share and watchlist buttons into modal
  inject(modal) {
    if (this.injected) return;
    
    const closeBtn = modal.querySelector('.previewModal-close');
    if (!closeBtn) return;
    
    // Create a container for both buttons
    const container = document.createElement('div');
    container.id = 'netflix-connect-buttons';
    container.style.cssText = 'display: flex; position: absolute; left: 0; top: 0;';
    
    const shareBtn = this.create();
    const watchlistBtn = this.createWatchlistButton();
    
    container.appendChild(shareBtn);
    container.appendChild(watchlistBtn);
    
    closeBtn.parentNode.insertBefore(container, closeBtn);
    this.injected = true;
    
    // Check watchlist status for this item
    const { netflixId } = this.getModalInfo();
    if (netflixId) {
      this.currentNetflixId = netflixId;
      this.checkWatchlistStatus(netflixId);
    }
    
    console.log('[Netflix Connect] Share & Watchlist buttons injected');
  },
  
  // Remove buttons
  remove() {
    const container = document.getElementById('netflix-connect-buttons');
    if (container) {
      container.remove();
      this.injected = false;
      this.currentNetflixId = null;
      this.watchlistBtn = null;
      this.isInWatchlist = false;
      console.log('[Netflix Connect] Buttons removed');
    }
    // Also remove old single button if present
    const btn = document.getElementById('netflix-connect-share-btn');
    if (btn && !btn.parentElement?.id?.includes('netflix-connect')) {
      btn.remove();
      this.injected = false;
    }
  },
  
  // Check if modal is present and inject/remove button
  check() {
    const modal = document.querySelector('[data-uia="modal-motion-container-DETAIL_MODAL"]');
    const urlParams = new URLSearchParams(window.location.search);
    const hasJbv = urlParams.has('jbv');
    const hasTitle = window.location.pathname.includes('/title/');
    const isBrowseWithJbv = window.location.pathname.includes('/browse') && hasJbv;
    
    if (modal && (hasJbv || hasTitle || isBrowseWithJbv)) {
      this.inject(modal);
    } else {
      this.remove();
    }
  },
  
  // Initialize share button module
  init() {
    // Watch for modal appearing/disappearing with scoped observer
    this.observer = new MutationObserver(() => {
      requestIdleCallback(() => this.check(), { timeout: 100 });
    });
    
    // Try to scope observer to main content area instead of full body
    const scopeObserver = () => {
      const container = document.querySelector('.mainView, [data-uia="content-container"], #appMountPoint');
      if (container) {
        this.observer.observe(container, { childList: true, subtree: true });
      } else if (document.body) {
        // Fallback to body if specific container not found
        this.observer.observe(document.body, { childList: true, subtree: true });
      }
      this.check();
    };
    
    if (document.body) {
      scopeObserver();
    } else {
      document.addEventListener('DOMContentLoaded', scopeObserver);
    }
    
    // Check on URL changes
    window.addEventListener('popstate', () => {
      setTimeout(() => this.check(), 100);
    });
    
    // Use unified ticker for URL change polling instead of separate setInterval
    this.urlCheckCallback = () => {
      if (window.location.href !== this.lastUrlForModal) {
        this.lastUrlForModal = window.location.href;
        this.check();
      }
    };
    ncTicker.onFastTick(this.urlCheckCallback);
  }
};
