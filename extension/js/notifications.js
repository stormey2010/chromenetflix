/**
 * Netflix Connect - Notifications Module
 * Sleek Netflix-style notifications and connection status
 */

const ncNotifications = {
  container: null,
  statusBadge: null,
  inviteSource: null,
  retryMs: NC_CONFIG.INITIAL_RETRY_MS,
  isConnected: false,
  partnerName: null,
  urlCheckInterval: null,
  
  // Initialize
  init() {
    this.injectStyles();
    this.createContainer();
    this.createStatusBadge();
    this.startInviteStream();
    this.startUrlWatcher();
  },
  
  // Inject styles
  injectStyles() {
    if (document.getElementById('nc-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'nc-styles';
    style.textContent = `
      /* Toast Container */
      #nc-toasts {
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 2147483647;
        display: flex;
        flex-direction: column-reverse;
        gap: 8px;
        pointer-events: none;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      
      /* Toast */
      .nc-toast {
        pointer-events: auto;
        width: 320px;
        background: rgba(24, 24, 24, 0.95);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border-radius: 6px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(255,255,255,0.06);
        overflow: hidden;
        opacity: 0;
        transform: translateY(16px) scale(0.96);
        transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      }
      
      .nc-toast.visible {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
      
      .nc-toast.exit {
        opacity: 0;
        transform: translateY(-8px) scale(0.96);
        pointer-events: none;
      }
      
      .nc-toast-bar {
        height: 2px;
        background: var(--nc-accent, #e50914);
      }
      
      .nc-toast-main {
        padding: 14px 16px;
        display: flex;
        gap: 12px;
      }
      
      .nc-toast-icon {
        width: 18px;
        height: 18px;
        flex-shrink: 0;
        color: var(--nc-accent, #e50914);
        margin-top: 1px;
      }
      
      .nc-toast-icon svg {
        width: 100%;
        height: 100%;
        fill: currentColor;
      }
      
      .nc-toast-content {
        flex: 1;
        min-width: 0;
      }
      
      .nc-toast-title {
        font-size: 13px;
        font-weight: 600;
        color: #fff;
        line-height: 1.35;
      }
      
      .nc-toast-msg {
        font-size: 12px;
        color: #888;
        margin-top: 2px;
        line-height: 1.4;
      }
      
      .nc-toast-close {
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: transparent;
        border: none;
        color: #555;
        cursor: pointer;
        border-radius: 4px;
        margin: -6px -8px -6px 4px;
        transition: all 0.15s;
        flex-shrink: 0;
      }
      
      .nc-toast-close:hover {
        background: rgba(255,255,255,0.08);
        color: #fff;
      }
      
      .nc-toast-close svg {
        width: 14px;
        height: 14px;
        fill: currentColor;
      }
      
      /* Actions */
      .nc-toast-actions {
        display: flex;
        gap: 8px;
        margin-top: 12px;
      }
      
      .nc-btn {
        height: 32px;
        padding: 0 14px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 600;
        border: none;
        cursor: pointer;
        transition: all 0.15s;
      }
      
      .nc-btn-primary {
        background: #e50914;
        color: #fff;
      }
      
      .nc-btn-primary:hover {
        background: #f6121d;
      }
      
      .nc-btn-secondary {
        background: rgba(255,255,255,0.08);
        color: #ccc;
      }
      
      .nc-btn-secondary:hover {
        background: rgba(255,255,255,0.12);
        color: #fff;
      }
      
      /* Share Card */
      .nc-share-card {
        margin-top: 10px;
        padding: 8px 10px;
        background: rgba(255,255,255,0.04);
        border-radius: 4px;
        display: flex;
        align-items: center;
        gap: 10px;
      }
      
      .nc-share-icon {
        width: 28px;
        height: 28px;
        background: rgba(229,9,20,0.12);
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .nc-share-icon svg {
        width: 14px;
        height: 14px;
        fill: #e50914;
      }
      
      .nc-share-name {
        font-size: 12px;
        color: #ddd;
        font-weight: 500;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      
      /* Progress */
      .nc-toast-progress {
        height: 2px;
        background: rgba(255,255,255,0.06);
      }
      
      .nc-toast-progress-fill {
        height: 100%;
        background: rgba(255,255,255,0.2);
        animation: nc-shrink linear forwards;
        transform-origin: left;
      }
      
      @keyframes nc-shrink {
        from { transform: scaleX(1); }
        to { transform: scaleX(0); }
      }
      
      /* Status Badge */
      #nc-status {
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 2147483640;
        display: flex;
        align-items: center;
        gap: 6px;
        background: rgba(20, 20, 20, 0.85);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        padding: 6px 12px 6px 10px;
        border-radius: 16px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        opacity: 0;
        transform: scale(0.9);
        transition: all 0.2s ease;
        pointer-events: none;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      
      #nc-status.visible {
        opacity: 1;
        transform: scale(1);
      }
      
      .nc-status-dot {
        width: 6px;
        height: 6px;
        background: #46d369;
        border-radius: 50%;
        animation: nc-glow 2s ease-in-out infinite;
      }
      
      @keyframes nc-glow {
        0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(70, 211, 105, 0.4); }
        50% { opacity: 0.7; box-shadow: 0 0 0 4px rgba(70, 211, 105, 0); }
      }
      
      .nc-status-label {
        font-size: 11px;
        color: rgba(255,255,255,0.7);
      }
      
      .nc-status-name {
        font-size: 11px;
        font-weight: 600;
        color: #46d369;
      }
    `;
    document.head.appendChild(style);
  },
  
  // Create toast container
  createContainer() {
    if (this.container) return;
    this.container = document.createElement('div');
    this.container.id = 'nc-toasts';
    (document.body || document.documentElement).appendChild(this.container);
  },
  
  // Create status badge
  createStatusBadge() {
    if (this.statusBadge) return;
    this.statusBadge = document.createElement('div');
    this.statusBadge.id = 'nc-status';
    this.statusBadge.innerHTML = `
      <div class="nc-status-dot"></div>
      <span class="nc-status-label">with</span>
      <span class="nc-status-name"></span>
    `;
    (document.body || document.documentElement).appendChild(this.statusBadge);
  },
  
  // Watch mode check
  isWatchMode() {
    return window.location.pathname.includes('/watch');
  },
  
  // Update badge
  updateStatusBadge() {
    if (!this.statusBadge) return;
    
    if (this.isConnected && this.partnerName && !this.isWatchMode()) {
      this.statusBadge.querySelector('.nc-status-name').textContent = this.partnerName;
      this.statusBadge.classList.add('visible');
    } else {
      this.statusBadge.classList.remove('visible');
    }
  },
  
  // URL watcher for badge visibility
  startUrlWatcher() {
    let lastUrl = window.location.href;
    this.urlCheckInterval = setInterval(() => {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        this.updateStatusBadge();
      }
    }, 500);
  },
  
  // Icons
  icons: {
    invite: `<svg viewBox="0 0 24 24"><path d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`,
    share: `<svg viewBox="0 0 24 24"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z"/></svg>`,
    check: `<svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>`,
    disconnect: `<svg viewBox="0 0 24 24"><path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z"/></svg>`,
    sync: `<svg viewBox="0 0 24 24"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg>`,
    play: `<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`,
    close: `<svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>`
  },
  
  // Escape HTML
  esc(t) {
    const d = document.createElement('div');
    d.textContent = t || '';
    return d.innerHTML;
  },
  
  // Show toast
  show(opts) {
    const { type = 'info', title = '', message = '', actions = [], duration = 3500, shareTitle = null, shareUrl = null } = opts;
    
    const colors = { invite: '#e50914', share: '#e50914', connect: '#46d369', disconnect: '#666', sync: '#e50914', info: '#e50914' };
    const iconMap = { invite: 'invite', share: 'share', connect: 'check', disconnect: 'disconnect', sync: 'sync', info: 'sync' };
    
    const toast = document.createElement('div');
    toast.className = 'nc-toast';
    toast.style.setProperty('--nc-accent', colors[type] || colors.info);
    
    let actionsHtml = actions.length ? `<div class="nc-toast-actions">${actions.map((a, i) => 
      `<button class="nc-btn ${a.primary ? 'nc-btn-primary' : 'nc-btn-secondary'}" data-i="${i}">${a.label}</button>`
    ).join('')}</div>` : '';
    
    let shareHtml = shareTitle && type === 'share' ? `
      <div class="nc-share-card">
        <div class="nc-share-icon">${this.icons.play}</div>
        <div class="nc-share-name">${this.esc(shareTitle)}</div>
      </div>` : '';
    
    toast.innerHTML = `
      <div class="nc-toast-bar"></div>
      <div class="nc-toast-main">
        <div class="nc-toast-icon">${this.icons[iconMap[type]] || this.icons.sync}</div>
        <div class="nc-toast-content">
          <div class="nc-toast-title">${this.esc(title)}</div>
          ${message ? `<div class="nc-toast-msg">${this.esc(message)}</div>` : ''}
          ${shareHtml}
          ${actionsHtml}
        </div>
        <button class="nc-toast-close">${this.icons.close}</button>
      </div>
      ${duration > 0 ? `<div class="nc-toast-progress"><div class="nc-toast-progress-fill" style="animation-duration:${duration}ms"></div></div>` : ''}
    `;
    
    toast.querySelector('.nc-toast-close').onclick = () => this.dismiss(toast);
    actions.forEach((a, i) => {
      const btn = toast.querySelector(`[data-i="${i}"]`);
      if (btn) btn.onclick = () => { if (a.action) a.action(); this.dismiss(toast); };
    });
    
    this.container.appendChild(toast);
    requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add('visible')));
    
    if (duration > 0) setTimeout(() => this.dismiss(toast), duration);
    return toast;
  },
  
  // Dismiss toast
  dismiss(toast) {
    if (!toast?.parentNode) return;
    toast.classList.remove('visible');
    toast.classList.add('exit');
    setTimeout(() => toast.parentNode?.removeChild(toast), 250);
  },
  
  // === Notification types ===
  
  showInviteReceived(from) {
    return this.show({
      type: 'invite',
      title: `${from} wants to watch together`,
      message: 'Accept to sync playback',
      duration: 0,
      actions: [
        { label: 'Accept', primary: true, action: () => this.acceptInvite(from) },
        { label: 'Decline', primary: false, action: () => this.declineInvite(from) }
      ]
    });
  },
  
  showInviteSent(to) {
    return this.show({ type: 'invite', title: `Invite sent to ${to}`, message: 'Waiting for response...', duration: 3000 });
  },
  
  showConnected(partner) {
    this.isConnected = true;
    this.partnerName = partner;
    this.updateStatusBadge();
    return this.show({ type: 'connect', title: `Connected with ${partner}`, message: 'Playback is now synced', duration: 3000 });
  },
  
  showDisconnected() {
    this.isConnected = false;
    this.partnerName = null;
    this.updateStatusBadge();
    return this.show({ type: 'disconnect', title: 'Session ended', duration: 2500 });
  },
  
  showShareReceived(from, title, url) {
    return this.show({
      type: 'share',
      title: `${from} shared something`,
      shareTitle: title,
      duration: 0,
      actions: [
        { label: 'Watch Now', primary: true, action: () => { if (url) window.location.href = url; } },
        { label: 'Later', primary: false, action: () => {} }
      ]
    });
  },
  
  showShareSent(title) {
    return this.show({ type: 'share', title: 'Shared with partner', message: title, duration: 2500 });
  },
  
  showSyncing(msg) {
    return this.show({ type: 'sync', title: 'Syncing', message: msg || 'Following partner...', duration: 2000 });
  },
  
  showNote(msg, dur = 3000) {
    return this.show({ type: 'info', title: 'Netflix Connect', message: msg, duration: dur });
  },
  
  // === Invite API ===
  
  async acceptInvite(from) {
    try {
      const res = await ncPost(NC_CONFIG.ENDPOINTS.INVITE_ACCEPT, {
        from_user: ncUser.current,
        to_user: from
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data.status === 'connected') this.showConnected(from);
    } catch (e) {
      this.showNote('Failed to accept invite');
    }
  },
  
  async declineInvite(from) {
    try {
      await ncPost(NC_CONFIG.ENDPOINTS.INVITE_REJECT, {
        from_user: ncUser.current,
        to_user: from
      });
    } catch (e) {}
  },
  
  // === SSE Stream ===
  
  inviteStream: null,
  
  startInviteStream() {
    if (this.inviteStream) {
      this.inviteStream.stop();
    }
    
    const url = `${NC_CONFIG.ENDPOINTS.INVITE_STREAM}?user=${encodeURIComponent(ncUser.current || 'unknown')}`;
    this.inviteStream = ncCreateSSE(url, (data) => this.handleEvent(data));
    this.inviteStream.start();
  },
  
  stopInviteStream() {
    if (this.inviteStream) {
      this.inviteStream.stop();
      this.inviteStream = null;
    }
  },
  
  handleEvent(data) {
    const me = ncUser.current;
    if (!me || data.event === 'heartbeat') return;
    
    if (data.event === 'init') {
      if (data.invite?.to === me) this.showInviteReceived(data.invite.from);
      if (data.connection?.users) {
        const partner = data.connection.users.find(u => u !== me);
        if (partner) { this.isConnected = true; this.partnerName = partner; this.updateStatusBadge(); }
      }
      return;
    }
    
    if (data.event === 'invite_received' && data.to === me) this.showInviteReceived(data.from);
    else if (data.event === 'connected') {
      const partner = data.users?.find(u => u !== me);
      if (partner) this.showConnected(partner);
    }
    else if (data.event === 'disconnected' && data.users?.includes(me)) this.showDisconnected();
    else if (data.event === 'rejected' && data.from === me) this.showNote(`${data.rejected_by} declined`);
    else if (data.event === 'share' && data.target_user === me) this.showShareReceived(data.source_user, data.title, data.url);
  }
};

// Backwards compatibility
window.npShowHelperNote = (msg, dur) => ncNotifications.container ? ncNotifications.showNote(msg, dur) : console.log('[NC]', msg);
