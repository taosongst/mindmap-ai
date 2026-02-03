import puppeteer from 'puppeteer-core'
import chromium from '@sparticuz/chromium'

interface ChatGPTMessage {
  role: 'user' | 'assistant'
  content: string
}

interface ScrapedConversation {
  title: string
  messages: ChatGPTMessage[]
}

export async function scrapeChatGPTShare(shareUrl: string): Promise<ScrapedConversation | null> {
  // 验证 URL 格式
  const urlPattern = /^https:\/\/(chat\.openai\.com|chatgpt\.com)\/share\/[\w-]+$/
  if (!urlPattern.test(shareUrl)) {
    throw new Error('Invalid ChatGPT share URL')
  }

  let browser = null

  try {
    // 配置 Chromium
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    })

    const page = await browser.newPage()

    // 设置 User-Agent 模拟真实浏览器
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    )

    // 导航到分享页面
    await page.goto(shareUrl, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    })

    // 等待对话内容加载
    // ChatGPT 使用 data-message-author-role 属性标记消息
    await page.waitForSelector('[data-message-author-role]', { timeout: 15000 })

    // 额外等待确保内容完全加载
    await new Promise(resolve => setTimeout(resolve, 2000))

    // 提取对话数据
    const data = await page.evaluate(() => {
      // 获取标题
      const titleEl = document.querySelector('h1')
      const title = titleEl?.textContent?.trim() || 'ChatGPT Conversation'

      // 获取所有消息元素
      const messageElements = document.querySelectorAll('[data-message-author-role]')
      const messages: { role: string; content: string }[] = []

      messageElements.forEach((el) => {
        const role = el.getAttribute('data-message-author-role')
        if (role !== 'user' && role !== 'assistant') return

        // 尝试多种选择器获取内容
        let content = ''
        const markdownEl = el.querySelector('.markdown')
        const proseEl = el.querySelector('.prose')
        const textEl = el.querySelector('.text-base')

        if (markdownEl) {
          content = markdownEl.textContent || ''
        } else if (proseEl) {
          content = proseEl.textContent || ''
        } else if (textEl) {
          content = textEl.textContent || ''
        } else {
          content = el.textContent || ''
        }

        content = content.trim()
        if (content) {
          messages.push({ role, content })
        }
      })

      return { title, messages }
    })

    return data as ScrapedConversation
  } catch (error) {
    console.error('ChatGPT scraping failed:', error)
    return null
  } finally {
    if (browser) {
      await browser.close()
    }
  }
}

// 将消息配对为 Q&A
export function pairMessagesToQA(
  messages: ChatGPTMessage[]
): { question: string; answer: string }[] {
  const pairs: { question: string; answer: string }[] = []

  for (let i = 0; i < messages.length; i++) {
    const current = messages[i]
    const next = messages[i + 1]

    if (current.role === 'user' && next?.role === 'assistant') {
      pairs.push({
        question: current.content,
        answer: next.content,
      })
      i++ // 跳过已配对的 assistant 消息
    }
  }

  return pairs
}
