import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// CORS headers for Chrome extension
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

// Handle CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders })
}

interface SyncRequest {
  conversationId: string      // ChatGPT 对话 ID
  conversationTitle: string   // 对话标题
  question: string            // 用户问题
  answer: string              // AI 回答
  messageIndex: number        // 消息序号（用于去重）
}

export async function POST(request: NextRequest) {
  try {
    const body: SyncRequest = await request.json()

    const { conversationId, conversationTitle, question, answer, messageIndex } = body

    // 验证必需字段
    if (!conversationId || !question || !answer || messageIndex === undefined) {
      return NextResponse.json(
        { error: '缺少必需字段' },
        { status: 400, headers: corsHeaders }
      )
    }

    // 查找或创建 MindMap
    let map = await prisma.mindMap.findUnique({
      where: { externalId: conversationId },
      include: {
        qas: {
          orderBy: { timestamp: 'desc' },
          take: 1,
        },
        nodes: {
          orderBy: { order: 'desc' },
          take: 1,
        },
      },
    })

    let isNewMap = false

    if (!map) {
      // 创建新地图
      map = await prisma.mindMap.create({
        data: {
          title: conversationTitle || 'ChatGPT Sync',
          externalId: conversationId,
          lastSyncedAt: new Date(),
        },
        include: {
          qas: true,
          nodes: true,
        },
      })
      isNewMap = true
    }

    // 检查该 Q&A 是否已存在（通过 externalIndex 去重）
    const existingQA = await prisma.qA.findFirst({
      where: {
        mapId: map.id,
        externalIndex: messageIndex,
      },
    })

    if (existingQA) {
      // 已存在，返回成功但标记为非新建
      return NextResponse.json(
        {
          success: true,
          mapId: map.id,
          qaId: existingQA.id,
          isNew: false,
          message: '该消息已同步过',
        },
        { headers: corsHeaders }
      )
    }

    // 获取最后一个节点作为父节点
    const lastNode = await prisma.node.findFirst({
      where: { mapId: map.id },
      orderBy: { order: 'desc' },
    })

    // 计算新的 timestamp
    const lastQA = await prisma.qA.findFirst({
      where: { mapId: map.id },
      orderBy: { timestamp: 'desc' },
    })
    const newTimestamp = (lastQA?.timestamp ?? -1) + 1

    // 创建新的 QA
    const qa = await prisma.qA.create({
      data: {
        mapId: map.id,
        question,
        answer,
        suggestedQuestions: '[]',
        timestamp: newTimestamp,
        source: 'chatgpt',
        externalIndex: messageIndex,
      },
    })

    // 创建新节点并关联 QA
    const newOrder = (lastNode?.order ?? -1) + 1
    await prisma.node.create({
      data: {
        mapId: map.id,
        parentNodeId: lastNode?.id || null,
        order: newOrder,
        nodeQAs: {
          create: {
            qaId: qa.id,
            order: 0,
          },
        },
      },
    })

    // 更新 lastSyncedAt
    await prisma.mindMap.update({
      where: { id: map.id },
      data: { lastSyncedAt: new Date() },
    })

    return NextResponse.json(
      {
        success: true,
        mapId: map.id,
        qaId: qa.id,
        isNew: true,
        isNewMap,
      },
      { headers: corsHeaders }
    )
  } catch (error) {
    console.error('Sync error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '同步失败' },
      { status: 500, headers: corsHeaders }
    )
  }
}
