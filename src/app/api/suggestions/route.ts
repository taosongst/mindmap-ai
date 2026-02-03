import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { regenerateSuggestions } from '@/lib/ai'
import { AIProvider } from '@/types'

// 重新生成推荐问题
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      nodeId,
      provider = 'openai',
    }: {
      nodeId: string
      provider?: AIProvider
    } = body

    // 获取节点和关联的 QA
    const node = await prisma.node.findUnique({
      where: { id: nodeId },
      include: {
        nodeQAs: {
          include: { qa: true },
          orderBy: { order: 'asc' },
        },
      },
    })

    if (!node) {
      return NextResponse.json({ error: 'Node not found' }, { status: 404 })
    }

    const primaryQA = node.nodeQAs[0]?.qa
    if (!primaryQA) {
      return NextResponse.json({ error: 'No QA found for node' }, { status: 404 })
    }

    // 调用 AI 重新生成推荐问题
    const suggestedQuestions = await regenerateSuggestions(
      primaryQA.question,
      primaryQA.answer,
      provider
    )

    // 删除旧的 AI 推荐的潜在节点
    await prisma.potentialNode.deleteMany({
      where: {
        parentNodeId: nodeId,
        source: 'ai',
      },
    })

    // 创建新的潜在节点
    if (suggestedQuestions.length > 0) {
      await prisma.potentialNode.createMany({
        data: suggestedQuestions.map((q) => ({
          mapId: node.mapId,
          parentNodeId: nodeId,
          question: q,
          source: 'ai',
        })),
      })
    }

    // 获取新创建的潜在节点
    const newPotentialNodes = await prisma.potentialNode.findMany({
      where: {
        parentNodeId: nodeId,
        source: 'ai',
      },
    })

    return NextResponse.json({
      success: true,
      potentialNodes: newPotentialNodes.map((p) => ({
        id: p.id,
        mapId: p.mapId,
        parentNodeId: p.parentNodeId,
        question: p.question,
        source: p.source,
      })),
    })
  } catch (error) {
    console.error('Failed to regenerate suggestions:', error)
    return NextResponse.json(
      { error: 'Failed to regenerate suggestions' },
      { status: 500 }
    )
  }
}
