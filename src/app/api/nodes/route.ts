import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// 更新节点（位置、隐藏状态等）
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, positionX, positionY, isHidden, parentNodeId } = body

    const updateData: Record<string, unknown> = {}
    if (positionX !== undefined) updateData.positionX = positionX
    if (positionY !== undefined) updateData.positionY = positionY
    if (isHidden !== undefined) updateData.isHidden = isHidden
    if (parentNodeId !== undefined) updateData.parentNodeId = parentNodeId

    const node = await prisma.node.update({
      where: { id },
      data: updateData,
      include: {
        nodeQAs: {
          include: { qa: true },
          orderBy: { order: 'asc' },
        },
      },
    })

    return NextResponse.json({
      id: node.id,
      mapId: node.mapId,
      parentNodeId: node.parentNodeId,
      positionX: node.positionX,
      positionY: node.positionY,
      isHidden: node.isHidden,
      order: node.order,
      qas: node.nodeQAs.map((nq) => ({
        id: nq.qa.id,
        mapId: nq.qa.mapId,
        question: nq.qa.question,
        answer: nq.qa.answer,
        suggestedQuestions: JSON.parse(nq.qa.suggestedQuestions),
        timestamp: nq.qa.timestamp,
        source: nq.qa.source,
      })),
    })
  } catch (error) {
    console.error('Failed to update node:', error)
    return NextResponse.json(
      { error: 'Failed to update node' },
      { status: 500 }
    )
  }
}

// 合并节点
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { sourceNodeId, targetNodeId } = body

    // 获取源节点的问答
    const sourceNode = await prisma.node.findUnique({
      where: { id: sourceNodeId },
      include: {
        nodeQAs: true,
        children: true,
      },
    })

    if (!sourceNode) {
      return NextResponse.json(
        { error: 'Source node not found' },
        { status: 404 }
      )
    }

    // 获取目标节点现有问答数量
    const targetNodeQACount = await prisma.nodeQA.count({
      where: { nodeId: targetNodeId },
    })

    // 将源节点的问答移动到目标节点
    await prisma.nodeQA.updateMany({
      where: { nodeId: sourceNodeId },
      data: { nodeId: targetNodeId },
    })

    // 更新移动后的问答顺序
    const movedQAs = await prisma.nodeQA.findMany({
      where: {
        nodeId: targetNodeId,
        node: { id: targetNodeId },
      },
    })

    for (let i = 0; i < movedQAs.length; i++) {
      if (movedQAs[i].order < targetNodeQACount) continue
      await prisma.nodeQA.update({
        where: { id: movedQAs[i].id },
        data: { order: targetNodeQACount + i },
      })
    }

    // 将源节点的子节点移动到目标节点
    await prisma.node.updateMany({
      where: { parentNodeId: sourceNodeId },
      data: { parentNodeId: targetNodeId },
    })

    // 隐藏源节点
    await prisma.node.update({
      where: { id: sourceNodeId },
      data: { isHidden: true },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to merge nodes:', error)
    return NextResponse.json(
      { error: 'Failed to merge nodes' },
      { status: 500 }
    )
  }
}
