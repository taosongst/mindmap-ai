import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import { AIModel, ChatMessage } from '@/types'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
})

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
})

// 模型配置映射
const MODEL_CONFIG: Record<AIModel, { provider: 'openai' | 'anthropic'; modelId: string }> = {
  'gpt-4o-mini': { provider: 'openai', modelId: 'gpt-4o-mini' },
  'gpt-4o': { provider: 'openai', modelId: 'gpt-4o' },
  'gpt-4.1': { provider: 'openai', modelId: 'gpt-4.1' },
  'gpt-5': { provider: 'openai', modelId: 'gpt-5' },
  'gpt-5-mini': { provider: 'openai', modelId: 'gpt-5-mini' },
  'gpt-5.2': { provider: 'openai', modelId: 'gpt-5.2' },
  'o3-mini': { provider: 'openai', modelId: 'o3-mini' },
  'claude-sonnet': { provider: 'anthropic', modelId: 'claude-3-5-sonnet-20241022' },
  'claude-opus': { provider: 'anthropic', modelId: 'claude-3-opus-20240229' },
}

function getModelConfig(model: AIModel) {
  return MODEL_CONFIG[model] || MODEL_CONFIG['gpt-4o-mini']
}

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
- **重要**：推荐的问题绝对不能与对话历史中用户已经问过的问题相同或语义相似
- 始终返回有效的JSON格式`

// 流式模式的 system prompt（使用分隔符）
const SYSTEM_PROMPT_STREAM = `你是一个知识探索助手，帮助用户学习和理解各种主题。

你的任务是：
1. 回答用户的问题，提供清晰、结构化的解释
2. 在回答后，推荐3-5个相关的后续问题供用户继续探索

回复格式要求（**必须严格遵守**）：
1. 首先直接输出你的回答内容（使用Markdown格式）
2. 回答完成后，换两行，输出分隔符 ---SUGGESTIONS---
3. 在分隔符后，换行输出一个JSON数组，包含推荐的问题

示例格式：
这是我对你问题的回答...

回答可以有多个段落...

---SUGGESTIONS---
["后续问题1", "后续问题2", "后续问题3"]

**严格禁止**：
- 不要在回答正文中以任何形式列出推荐问题（如"### 相关问题"、"后续问题："等）
- 推荐问题只能出现在 ---SUGGESTIONS--- 分隔符之后的JSON数组中
- 不要在回答末尾添加类似"你可能还想了解"、"相关后续问题"这样的章节

其他注意：
- 回答应该信息丰富但不过长
- 推荐的问题绝对不能与对话历史中用户已经问过的问题相同或语义相似
- 分隔符必须是 ---SUGGESTIONS--- 并且独占一行`

// 非流式调用（保持兼容）
export async function chat(
  messages: ChatMessage[],
  model: AIModel
): Promise<{ answer: string; suggestedQuestions: string[] }> {
  const { provider, modelId } = getModelConfig(model)
  const formattedMessages = messages.map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }))

  let responseText: string

  if (provider === 'openai') {
    const response = await openai.chat.completions.create({
      model: modelId,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT_JSON },
        ...formattedMessages,
      ],
      response_format: { type: 'json_object' },
    })
    responseText = response.choices[0]?.message?.content || ''
  } else {
    const response = await anthropic.messages.create({
      model: modelId,
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
  model: AIModel,
  onChunk: (chunk: string) => void
): Promise<{ answer: string; suggestedQuestions: string[] }> {
  const { provider, modelId } = getModelConfig(model)
  const formattedMessages = messages.map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }))

  let fullResponse = ''

  if (provider === 'openai') {
    const stream = await openai.chat.completions.create({
      model: modelId,
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
      model: modelId,
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

  let answer = ''
  let suggestedQuestions: string[] = []

  if (parts.length >= 2) {
    answer = parts[0].trim()
    const suggestionsStr = parts[1].trim()

    // 尝试从分隔符后提取
    suggestedQuestions = extractJsonArray(suggestionsStr)
  } else {
    answer = response.trim()
  }

  // 清理答案中可能存在的推荐问题部分（不管是否已经提取到推荐问题）
  const extracted = extractQuestionsFromAnswer(answer)
  answer = extracted.cleanedAnswer

  // 如果还没有推荐问题，尝试使用从答案中提取的
  if (suggestedQuestions.length === 0 && extracted.questions.length > 0) {
    suggestedQuestions = extracted.questions
  }

  return { answer, suggestedQuestions }
}

// 从文本中提取 JSON 数组
function extractJsonArray(text: string): string[] {
  try {
    const parsed = JSON.parse(text)
    if (Array.isArray(parsed)) {
      return parsed.filter((q): q is string => typeof q === 'string' && q.trim() !== '')
    }
  } catch {
    // 尝试提取方括号内容
    const match = text.match(/\[[\s\S]*?\]/)
    if (match) {
      try {
        const parsed = JSON.parse(match[0])
        if (Array.isArray(parsed)) {
          return parsed.filter((q): q is string => typeof q === 'string' && q.trim() !== '')
        }
      } catch {
        // 忽略
      }
    }
  }
  return []
}

// 从答案末尾提取 Markdown 格式的推荐问题
function extractQuestionsFromAnswer(answer: string): { cleanedAnswer: string; questions: string[] } {
  // 匹配常见的推荐问题标题模式（带 JSON 数组）
  const patterns = [
    /\n+(?:#{1,4}\s*)?(?:相关|后续|推荐|延伸|进一步)?(?:的)?(?:问题|探索|思考)[:：]?\s*\n*(\[[\s\S]*?\])\s*$/i,
    /\n+(?:\*{1,2})?(?:相关|后续|推荐|延伸|进一步)?(?:的)?(?:问题|探索|思考)(?:\*{1,2})?[:：]?\s*\n*(\[[\s\S]*?\])\s*$/i,
    /\n+(?:你可能还想了解|你可能感兴趣的问题|继续探索)[:：]?\s*\n*(\[[\s\S]*?\])\s*$/i,
  ]

  let cleanedAnswer = answer
  let questions: string[] = []

  for (const pattern of patterns) {
    const match = cleanedAnswer.match(pattern)
    if (match) {
      const extractedQuestions = extractJsonArray(match[1])
      if (extractedQuestions.length > 0) {
        questions = extractedQuestions
        cleanedAnswer = cleanedAnswer.replace(match[0], '').trim()
        break
      }
    }
  }

  // 如果没有匹配到带标题的格式，尝试匹配答案末尾的纯 JSON 数组
  if (questions.length === 0) {
    const trailingArrayMatch = cleanedAnswer.match(/\n+(\[[\s\S]*?\])\s*$/)
    if (trailingArrayMatch) {
      const extractedQuestions = extractJsonArray(trailingArrayMatch[1])
      // 只有当数组内容看起来像问题时才提取（包含问号或长度适中）
      if (extractedQuestions.length >= 3 && extractedQuestions.every(q => q.length > 5 && q.length < 100)) {
        questions = extractedQuestions
        cleanedAnswer = cleanedAnswer.replace(trailingArrayMatch[0], '').trim()
      }
    }
  }

  // 最后清理：移除孤立的推荐问题标题及其后面的列表内容
  // 使用更宽松的模式：匹配包含"问题"、"探索"等关键词的标题
  const orphanedSectionPatterns = [
    // 匹配 --- 分隔线 + 后面的任何包含关键词的标题部分
    /\n+---+\s*\n+#{1,4}\s*[^#\n]*(?:问题|探索|思考|建议)[^#\n]*[\s\S]*$/i,
    /\n+---+\s*\n+[^#\n]*(?:问题|探索|思考|建议)[^#\n]*[\s\S]*$/i,
    // 匹配 ### 标题 + 后面的列表内容
    /\n+#{1,4}\s*[^#\n]*(?:问题|探索|思考|建议)[^#\n]*\n[\s\S]*$/i,
    // 匹配 **加粗标题** + 后面的内容
    /\n+\*{1,2}[^*\n]*(?:问题|探索|思考|建议)[^*\n]*\*{1,2}[:：]?\s*\n[\s\S]*$/i,
    // 匹配其他常见标题格式
    /\n+(?:你可能还想了解|你可能感兴趣的问题|继续探索)[:：]?\s*\n[\s\S]*$/i,
    // 匹配只有标题没有内容的情况（标题在末尾）
    /\n+---+\s*\n*#{1,4}\s*[^#\n]*(?:问题|探索|思考|建议)[^#\n]*[:：]?\s*$/i,
    /\n+#{1,4}\s*[^#\n]*(?:问题|探索|思考|建议)[^#\n]*[:：]?\s*$/i,
    /\n+\*{1,2}[^*\n]*(?:问题|探索|思考|建议)[^*\n]*\*{1,2}[:：]?\s*$/i,
    /\n+(?:你可能还想了解|你可能感兴趣的问题|继续探索)[:：]?\s*$/i,
  ]

  for (const pattern of orphanedSectionPatterns) {
    cleanedAnswer = cleanedAnswer.replace(pattern, '').trim()
  }

  return { cleanedAnswer, questions }
}

// 重新生成推荐问题
const SYSTEM_PROMPT_SUGGESTIONS = `你是一个知识探索助手。根据提供的问答内容，生成5个相关的后续问题供用户继续探索。

要求：
1. **必须**生成恰好5个问题，不能少于5个
2. 问题应该与原问答内容相关，帮助用户深入或扩展理解
3. 问题应该多样化，覆盖不同的探索方向（如：原理、应用、对比、历史、未来趋势等）
4. 问题应该简洁明了
5. 如果有"已探索的问题"列表，不要推荐与其中相同或语义相似的问题

请返回以下JSON格式：
{"questions": ["问题1", "问题2", "问题3", "问题4", "问题5"]}`

export async function regenerateSuggestions(
  question: string,
  answer: string,
  model: AIModel,
  existingQuestions: string[] = []
): Promise<string[]> {
  // 最多重试 2 次
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await attemptGenerateSuggestions(
        question,
        answer,
        model,
        existingQuestions,
        attempt > 0 // 重试时使用更简化的 prompt
      )
      if (result.length > 0) {
        return result
      }
    } catch (error) {
      console.error(`Attempt ${attempt + 1} failed:`, error)
    }
  }

  // 如果都失败了，返回通用的后备问题
  return generateFallbackQuestions(question)
}

async function attemptGenerateSuggestions(
  question: string,
  answer: string,
  model: AIModel,
  existingQuestions: string[],
  simplified: boolean
): Promise<string[]> {
  const { provider, modelId } = getModelConfig(model)
  let userMessage: string

  if (simplified) {
    // 简化版 prompt，减少复杂度
    userMessage = `问题：${question}\n回答：${answer.slice(0, 500)}...\n\n请生成5个相关的后续探索问题。`
  } else {
    userMessage = `原问题：${question}\n\n原回答：${answer}`
    if (existingQuestions.length > 0) {
      // 限制已有问题数量，避免 prompt 过长
      const limitedQuestions = existingQuestions.slice(0, 20)
      userMessage += `\n\n已探索的问题（请勿推荐相同或相似的）：\n${limitedQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}`
    }
    userMessage += `\n\n请生成5个新的后续探索问题。`
  }

  let responseText: string

  if (provider === 'openai') {
    const response = await openai.chat.completions.create({
      model: modelId,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT_SUGGESTIONS },
        { role: 'user', content: userMessage },
      ],
      response_format: { type: 'json_object' },
    })
    responseText = response.choices[0]?.message?.content || '{}'
  } else {
    const response = await anthropic.messages.create({
      model: modelId,
      max_tokens: 1024,
      system: SYSTEM_PROMPT_SUGGESTIONS,
      messages: [{ role: 'user', content: userMessage }],
    })
    const textBlock = response.content.find((block) => block.type === 'text')
    responseText = textBlock?.type === 'text' ? textBlock.text : '{}'
  }

  return parseQuestionsFromResponse(responseText)
}

function parseQuestionsFromResponse(responseText: string): string[] {
  try {
    // 尝试解析为 JSON 对象
    const parsed = JSON.parse(responseText)

    // 处理 {"questions": [...]} 格式
    if (parsed.questions && Array.isArray(parsed.questions)) {
      return parsed.questions.filter((q: unknown) => typeof q === 'string' && q.trim())
    }

    // 处理 {"suggestedQuestions": [...]} 格式
    if (parsed.suggestedQuestions && Array.isArray(parsed.suggestedQuestions)) {
      return parsed.suggestedQuestions.filter((q: unknown) => typeof q === 'string' && q.trim())
    }

    // 处理直接是数组的情况
    if (Array.isArray(parsed)) {
      return parsed.filter((q: unknown) => typeof q === 'string' && q.trim())
    }

    // 尝试从对象中找到任何数组字段
    for (const key of Object.keys(parsed)) {
      if (Array.isArray(parsed[key])) {
        const arr = parsed[key].filter((q: unknown) => typeof q === 'string' && q.trim())
        if (arr.length > 0) return arr
      }
    }
  } catch {
    // JSON 解析失败，尝试提取数组
    const jsonMatch = responseText.match(/\[[\s\S]*?\]/)
    if (jsonMatch) {
      try {
        const arr = JSON.parse(jsonMatch[0])
        if (Array.isArray(arr)) {
          return arr.filter((q: unknown) => typeof q === 'string' && q.trim())
        }
      } catch {
        // 忽略
      }
    }
  }

  return []
}

function generateFallbackQuestions(originalQuestion: string): string[] {
  // 基于原问题生成通用的后续问题模板
  const topic = originalQuestion.slice(0, 50)
  return [
    `${topic}的核心原理是什么？`,
    `${topic}有哪些实际应用场景？`,
    `${topic}的优缺点分别是什么？`,
    `如何进一步学习${topic}？`,
    `${topic}的未来发展趋势是什么？`,
  ]
}
