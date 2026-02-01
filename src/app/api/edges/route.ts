import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// 创建边
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { mapId, sourceNodeId, targetNodeId, edgeType, label, style } = body

    const edge = await prisma.edge.create({
      data: {
        mapId,
        sourceNodeId,
        targetNodeId,
        edgeType: edgeType || 'smoothstep',
        label,
        style: style ? JSON.stringify(style) : null,
        isUserCreated: true,
      },
    })

    return NextResponse.json({
      id: edge.id,
      mapId: edge.mapId,
      sourceNodeId: edge.sourceNodeId,
      targetNodeId: edge.targetNodeId,
      edgeType: edge.edgeType,
      label: edge.label,
      style: edge.style ? JSON.parse(edge.style) : null,
      isUserCreated: edge.isUserCreated,
    })
  } catch (error) {
    console.error('Failed to create edge:', error)
    return NextResponse.json({ error: 'Failed to create edge' }, { status: 500 })
  }
}

// 删除边
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Edge ID required' }, { status: 400 })
    }

    await prisma.edge.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete edge:', error)
    return NextResponse.json({ error: 'Failed to delete edge' }, { status: 500 })
  }
}
