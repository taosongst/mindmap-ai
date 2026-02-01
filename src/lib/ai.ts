import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import { AIProvider, ChatMessage } from '@/types'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
})

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
})

const SYSTEM_PROMPT = `你是一个知识探索助手，帮助用户学习和理解各种主题。

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
        { role: 'system', content: SYSTEM_PROMPT },
        ...formattedMessages,
      ],
      response_format: { type: 'json_object' },
    })
    responseText = response.choices[0]?.message?.content || ''
  } else {
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
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
