// Background service worker for Netflix Connect

// Open setup page on first install
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // Check if user is already set up
    chrome.storage.sync.get(['user'], (result) => {
      if (!result.user) {
        // Open setup page in a new tab
        chrome.tabs.create({
          url: chrome.runtime.getURL('setup.html')
        });
      }
    });
  }
});

// Also open setup if user clicks extension icon and hasn't set up yet
chrome.action.onClicked.addListener((tab) => {
  chrome.storage.sync.get(['user'], (result) => {
    if (!result.user) {
      chrome.tabs.create({
        url: chrome.runtime.getURL('setup.html')
      });
    }
  });
});
