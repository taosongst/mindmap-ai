import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// 获取单个地图的完整数据
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const map = await prisma.mindMap.findUnique({
      where: { id },
      include: {
        qas: {
          orderBy: { timestamp: 'asc' },
        },
        nodes: {
          where: { isHidden: false },
          include: {
            nodeQAs: {
              include: { qa: true },
              orderBy: { order: 'asc' },
            },
          },
        },
        potentialNodes: true,
      },
    })

    if (!map) {
      return NextResponse.json({ error: 'Map not found' }, { status: 404 })
    }

    // 转换数据格式
    const nodesWithQAs = map.nodes.map((node) => ({
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
        sourceAuthorId: nq.qa.sourceAuthorId,
      })),
    }))

    return NextResponse.json({
      ...map,
      nodes: nodesWithQAs,
      qas: map.qas.map((qa) => ({
        ...qa,
        suggestedQuestions: JSON.parse(qa.suggestedQuestions),
      })),
    })
  } catch (error) {
    console.error('Failed to fetch map:', error)
    return NextResponse.json({ error: 'Failed to fetch map' }, { status: 500 })
  }
}

// 更新地图
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const map = await prisma.mindMap.update({
      where: { id },
      data: body,
    })

    return NextResponse.json(map)
  } catch (error) {
    console.error('Failed to update map:', error)
    return NextResponse.json({ error: 'Failed to update map' }, { status: 500 })
  }
}

// 删除地图
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    await prisma.mindMap.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete map:', error)
    return NextResponse.json({ error: 'Failed to delete map' }, { status: 500 })
  }
}
