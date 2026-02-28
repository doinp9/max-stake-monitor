// background.js — service worker for persistent log

// Clear badge on startup
chrome.runtime.onStartup.addListener(() => {
  chrome.action.setBadgeText({ text: '' });
});
chrome.runtime.onInstalled.addListener(() => {
  chrome.action.setBadgeText({ text: '' });
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'NEW_MAX_STAKE') {
    const data = msg.data;
    // Save to persistent log (no badge update — keep MS icon clean)
    saveToLog(data);
  }

  if (msg.action === 'GET_LOG') {
    chrome.storage.local.get('msLog', (result) => {
      sendResponse(result.msLog || []);
    });
    return true; // async response
  }

  if (msg.action === 'CLEAR_LOG') {
    chrome.storage.local.set({ msLog: [] }, () => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (msg.action === 'EXPORT_LOG') {
    chrome.storage.local.get('msLog', (result) => {
      sendResponse(result.msLog || []);
    });
    return true;
  }
});

function formatBadge(value) {
  if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
  if (value >= 1000) return (value / 1000).toFixed(1) + 'K';
  return Math.round(value).toString();
}

function saveToLog(data) {
  chrome.storage.local.get('msLog', (result) => {
    const log = result.msLog || [];
    log.unshift({
      maxStake: data.maxStake,
      allMaxStakes: data.allMaxStakes,
      source: data.source,
      eventInfo: data.eventInfo,
      timestamp: data.timestamp,
      url: data.source,
    });

    // Keep last 500 entries
    if (log.length > 500) log.length = 500;

    chrome.storage.local.set({ msLog: log });
  });
}
