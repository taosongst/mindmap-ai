import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { chat } from '@/lib/ai'
import { ChatMessage, AIProvider } from '@/types'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      mapId,
      parentNodeId,
      question,
      provider = 'openai',
    }: {
      mapId: string
      parentNodeId?: string
      question: string
      provider?: AIProvider
    } = body

    // 获取地图和现有的问答作为上下文
    const map = await prisma.mindMap.findUnique({
      where: { id: mapId },
      include: {
        qas: {
          orderBy: { timestamp: 'asc' },
        },
      },
    })

    if (!map) {
      return NextResponse.json({ error: 'Map not found' }, { status: 404 })
    }

    // 构建消息历史
    const messages: ChatMessage[] = map.qas.flatMap((qa) => [
      { role: 'user' as const, content: qa.question },
      { role: 'assistant' as const, content: qa.answer },
    ])

    // 添加新问题
    messages.push({ role: 'user', content: question })

    // 调用AI
    const { answer, suggestedQuestions } = await chat(messages, provider)

    // 计算新问答的timestamp
    const newTimestamp = map.qas.length

    // 创建问答记录
    const qa = await prisma.qA.create({
      data: {
        mapId,
        question,
        answer,
        suggestedQuestions: JSON.stringify(suggestedQuestions),
        timestamp: newTimestamp,
        source: 'user',
      },
    })

    // 创建节点
    const node = await prisma.node.create({
      data: {
        mapId,
        parentNodeId: parentNodeId || null,
        order: 0,
        nodeQAs: {
          create: {
            qaId: qa.id,
            order: 0,
          },
        },
      },
    })

    // 删除旧的潜在节点（如果是从潜在节点触发的）
    if (parentNodeId) {
      await prisma.potentialNode.deleteMany({
        where: {
          parentNodeId,
          question,
        },
      })
    }

    // 创建新的潜在节点（基于AI推荐）
    if (suggestedQuestions.length > 0) {
      await prisma.potentialNode.createMany({
        data: suggestedQuestions.map((q) => ({
          mapId,
          parentNodeId: node.id,
          question: q,
          source: 'ai',
        })),
      })
    }

    // 返回结果
    return NextResponse.json({
      answer,
      suggestedQuestions,
      qa: {
        id: qa.id,
        mapId: qa.mapId,
        question: qa.question,
        answer: qa.answer,
        suggestedQuestions,
        timestamp: qa.timestamp,
        source: qa.source,
      },
      node: {
        id: node.id,
        mapId: node.mapId,
        parentNodeId: node.parentNodeId,
        positionX: node.positionX,
        positionY: node.positionY,
        isHidden: node.isHidden,
        order: node.order,
        qas: [
          {
            id: qa.id,
            mapId: qa.mapId,
            question: qa.question,
            answer: qa.answer,
            suggestedQuestions,
            timestamp: qa.timestamp,
            source: qa.source,
          },
        ],
      },
    })
  } catch (error) {
    console.error('Chat error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: `Failed to process chat: ${errorMessage}` },
      { status: 500 }
    )
  }
}
