import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { chat, chatStream } from '@/lib/ai'
import { ChatMessage, AIModel } from '@/types'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      mapId,
      parentNodeId,
      question,
      model = 'gpt-4o-mini',
    }: {
      mapId: string
      parentNodeId?: string
      question: string
      model?: AIModel
    } = body

    // 检测是否请求流式响应
    const isStreaming = request.headers.get('Accept') === 'text/event-stream'

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

    if (isStreaming) {
      // 流式响应模式
      const encoder = new TextEncoder()

      const stream = new ReadableStream({
        async start(controller) {
          try {
            // 流式调用 AI，每个 chunk 都发送给客户端
            const { answer, suggestedQuestions } = await chatStream(
              messages,
              model,
              (chunk) => {
                // 发送 chunk 给客户端
                const data = JSON.stringify({ chunk })
                controller.enqueue(encoder.encode(`data: ${data}\n\n`))
              }
            )

            // 计算新问答的 timestamp
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

            // 删除旧的潜在节点
            if (parentNodeId) {
              await prisma.potentialNode.deleteMany({
                where: {
                  parentNodeId,
                  question,
                },
              })
            }

            // 创建新的潜在节点
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

            // 发送完成信号和完整数据
            const doneData = JSON.stringify({
              done: true,
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
            controller.enqueue(encoder.encode(`data: ${doneData}\n\n`))
            controller.close()
          } catch (error) {
            console.error('Stream error:', error)
            const errorData = JSON.stringify({
              error: error instanceof Error ? error.message : 'Unknown error',
            })
            controller.enqueue(encoder.encode(`data: ${errorData}\n\n`))
            controller.close()
          }
        },
      })

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      })
    } else {
      // 非流式响应模式（保持兼容）
      const { answer, suggestedQuestions } = await chat(messages, model)

      const newTimestamp = map.qas.length

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

      if (parentNodeId) {
        await prisma.potentialNode.deleteMany({
          where: {
            parentNodeId,
            question,
          },
        })
      }

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
    }
  } catch (error) {
    console.error('Chat error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: `Failed to process chat: ${errorMessage}` },
      { status: 500 }
    )
  }
}
