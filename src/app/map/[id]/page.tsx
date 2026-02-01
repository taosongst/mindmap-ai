'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { MindMap } from '@/components/MindMap/MindMap'
import { ChatInput } from '@/components/ChatInput/ChatInput'
import { QADirectory } from '@/components/QADirectory/QADirectory'
import { useMapStore } from '@/hooks/useMapStore'

export default function MapPage() {
  const params = useParams()
  const mapId = params.id as string
  const [isDirectoryOpen, setIsDirectoryOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const {
    setMapData,
    addNode,
    addQA,
    addPotentialNodes,
    selectedNodeId,
    setLoading,
    aiProvider,
    title,
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
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load map')
      }
    }

    loadMap()
  }, [mapId, setMapData])

  // 处理提问
  const handleAskQuestion = useCallback(
    async (question: string, parentNodeId?: string) => {
      setLoading(true)
      setError(null)

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mapId,
            parentNodeId: parentNodeId || selectedNodeId,
            question,
            provider: aiProvider,
          }),
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Failed to get response')
        }

        // 更新store
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
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to process question')
      } finally {
        setLoading(false)
      }
    },
    [mapId, selectedNodeId, aiProvider, setLoading, addQA, addNode, addPotentialNodes]
  )

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* 顶部导航 */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <a href="/" className="text-gray-400 hover:text-gray-600">
            ← 返回
          </a>
          <h1 className="text-lg font-medium text-gray-800">
            {title || '加载中...'}
          </h1>
        </div>

        <button
          onClick={() => setIsDirectoryOpen(true)}
          className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded flex items-center gap-2"
        >
          <span>📋</span>
          <span>问答目录</span>
        </button>
      </header>

      {/* 思维导图区域 */}
      <div className="flex-1">
        <MindMap onAskQuestion={handleAskQuestion} />
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="bg-red-50 border-t border-red-200 px-4 py-2 flex items-center justify-between">
          <span className="text-red-600 text-sm">{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-red-400 hover:text-red-600"
          >
            ×
          </button>
        </div>
      )}

      {/* 输入区域 */}
      <ChatInput
        onSubmit={(question) => handleAskQuestion(question)}
        placeholder="输入你想探索的问题..."
      />

      {/* 问答目录 */}
      <QADirectory
        isOpen={isDirectoryOpen}
        onClose={() => setIsDirectoryOpen(false)}
      />
    </div>
  )
}
