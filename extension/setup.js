async function selectUser(user) {
  const buttons = document.querySelectorAll('.user-btn');
  buttons.forEach(btn => btn.classList.remove('active'));
  
  if (user === 'Parker') {
    document.getElementById('parkerBtn').classList.add('active');
  } else {
    document.getElementById('emilyBtn').classList.add('active');
  }

  // Save after a short delay
  setTimeout(async () => {
    await chrome.storage.sync.set({ user });
    showSuccess();
  }, 300);
}

function showSuccess() {
  document.getElementById('selectionScreen').style.display = 'none';
  document.getElementById('successScreen').style.display = 'block';
}

function closeSetup() {
  window.close();
}

// Initialize event listeners
function initEventListeners() {
  document.getElementById('parkerBtn').addEventListener('click', () => selectUser('Parker'));
  document.getElementById('emilyBtn').addEventListener('click', () => selectUser('Emily'));
  document.getElementById('closeBtn').addEventListener('click', closeSetup);
}

// Load user on page load
window.addEventListener('load', async () => {
  initEventListeners();
  
  const result = await chrome.storage.sync.get(['user']);
  if (result.user) {
    if (result.user === 'Parker') {
      document.getElementById('parkerBtn').classList.add('active');
    } else {
      document.getElementById('emilyBtn').classList.add('active');
    }
  }
});
