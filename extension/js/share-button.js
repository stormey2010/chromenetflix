/**
 * Netflix Connect - Share Button Module
 * Handles the share button in detail modals
 */

const ncShareButton = {
  injected: false,
  observer: null,
  lastUrlForModal: window.location.href,
  urlCheckCallback: null,
  
  // Create the share button element
  create() {
    const btn = document.createElement('div');
    btn.id = 'netflix-connect-share-btn';
    btn.className = 'previewModal-close';
    btn.style.cssText = 'opacity: 1; left: 0%; cursor: pointer;';
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
  
  // Handle share button click
  async handleShare() {
    // Get video ID from jbv parameter or /title/ path
    const urlParams = new URLSearchParams(window.location.search);
    let jbvId = urlParams.get('jbv');
    
    if (!jbvId && window.location.pathname.includes('/title/')) {
      const titleMatch = window.location.pathname.match(/\/title\/(\d+)/);
      if (titleMatch) jbvId = titleMatch[1];
    }
    
    // Get the title from the modal
    const modal = document.querySelector('[data-uia="modal-motion-container-DETAIL_MODAL"]');
    const titleImg = modal?.querySelector('.previewModal--player-titleTreatment-logo');
    const titleAlt = titleImg?.alt || '';
    const boxartImg = modal?.querySelector('.previewModal--boxart');
    const boxartAlt = boxartImg?.alt || '';
    const title = titleAlt || boxartAlt || 'this show';
    
    if (jbvId) {
      const watchUrl = `https://www.netflix.com/watch/${jbvId}`;
      
      try {
        await ncPost(NC_CONFIG.ENDPOINTS.COMMAND, {
          command: 'share',
          url: watchUrl,
          title: title,
          source_user: ncUser.current,
        });
        
        // Use new notification system
        if (typeof ncNotifications !== 'undefined' && ncNotifications.container) {
          ncNotifications.showShareSent(title);
        } else if (typeof window.npShowHelperNote === 'function') {
          window.npShowHelperNote(`Shared "${title}" with your partner!`);
        }
      } catch (e) {
        console.error('[Netflix Connect] Share failed:', e);
        if (typeof ncNotifications !== 'undefined' && ncNotifications.container) {
          ncNotifications.showNote('Failed to share with partner');
        } else if (typeof window.npShowHelperNote === 'function') {
          window.npShowHelperNote('Failed to share with partner');
        }
      }
    } else {
      console.warn('[Netflix Connect] No jbv ID found to share');
    }
  },
  
  // Inject share button into modal
  inject(modal) {
    if (this.injected) return;
    
    const closeBtn = modal.querySelector('.previewModal-close');
    if (!closeBtn) return;
    
    const shareBtn = this.create();
    closeBtn.parentNode.insertBefore(shareBtn, closeBtn);
    this.injected = true;
    console.log('[Netflix Connect] Share button injected');
  },
  
  // Remove share button
  remove() {
    const btn = document.getElementById('netflix-connect-share-btn');
    if (btn) {
      btn.remove();
      this.injected = false;
      console.log('[Netflix Connect] Share button removed');
    }
  },
  
  // Check if modal is present and inject/remove button
  check() {
    const modal = document.querySelector('[data-uia="modal-motion-container-DETAIL_MODAL"]');
    const urlParams = new URLSearchParams(window.location.search);
    const hasJbv = urlParams.has('jbv');
    const hasTitle = window.location.pathname.includes('/title/');
    
    if (modal && (hasJbv || hasTitle)) {
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
