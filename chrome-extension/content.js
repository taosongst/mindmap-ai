// MindMap AI Sync - Content Script
// 注入到 ChatGPT 页面，提供手动同步功能

(function() {
  'use strict';

  // 配置
  const CONFIG = {
    API_URL: 'http://localhost:3000/api/sync',
  };

  // 日志
  function log(...args) {
    console.log('[MindMap Sync]', ...args);
  }

  // 获取当前对话 ID（从 URL）
  function getConversationId() {
    // 优先匹配 /c/xxx（对话 ID），因为 /g/xxx/c/yyy 格式中 /c/ 后面才是真正的对话 ID
    const conversationMatch = window.location.pathname.match(/\/c\/([a-zA-Z0-9-]+)/);
    if (conversationMatch) {
      return conversationMatch[1];
    }

    // 如果没有 /c/，尝试 /g/xxx 格式（纯 GPT 链接）
    const gptMatch = window.location.pathname.match(/\/g\/([a-zA-Z0-9-]+)/);
    if (gptMatch) {
      return gptMatch[1];
    }

    return null;
  }

  // 获取对话标题
  function getConversationTitle() {
    // ChatGPT 标题通常在 nav 或 title 中
    const titleEl = document.querySelector('nav a[href*="/c/"] div') ||
                    document.querySelector('title');
    let title = titleEl?.textContent?.trim() || 'ChatGPT Conversation';
    // 移除 "ChatGPT" 后缀
    title = title.replace(/\s*[-|]\s*ChatGPT\s*$/, '').trim();
    return title || 'ChatGPT Conversation';
  }

  // 提取所有消息
  function extractMessages() {
    const messages = [];
    const messageElements = document.querySelectorAll('[data-message-author-role]');

    messageElements.forEach((el) => {
      const role = el.getAttribute('data-message-author-role');
      if (role !== 'user' && role !== 'assistant') return;

      // 获取消息内容
      const contentEl = el.querySelector('.markdown') || el.querySelector('.whitespace-pre-wrap');
      const content = contentEl?.innerText?.trim() || '';

      if (content) {
        messages.push({ role, content });
      }
    });

    return messages;
  }

  // 配对消息为 Q&A
  function pairMessages(messages) {
    const pairs = [];

    for (let i = 0; i < messages.length; i++) {
      const current = messages[i];
      const next = messages[i + 1];

      if (current.role === 'user' && next?.role === 'assistant') {
        pairs.push({
          question: current.content,
          answer: next.content,
          messageIndex: pairs.length,
        });
        i++;  // 跳过 assistant
      }
    }

    return pairs;
  }

  // 获取对话状态信息
  function getConversationInfo() {
    const conversationId = getConversationId();
    const conversationTitle = getConversationTitle();
    const messages = extractMessages();
    const qaPairs = pairMessages(messages);

    return {
      conversationId,
      conversationTitle,
      totalMessages: messages.length,
      qaPairCount: qaPairs.length,
      qaPairs,
    };
  }

  // 同步所有 Q&A 到 MindMap AI
  async function syncAllQA() {
    const info = getConversationInfo();
    log('Starting sync:', info);

    if (!info.conversationId) {
      return { success: false, error: '未检测到对话' };
    }

    if (info.qaPairs.length === 0) {
      return { success: false, error: '没有可同步的问答' };
    }

    let syncedCount = 0;
    let lastMapId = null;

    for (const qa of info.qaPairs) {
      try {
        const response = await fetch(CONFIG.API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversationId: info.conversationId,
            conversationTitle: info.conversationTitle,
            question: qa.question,
            answer: qa.answer,
            messageIndex: qa.messageIndex,
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const result = await response.json();
        if (result.success) {
          syncedCount++;
          lastMapId = result.mapId;
        }
      } catch (error) {
        log('Sync error for QA:', qa.messageIndex, error);
      }
    }

    return {
      success: syncedCount > 0,
      syncedCount,
      totalCount: info.qaPairs.length,
      mapId: lastMapId,
    };
  }

  // 初始化
  function init() {
    log('Initializing (manual sync mode)...');

    // 监听来自 popup 的消息
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'GET_STATUS') {
        const info = getConversationInfo();
        sendResponse({
          conversationId: info.conversationId,
          conversationTitle: info.conversationTitle,
          totalMessages: info.totalMessages,
          qaPairCount: info.qaPairCount,
        });
      } else if (message.type === 'SYNC') {
        syncAllQA().then(result => {
          sendResponse(result);
        });
        return true;  // 保持消息通道开启以进行异步响应
      }
      return true;
    });
  }

  // 启动
  init();
})();
