import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// 获取所有地图
export async function GET() {
  try {
    const maps = await prisma.mindMap.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: {
          select: { qas: true, nodes: true },
        },
      },
    })
    return NextResponse.json(maps)
  } catch (error) {
    console.error('Failed to fetch maps:', error)
    return NextResponse.json({ error: 'Failed to fetch maps' }, { status: 500 })
  }
}

// 创建新地图
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, initialQuestion } = body

    // 创建地图
    const map = await prisma.mindMap.create({
      data: {
        title: title || '新的探索',
      },
    })

    // 如果有初始问题，创建根节点占位（实际问答在chat API中创建）
    if (initialQuestion) {
      await prisma.node.create({
        data: {
          mapId: map.id,
          order: 0,
        },
      })
    }

    return NextResponse.json(map)
  } catch (error) {
    console.error('Failed to create map:', error)
    return NextResponse.json({ error: 'Failed to create map' }, { status: 500 })
  }
}
