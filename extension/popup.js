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
  el.className = `status ${kind}`;
  setTimeout(() => {
    el.textContent = '';
    el.className = 'status';
  }, 3000);
}

const API_BASE = 'https://api.stormeydev.com';
let currentUser = null;
let otherUser = null;
let pollTimer = null;

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

function renderInviteState(state) {
  const inviteBtn = document.getElementById('invite');
  const acceptRow = document.getElementById('acceptRow');
  const acceptBtn = document.getElementById('accept');
  const refreshBtn = document.getElementById('refresh');

  inviteBtn.textContent = `Invite ${otherUser}`;

  switch (state?.status) {
    case 'waiting':
      setUIState(`Waiting for ${otherUser} to accept`, 'Invite pending');
      inviteBtn.disabled = true;
      acceptRow.style.display = 'none';
      break;
    case 'incoming':
      setUIState(`${otherUser} invited you`, 'Accept to connect');
      inviteBtn.disabled = true;
      acceptRow.style.display = 'block';
      acceptBtn.disabled = false;
      break;
    case 'accepted':
    case 'connected':
      setUIState(`Connected with ${otherUser}`, 'Session active');
      inviteBtn.disabled = true;
      acceptRow.style.display = 'none';
      break;
    case 'declined':
      setUIState(`${otherUser} declined`, 'You can send a new invite');
      inviteBtn.disabled = false;
      acceptRow.style.display = 'none';
      break;
    default:
      setUIState('No invite yet', `Invite ${otherUser} to start`);
      inviteBtn.disabled = false;
      acceptRow.style.display = 'none';
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
    const res = await fetch(`${API_BASE}/invite/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user: currentUser, action: 'accept' }),
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
