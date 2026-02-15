// MindMap AI Sync - Background Service Worker
// 简化版：仅用于基本扩展功能

// 安装时设置初始状态
chrome.runtime.onInstalled.addListener(() => {
  chrome.action.setBadgeText({ text: '' });
});

// 监听来自 content script 的消息（可选：用于 badge 更新）
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SYNC_COMPLETE') {
    // 同步完成时更新 badge
    if (message.success) {
      chrome.action.setBadgeText({ text: '✓' });
      chrome.action.setBadgeBackgroundColor({ color: '#10a37f' });
    } else {
      chrome.action.setBadgeText({ text: '!' });
      chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
    }

    // 3秒后清除 badge
    setTimeout(() => {
      chrome.action.setBadgeText({ text: '' });
    }, 3000);
  }

  return true;
});
