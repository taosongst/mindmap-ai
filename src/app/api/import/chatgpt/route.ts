import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { scrapeChatGPTShare, pairMessagesToQA } from '@/lib/chatgpt-scraper'
import type { Node } from '@prisma/client'

export const maxDuration = 60 // Vercel Pro 最大超时时间

export async function POST(request: NextRequest) {
  try {
    const { shareUrl, mapTitle } = await request.json()

    if (!shareUrl) {
      return NextResponse.json(
        { error: '请提供 ChatGPT 分享链接' },
        { status: 400 }
      )
    }

    // 尝试抓取对话
    const conversation = await scrapeChatGPTShare(shareUrl)

    if (!conversation) {
      return NextResponse.json(
        {
          error: '无法获取对话内容',
          fallback: 'manual',
          message: '抓取失败，可能是 Cloudflare 保护或链接无效。请尝试手动导出 JSON。',
        },
        { status: 400 }
      )
    }

    if (conversation.messages.length === 0) {
      return NextResponse.json(
        {
          error: '对话内容为空',
          fallback: 'manual',
        },
        { status: 400 }
      )
    }

    // 将消息配对为 Q&A
    const qaPairs = pairMessagesToQA(conversation.messages)

    if (qaPairs.length === 0) {
      return NextResponse.json(
        {
          error: '未找到有效的问答对',
          fallback: 'manual',
        },
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
    const createdNodes: { nodeId: string; qaId: string; question: string }[] = []
    let lastNodeId: string | null = null

    for (let i = 0; i < qaPairs.length; i++) {
      const pair = qaPairs[i]
      const currentParentId: string | null = lastNodeId

      // 创建 QA 记录
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

      // 创建节点并关联 QA
      const node: Node = await prisma.node.create({
        data: {
          mapId: map.id,
          parentNodeId: currentParentId,
          order: 0,
          nodeQAs: {
            create: {
              qaId: qa.id,
              order: 0,
            },
          },
        },
      })

      createdNodes.push({
        nodeId: node.id,
        qaId: qa.id,
        question: pair.question.slice(0, 50) + (pair.question.length > 50 ? '...' : ''),
      })

      lastNodeId = node.id
    }

    return NextResponse.json({
      success: true,
      mapId: map.id,
      mapTitle: map.title,
      qaCount: qaPairs.length,
      preview: createdNodes.slice(0, 5), // 返回前 5 个节点预览
    })
  } catch (error) {
    console.error('ChatGPT import error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : '导入失败',
        fallback: 'manual',
      },
      { status: 500 }
    )
  }
}
