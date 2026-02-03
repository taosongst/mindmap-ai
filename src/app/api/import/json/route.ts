import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

interface ChatGPTMessage {
  id: string
  author: {
    role: 'user' | 'assistant' | 'system' | 'tool'
  }
  content: {
    content_type: string
    parts?: string[]
  }
  create_time?: number
}

interface ChatGPTConversation {
  title: string
  mapping: Record<string, {
    id: string
    message?: ChatGPTMessage
    parent?: string
    children?: string[]
  }>
}

export async function POST(request: NextRequest) {
  try {
    const { conversation, mapTitle } = await request.json()

    if (!conversation) {
      return NextResponse.json(
        { error: '请提供对话数据' },
        { status: 400 }
      )
    }

    // 解析 ChatGPT 导出格式
    const messages = parseConversation(conversation)

    if (messages.length === 0) {
      return NextResponse.json(
        { error: '未找到有效的对话内容' },
        { status: 400 }
      )
    }

    // 将消息配对为 Q&A
    const qaPairs = pairMessagesToQA(messages)

    if (qaPairs.length === 0) {
      return NextResponse.json(
        { error: '未找到有效的问答对' },
        { status: 400 }
      )
    }

    // 创建 Map
    const map = await prisma.mindMap.create({
      data: {
        title: mapTitle || conversation.title || 'ChatGPT Import',
      },
    })

    // 创建节点链
    let parentNodeId: string | null = null

    for (let i = 0; i < qaPairs.length; i++) {
      const pair = qaPairs[i]

      const qa = await prisma.qA.create({
        data: {
          mapId: map.id,
          question: pair.question,
          answer: pair.answer,
          suggestedQuestions: '[]',
          timestamp: i,
          source: 'chatgpt',
        },
      })

      const node = await prisma.node.create({
        data: {
          mapId: map.id,
          parentNodeId,
          order: 0,
          nodeQAs: {
            create: {
              qaId: qa.id,
              order: 0,
            },
          },
        },
      })

      parentNodeId = node.id
    }

    return NextResponse.json({
      success: true,
      mapId: map.id,
      mapTitle: map.title,
      qaCount: qaPairs.length,
    })
  } catch (error) {
    console.error('JSON import error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '导入失败' },
      { status: 500 }
    )
  }
}

// 解析 ChatGPT 导出的对话格式
function parseConversation(conv: ChatGPTConversation): { role: 'user' | 'assistant'; content: string }[] {
  const messages: { role: 'user' | 'assistant'; content: string }[] = []

  if (!conv.mapping) {
    return messages
  }

  // 找到根节点并遍历对话树
  const nodes = Object.values(conv.mapping)

  // 按照对话顺序排列消息
  const orderedMessages: { role: 'user' | 'assistant'; content: string; time: number }[] = []

  for (const node of nodes) {
    if (!node.message) continue

    const msg = node.message
    const role = msg.author?.role

    if (role !== 'user' && role !== 'assistant') continue

    const parts = msg.content?.parts
    if (!parts || parts.length === 0) continue

    const content = parts.join('\n').trim()
    if (!content) continue

    orderedMessages.push({
      role,
      content,
      time: msg.create_time || 0,
    })
  }

  // 按时间排序
  orderedMessages.sort((a, b) => a.time - b.time)

  return orderedMessages.map(({ role, content }) => ({ role, content }))
}

// 将消息配对为 Q&A
function pairMessagesToQA(
  messages: { role: 'user' | 'assistant'; content: string }[]
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
      i++
    }
  }

  return pairs
}
