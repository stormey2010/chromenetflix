async function getActiveNetflixTabId() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error('Open Netflix in the active tab.');
  if (!tab.url || !tab.url.startsWith('https://www.netflix.com/')) {
    throw new Error('Active tab must be netflix.com.');
  }
  return tab.id;
}

function setStatus(text, kind = 'ok') {
  const el = document.getElementById('status');
  el.textContent = text;
  el.className = `status-toast ${kind}`;
  setTimeout(() => {
    el.textContent = '';
    el.className = 'status-toast';
  }, 3000);
}

// Use the same host/port as the running FastAPI server.
const API_BASE = 'http://localhost:8765';
let currentUser = null;
let otherUser = null;
let pollTimer = null;
let activeTab = 'connect';

// Get stored user
async function getStoredUser() {
  const result = await chrome.storage.sync.get(['user']);
  return result.user || null;
}

// Open setup page
function openSetup() {
  chrome.tabs.create({
    url: chrome.runtime.getURL('setup.html')
  });
}

function setUIState(main, detail = '') {
  const statusEl = document.getElementById('connStatus');
  const detailEl = document.getElementById('stateDetail');
  statusEl.textContent = main;
  detailEl.textContent = detail;
}

// =============================================================================
// Tab Navigation
// =============================================================================

function setupTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.dataset.tab;
      
      // Update active states
      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      
      btn.classList.add('active');
      document.getElementById(`tab-${tabId}`).classList.add('active');
      
      activeTab = tabId;
      
      // Load data for the tab
      if (tabId === 'watchlist') loadWatchlist();
      else if (tabId === 'stats') loadStats();
    });
  });
}

// =============================================================================
// Watchlist Functions
// =============================================================================

async function loadWatchlist() {
  const container = document.getElementById('watchlistContainer');
  
  try {
    const res = await fetch(`${API_BASE}/watchlist`);
    if (!res.ok) throw new Error('Failed to load watchlist');
    const data = await res.json();
    
    if (!data.watchlist || data.watchlist.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon"></div>
          <div class="empty-state-text">Your shared watchlist is empty</div>
          <div class="empty-state-sub">Add shows from Netflix to watch together</div>
        </div>
      `;
      return;
    }
    
    container.innerHTML = data.watchlist.map(item => `
      <div class="list-item" data-id="${item.netflix_id}" data-title="${item.title}">
        <img class="list-item-thumb" src="${item.image_url || ''}" alt="" onerror="this.style.display='none'">
        <div class="list-item-info">
          <div class="list-item-title">${item.title}</div>
          <div class="list-item-meta">Added by ${item.added_by}</div>
        </div>
        <button class="list-item-action remove-watchlist" title="Remove">×</button>
      </div>
    `).join('');
    
    // Add click handlers
    container.querySelectorAll('.list-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.classList.contains('remove-watchlist')) {
          e.stopPropagation();
          removeFromWatchlist(item.dataset.id, item.dataset.title);
          return;
        }
        // Navigate to Netflix title
        const netflixId = item.dataset.id;
        chrome.tabs.create({ url: `https://www.netflix.com/title/${netflixId}` });
      });
    });
    
  } catch (e) {
    container.innerHTML = `<div class="empty-state">Error loading watchlist</div>`;
    console.error('Watchlist error:', e);
  }
}

async function removeFromWatchlist(netflixId, title) {
  try {
    const res = await fetch(`${API_BASE}/watchlist/remove`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        netflix_id: netflixId,
        title: title,
        removed_by: currentUser
      })
    });
    
    if (res.ok) {
      setStatus(`Removed "${title}"`, 'ok');
      loadWatchlist();
    }
  } catch (e) {
    setStatus('Failed to remove', 'error');
  }
}

// =============================================================================
// Stats Functions
// =============================================================================

async function loadStats() {
  try {
    const res = await fetch(`${API_BASE}/stats?days=30`);
    if (!res.ok) throw new Error('Failed to load stats');
    const data = await res.json();
    
    const totals = data.totals || {};
    const allTime = data.all_time || {};
    
    document.getElementById('statHours').textContent = totals.watch_time_hours || 0;
    document.getElementById('statSessions').textContent = totals.sessions || 0;
    document.getElementById('statTitles').textContent = totals.titles || 0;
    document.getElementById('statEpisodes').textContent = totals.episodes || 0;
    document.getElementById('statAllTime').textContent = `${allTime.watch_time_hours || 0}h`;
    
  } catch (e) {
    console.error('Stats error:', e);
    // Show zeros on error
    document.getElementById('statHours').textContent = '0';
    document.getElementById('statSessions').textContent = '0';
    document.getElementById('statTitles').textContent = '0';
    document.getElementById('statEpisodes').textContent = '0';
    document.getElementById('statAllTime').textContent = '0h';
  }
}

function renderInviteState(state) {
  const inviteBtn = document.getElementById('invite');
  const acceptBtn = document.getElementById('accept');
  const refreshBtn = document.getElementById('refresh');

  inviteBtn.textContent = `Invite ${otherUser}`;

  const invite = state?.invite;
  const connection = state?.connection;

  // Normalize server response into simple statuses for the UI.
  let status = 'none';
  if (connection) {
    status = 'connected';
  } else if (invite) {
    status = invite.to === currentUser ? 'incoming' : 'waiting';
  }

  switch (status) {
    case 'waiting':
      setUIState(`Waiting for ${otherUser} to accept`, 'Invite pending');
      inviteBtn.disabled = true;
      acceptBtn.style.display = 'none';
      break;
    case 'incoming':
      setUIState(`${otherUser} invited you`, 'Accept to connect');
      inviteBtn.disabled = true;
      acceptBtn.style.display = 'block';
      acceptBtn.disabled = false;
      break;
    case 'connected':
      setUIState(`Connected with ${otherUser}`, 'Session active');
      inviteBtn.disabled = true;
      acceptBtn.style.display = 'none';
      break;
    default:
      setUIState('No invite yet', `Invite ${otherUser} to start`);
      inviteBtn.disabled = false;
      acceptBtn.style.display = 'none';
      break;
  }

  refreshBtn.disabled = false;
}

async function fetchInviteState() {
  const res = await fetch(`${API_BASE}/invite/status`);
  if (!res.ok) throw new Error('Unable to load state');
  return res.json();
}

async function refreshState() {
  try {
    const data = await fetchInviteState();
    renderInviteState(data);
  } catch (e) {
    setUIState('Error loading state', 'Check connection');
    setStatus(e.message || String(e), 'error');
  }
}

async function sendInvite() {
  try {
    setStatus('Sending invite…', 'ok');
    const res = await fetch(`${API_BASE}/invite/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from_user: currentUser, to_user: otherUser }),
    });
    if (!res.ok) throw new Error('Failed to send invite');
    await refreshState();
    setStatus('Invite sent', 'ok');
  } catch (e) {
    setStatus(e.message || String(e), 'error');
  }
}

async function acceptInvite() {
  try {
    setStatus('Accepting…', 'ok');
    const res = await fetch(`${API_BASE}/invite/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from_user: currentUser, to_user: otherUser }),
    });
    if (!res.ok) throw new Error('Failed to accept');
    await refreshState();
    setStatus('Connected', 'ok');
  } catch (e) {
    setStatus(e.message || String(e), 'error');
  }
}

// Initialize
async function init() {
  currentUser = await getStoredUser();

  if (!currentUser) {
    openSetup();
    window.close();
    return;
  }

  otherUser = currentUser === 'Parker' ? 'Emily' : 'Parker';
  document.getElementById('userName').textContent = currentUser;
  document.getElementById('hintText').textContent = `Connect with ${otherUser}`;

  // Setup tabs
  setupTabs();

  // Buttons
  document.getElementById('settingsBtn').addEventListener('click', openSetup);
  document.getElementById('invite').addEventListener('click', sendInvite);
  document.getElementById('accept').addEventListener('click', acceptInvite);
  document.getElementById('refresh').addEventListener('click', refreshState);

  await refreshState();
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(refreshState, 4000);
}

init();
