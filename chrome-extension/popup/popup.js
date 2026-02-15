// MindMap AI Sync - Popup Script

document.addEventListener('DOMContentLoaded', async () => {
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  const conversationInfo = document.getElementById('conversationInfo');
  const noConversation = document.getElementById('noConversation');
  const conversationTitle = document.getElementById('conversationTitle');
  const conversationIdEl = document.getElementById('conversationId');
  const qaCount = document.getElementById('qaCount');
  const syncBtn = document.getElementById('syncBtn');
  const openBtn = document.getElementById('openBtn');
  const resultEl = document.getElementById('result');

  let lastMapId = null;

  // 检查 MindMap AI 服务是否运行
  async function checkServerConnection() {
    try {
      const response = await fetch('http://localhost:3000/api/maps', {
        method: 'GET',
        signal: AbortSignal.timeout(3000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  // 获取 content script 状态
  async function getContentStatus() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab?.url?.includes('chatgpt.com') && !tab?.url?.includes('chat.openai.com')) {
        return { isOnChatGPT: false };
      }

      return new Promise((resolve) => {
        chrome.tabs.sendMessage(tab.id, { type: 'GET_STATUS' }, (response) => {
          if (chrome.runtime.lastError) {
            resolve({ isOnChatGPT: true, error: 'Content script not loaded' });
          } else {
            resolve({ ...response, isOnChatGPT: true });
          }
        });
      });
    } catch (error) {
      return { error: error.message };
    }
  }

  // 更新 UI
  async function updateUI() {
    const serverConnected = await checkServerConnection();
    const contentStatus = await getContentStatus();

    // 服务器连接状态
    if (serverConnected) {
      statusDot.className = 'status-dot connected';
      statusText.textContent = 'MindMap AI 已连接';
    } else {
      statusDot.className = 'status-dot disconnected';
      statusText.textContent = 'MindMap AI 未运行';
    }

    // 对话信息
    if (contentStatus.isOnChatGPT && contentStatus.conversationId) {
      conversationInfo.style.display = 'block';
      noConversation.style.display = 'none';

      conversationTitle.textContent = contentStatus.conversationTitle || 'ChatGPT 对话';
      conversationIdEl.textContent = 'ID: ' + contentStatus.conversationId.slice(0, 12) + '...';
      qaCount.textContent = contentStatus.qaPairCount || 0;

      // 启用同步按钮
      syncBtn.disabled = !serverConnected || contentStatus.qaPairCount === 0;
    } else {
      conversationInfo.style.display = 'none';
      noConversation.style.display = 'block';

      if (!contentStatus.isOnChatGPT) {
        noConversation.innerHTML = '<div class="icon">💬</div><div>请打开 ChatGPT 对话页面</div>';
      } else {
        noConversation.innerHTML = '<div class="icon">💬</div><div>未检测到对话，请刷新页面</div>';
      }

      syncBtn.disabled = true;
    }
  }

  // 同步按钮
  syncBtn.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;

    // 更新 UI 状态
    syncBtn.textContent = '同步中...';
    syncBtn.disabled = true;
    statusDot.className = 'status-dot syncing';
    statusText.textContent = '正在同步...';
    resultEl.style.display = 'none';

    // 发送同步请求
    chrome.tabs.sendMessage(tab.id, { type: 'SYNC' }, (response) => {
      syncBtn.textContent = '同步到 MindMap AI';

      if (response?.success) {
        lastMapId = response.mapId;
        resultEl.className = 'result success';
        resultEl.textContent = `✓ 成功同步 ${response.syncedCount}/${response.totalCount} 组问答`;
        resultEl.style.display = 'block';

        statusDot.className = 'status-dot connected';
        statusText.textContent = '同步完成';
      } else {
        resultEl.className = 'result error';
        resultEl.textContent = '✗ ' + (response?.error || '同步失败');
        resultEl.style.display = 'block';

        statusDot.className = 'status-dot disconnected';
        statusText.textContent = '同步失败';
      }

      // 3秒后恢复正常状态
      setTimeout(updateUI, 3000);
    });
  });

  // 打开 MindMap AI
  openBtn.addEventListener('click', () => {
    if (lastMapId) {
      chrome.tabs.create({ url: `http://localhost:3000/map/${lastMapId}` });
    } else {
      chrome.tabs.create({ url: 'http://localhost:3000' });
    }
  });

  // 初始更新
  updateUI();
});
