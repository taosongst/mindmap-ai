'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useParams } from 'next/navigation'
import { MindMap } from '@/components/MindMap/MindMap'
import { ChatPanel } from '@/components/ChatPanel/ChatPanel'
import { QADirectory } from '@/components/QADirectory/QADirectory'
import { useMapStore } from '@/hooks/useMapStore'

export default function MapPage() {
  const params = useParams()
  const mapId = params.id as string
  const [error, setError] = useState<string | null>(null)

  const {
    setMapData,
    addNode,
    addQA,
    addPotentialNodes,
    selectedNodeId,
    nodes,
    aiProvider,
    title,
    startStreaming,
    appendStreamingAnswer,
    finishStreaming,
  } = useMapStore()

  // 加载地图数据
  useEffect(() => {
    async function loadMap() {
      try {
        const response = await fetch(`/api/maps/${mapId}`)
        if (!response.ok) throw new Error('Failed to load map')

        const data = await response.json()
        setMapData({
          id: data.id,
          title: data.title,
          nodes: data.nodes,
          potentialNodes: data.potentialNodes,
          qas: data.qas,
          edges: data.edges,
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load map')
      }
    }

    loadMap()
  }, [mapId, setMapData])

  // 获取选中的节点
  const selectedNode = useMemo(() => {
    return nodes.find((n) => n.id === selectedNodeId) || null
  }, [nodes, selectedNodeId])

  // 处理提问（流式版本）
  const handleAskQuestion = useCallback(
    async (question: string, parentNodeId?: string) => {
      setError(null)
      startStreaming(question, parentNodeId)

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
          },
          body: JSON.stringify({
            mapId,
            parentNodeId: parentNodeId || selectedNodeId,
            question,
            provider: aiProvider,
          }),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to get response')
        }

        const reader = response.body?.getReader()
        if (!reader) {
          throw new Error('No response body')
        }

        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })

          // 解析 SSE 格式
          const lines = buffer.split('\n\n')
          buffer = lines.pop() || '' // 保留不完整的行

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6))

                if (data.error) {
                  throw new Error(data.error)
                }

                if (data.chunk) {
                  // 流式 chunk - 直接追加，显示时会过滤分隔符
                  appendStreamingAnswer(data.chunk)
                }

                if (data.done) {
                  // 完成 - 更新 store
                  finishStreaming()
                  addQA(data.qa)
                  addNode(data.node)

                  // 添加潜在节点
                  if (data.suggestedQuestions?.length > 0) {
                    addPotentialNodes(
                      data.suggestedQuestions.map(
                        (q: string, i: number) => ({
                          id: `${data.node.id}-suggestion-${i}`,
                          mapId,
                          parentNodeId: data.node.id,
                          question: q,
                          source: 'ai' as const,
                        })
                      )
                    )
                  }
                }
              } catch (parseError) {
                console.error('Parse error:', parseError)
              }
            }
          }
        }
      } catch (err) {
        finishStreaming()
        setError(err instanceof Error ? err.message : 'Failed to process question')
      }
    },
    [
      mapId,
      selectedNodeId,
      aiProvider,
      startStreaming,
      appendStreamingAnswer,
      finishStreaming,
      addQA,
      addNode,
      addPotentialNodes,
    ]
  )

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* 顶部导航 */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <a href="/" className="text-gray-400 hover:text-gray-600">
            ← 返回
          </a>
          <h1 className="text-lg font-medium text-gray-800">
            {title || '加载中...'}
          </h1>
        </div>
      </header>

      {/* 主体区域 - 三栏布局 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左侧栏：问答目录 + MiniMap */}
        <div className="w-[280px] flex flex-col border-r border-gray-200 bg-white flex-shrink-0">
          {/* 问答目录 */}
          <div className="flex-1 overflow-hidden">
            <QADirectory />
          </div>

          {/* MiniMap 区域 */}
          <div className="h-[180px] border-t border-gray-200 bg-gray-50 relative">
            <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">
              <div className="text-center">
                <div className="text-2xl mb-1">🗺️</div>
                <div>缩略图</div>
              </div>
            </div>
          </div>
        </div>

        {/* 中间：思维导图 */}
        <div className="flex-1 overflow-hidden">
          <MindMap onAskQuestion={handleAskQuestion} />
        </div>

        {/* 右侧栏：对话面板 */}
        <ChatPanel
          selectedNode={selectedNode}
          onAskQuestion={handleAskQuestion}
        />
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="bg-red-50 border-t border-red-200 px-4 py-2 flex items-center justify-between flex-shrink-0">
          <span className="text-red-600 text-sm">{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-red-400 hover:text-red-600"
          >
            ×
          </button>
        </div>
      )}
    </div>
  )
}
