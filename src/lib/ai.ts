import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import { AIProvider, ChatMessage } from '@/types'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
})

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
})

// 非流式模式的 system prompt（要求 JSON 格式）
const SYSTEM_PROMPT_JSON = `你是一个知识探索助手，帮助用户学习和理解各种主题。

你的任务是：
1. 回答用户的问题，提供清晰、结构化的解释
2. 在回答后，推荐3-5个相关的后续问题供用户继续探索

请用以下JSON格式回复：
{
  "answer": "你的回答内容（使用Markdown格式）",
  "suggestedQuestions": ["问题1", "问题2", "问题3"]
}

注意：
- 回答应该信息丰富但不过长
- 推荐的问题应该与当前话题相关，帮助用户深入或扩展理解
- 始终返回有效的JSON格式`

// 流式模式的 system prompt（使用分隔符）
const SYSTEM_PROMPT_STREAM = `你是一个知识探索助手，帮助用户学习和理解各种主题。

你的任务是：
1. 回答用户的问题，提供清晰、结构化的解释
2. 在回答后，推荐3-5个相关的后续问题供用户继续探索

回复格式要求：
1. 首先直接输出你的回答内容（使用Markdown格式）
2. 回答完成后，换两行，输出分隔符 ---SUGGESTIONS---
3. 在分隔符后，换行输出一个JSON数组，包含推荐的问题

示例格式：
这是我对你问题的回答...

回答可以有多个段落...

---SUGGESTIONS---
["后续问题1", "后续问题2", "后续问题3"]

注意：
- 回答应该信息丰富但不过长
- 推荐的问题应该与当前话题相关
- 分隔符必须是 ---SUGGESTIONS--- 并且独占一行`

// 非流式调用（保持兼容）
export async function chat(
  messages: ChatMessage[],
  provider: AIProvider
): Promise<{ answer: string; suggestedQuestions: string[] }> {
  const formattedMessages = messages.map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }))

  let responseText: string

  if (provider === 'openai') {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT_JSON },
        ...formattedMessages,
      ],
      response_format: { type: 'json_object' },
    })
    responseText = response.choices[0]?.message?.content || ''
  } else {
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4096,
      system: SYSTEM_PROMPT_JSON,
      messages: formattedMessages,
    })
    const textBlock = response.content.find((block) => block.type === 'text')
    responseText = textBlock?.type === 'text' ? textBlock.text : ''
  }

  try {
    // 尝试提取JSON（处理可能的markdown代码块包裹）
    let jsonStr = responseText
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (jsonMatch) {
      jsonStr = jsonMatch[1]
    }

    const parsed = JSON.parse(jsonStr)
    return {
      answer: parsed.answer || responseText,
      suggestedQuestions: parsed.suggestedQuestions || [],
    }
  } catch {
    // JSON解析失败，返回原始文本
    return {
      answer: responseText,
      suggestedQuestions: [],
    }
  }
}

// 流式调用
export async function chatStream(
  messages: ChatMessage[],
  provider: AIProvider,
  onChunk: (chunk: string) => void
): Promise<{ answer: string; suggestedQuestions: string[] }> {
  const formattedMessages = messages.map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }))

  let fullResponse = ''

  if (provider === 'openai') {
    const stream = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT_STREAM },
        ...formattedMessages,
      ],
      stream: true,
    })

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || ''
      if (content) {
        fullResponse += content
        onChunk(content)
      }
    }
  } else {
    const stream = anthropic.messages.stream({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4096,
      system: SYSTEM_PROMPT_STREAM,
      messages: formattedMessages,
    })

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        const text = event.delta.text
        fullResponse += text
        onChunk(text)
      }
    }
  }

  // 解析完整响应，提取答案和推荐问题
  return parseStreamResponse(fullResponse)
}

// 解析流式响应
function parseStreamResponse(response: string): { answer: string; suggestedQuestions: string[] } {
  const separator = '---SUGGESTIONS---'
  const parts = response.split(separator)

  if (parts.length >= 2) {
    const answer = parts[0].trim()
    const suggestionsStr = parts[1].trim()

    try {
      // 尝试解析 JSON 数组
      const suggestedQuestions = JSON.parse(suggestionsStr)
      if (Array.isArray(suggestedQuestions)) {
        return { answer, suggestedQuestions }
      }
    } catch {
      // 解析失败，尝试提取方括号内容
      const match = suggestionsStr.match(/\[[\s\S]*\]/)
      if (match) {
        try {
          const suggestedQuestions = JSON.parse(match[0])
          if (Array.isArray(suggestedQuestions)) {
            return { answer, suggestedQuestions }
          }
        } catch {
          // 忽略解析错误
        }
      }
    }

    return { answer, suggestedQuestions: [] }
  }

  // 没有找到分隔符，返回整个响应作为答案
  return { answer: response.trim(), suggestedQuestions: [] }
}
