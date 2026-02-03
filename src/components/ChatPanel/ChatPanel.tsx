'use client'

import { useState, FormEvent, useEffect, useRef } from 'react'
import { useMapStore } from '@/hooks/useMapStore'
import { NodeData, QAData, PotentialNodeData, AI_MODELS } from '@/types'
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer'

type TabMode = 'chat' | 'node'

interface ChatPanelProps {
  selectedNode: NodeData | null
  onAskQuestion: (question: string, parentNodeId?: string) => void
  isCollapsed: boolean
  onToggleCollapse: () => void
  width?: number
}

export function ChatPanel({
  selectedNode,
  onAskQuestion,
  isCollapsed,
  onToggleCollapse,
  width,
}: ChatPanelProps) {
  const [input, setInput] = useState('')
  const [activeTab, setActiveTab] = useState<TabMode>('chat')
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const prevSelectedNodeId = useRef<string | null>(null)

  const [isRegenerating, setIsRegenerating] = useState(false)

  const {
    isLoading,
    isStreaming,
    currentQuestion,
    streamingAnswer,
    aiModel,
    setAIModel,
    allQAs,
    potentialNodes,
    usedPotentialIds,
    markPotentialAsUsed,
    replacePotentialNodes,
  } = useMapStore()

  // 当选中节点变化时，自动切换标签
  useEffect(() => {
    if (selectedNode && selectedNode.id !== prevSelectedNodeId.current) {
      // 选中新节点 -> 切换到节点模式
      setActiveTab('node')
    } else if (!selectedNode && prevSelectedNodeId.current) {
      // 取消选中 -> 切换回对话模式
      setActiveTab('chat')
    }
    prevSelectedNodeId.current = selectedNode?.id || null
  }, [selectedNode])

  // 当开始流式响应时，切换到对话模式
  useEffect(() => {
    if (isStreaming) {
      setActiveTab('chat')
    }
  }, [isStreaming])

  // 自动定位到底部（无动画）- 使用 scrollTop 避免滚动整个页面
  useEffect(() => {
    if (activeTab === 'chat' && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight
    }
  }, [streamingAnswer, allQAs, activeTab, isStreaming])

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    // 在节点模式下，如果有选中节点，新问题自动连接到该节点
    const parentNodeId = activeTab === 'node' && selectedNode ? selectedNode.id : undefined
    onAskQuestion(input.trim(), parentNodeId)
    setInput('')
  }

  // 获取选中节点的潜在子节点
  const nodePotentials = selectedNode
    ? potentialNodes.filter((p) => p.parentNodeId === selectedNode.id)
    : []

  // 处理潜在节点点击
  const handlePotentialClick = (potential: PotentialNodeData) => {
    markPotentialAsUsed(potential.id)
    onAskQuestion(potential.question, potential.parentNodeId)
  }

  // 重新生成推荐问题
  const handleRegenerateSuggestions = async () => {
    if (!selectedNode || isRegenerating) return

    setIsRegenerating(true)
    try {
      const response = await fetch('/api/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodeId: selectedNode.id,
          model: aiModel,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        replacePotentialNodes(selectedNode.id, data.potentialNodes)
      }
    } catch (error) {
      console.error('Failed to regenerate suggestions:', error)
    } finally {
      setIsRegenerating(false)
    }
  }

  // 折叠状态下只显示一个收缩按钮
  if (isCollapsed) {
    return (
      <div className="w-10 flex flex-col items-center border-l border-gray-200 bg-white">
        <button
          onClick={onToggleCollapse}
          className="mt-4 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
          title="展开对话面板"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="mt-4 writing-vertical text-xs text-gray-400">对话面板</div>
      </div>
    )
  }

  return (
    <div style={{ width: width || 380 }} className="flex flex-col bg-white h-full flex-shrink-0 min-h-0">
      {/* 头部：标签切换 + 折叠按钮 */}
      <div className="flex items-center justify-between border-b border-gray-200 px-2">
        <div className="flex">
          <button
            onClick={() => setActiveTab('chat')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'chat'
                ? 'text-blue-600 border-blue-600'
                : 'text-gray-500 border-transparent hover:text-gray-700'
            }`}
          >
            对话模式
          </button>
          <button
            onClick={() => setActiveTab('node')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'node'
                ? 'text-blue-600 border-blue-600'
                : 'text-gray-500 border-transparent hover:text-gray-700'
            }`}
          >
            节点模式
          </button>
        </div>
        <button
          onClick={onToggleCollapse}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
          title="收起面板"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* 内容区域 */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto min-h-0">
        {activeTab === 'chat' ? (
          // ========== 对话模式 ==========
          <div className="p-4 space-y-4">
            {/* 所有历史对话 */}
            {allQAs.map((qa: QAData) => (
              <div key={qa.id} className="space-y-3">
                {/* 用户问题 */}
                <div className="flex justify-end">
                  <div className="bg-blue-500 text-white px-4 py-2 rounded-2xl rounded-tr-sm max-w-[85%]">
                    <p className="text-sm">{qa.question}</p>
                  </div>
                </div>
                {/* AI 回答 */}
                <div className="flex justify-start">
                  <div className="bg-gray-100 px-4 py-2 rounded-2xl rounded-tl-sm max-w-[85%]">
                    <MarkdownRenderer
                      content={qa.answer}
                      className="text-sm text-gray-800 prose prose-sm max-w-none"
                    />
                    {/* 推荐问题 */}
                    {qa.suggestedQuestions && qa.suggestedQuestions.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <p className="text-xs text-gray-500 mb-2">继续探索：</p>
                        <div className="flex flex-wrap gap-1">
                          {qa.suggestedQuestions.slice(0, 3).map((sq, i) => (
                            <button
                              key={i}
                              onClick={() => onAskQuestion(sq)}
                              disabled={isLoading}
                              className="text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-2 py-1 rounded-full border border-blue-200 disabled:opacity-50"
                            >
                              {sq.length > 25 ? sq.slice(0, 25) + '...' : sq}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* 当前流式响应 */}
            {isStreaming && (
              <div className="space-y-3">
                {/* 用户问题 */}
                <div className="flex justify-end">
                  <div className="bg-blue-500 text-white px-4 py-2 rounded-2xl rounded-tr-sm max-w-[85%]">
                    <p className="text-sm">{currentQuestion}</p>
                  </div>
                </div>
                {/* AI 回答（流式） */}
                <div className="flex justify-start">
                  <div className="bg-gray-100 px-4 py-2 rounded-2xl rounded-tl-sm max-w-[85%]">
                    <MarkdownRenderer
                      content={streamingAnswer.split('---SUGGESTIONS---')[0]}
                      className="text-sm text-gray-800 prose prose-sm max-w-none"
                    />
                    <span className="inline-block w-2 h-4 bg-gray-400 animate-pulse ml-0.5" />
                  </div>
                </div>
              </div>
            )}

            {/* 空状态 */}
            {allQAs.length === 0 && !isStreaming && (
              <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
                <div className="text-center">
                  <div className="text-3xl mb-2">💬</div>
                  <p>输入问题开始探索</p>
                </div>
              </div>
            )}

          </div>
        ) : (
          // ========== 节点模式 ==========
          <div className="p-4">
            {selectedNode ? (
              <div className="space-y-4">
                {/* 节点信息 */}
                <div className="bg-blue-50 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-blue-800 mb-2">当前节点</h3>
                  {selectedNode.qas.map((qa: QAData) => (
                    <div key={qa.id} className="space-y-2">
                      <p className="text-sm font-medium text-gray-800">{qa.question}</p>
                      <MarkdownRenderer
                        content={qa.answer}
                        className="text-sm text-gray-600 prose prose-sm max-w-none"
                      />
                    </div>
                  ))}
                </div>

                {/* 重新生成推荐问题按钮 */}
                <button
                  onClick={handleRegenerateSuggestions}
                  disabled={isRegenerating || isLoading}
                  className="w-full py-2 px-4 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {isRegenerating ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="none"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                      生成中...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      重新生成推荐问题
                    </>
                  )}
                </button>

                {/* 潜在子节点（AI推荐的后续问题） */}
                {nodePotentials.length > 0 && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="text-sm font-medium text-gray-700 mb-3">
                      继续探索
                    </h3>
                    <div className="space-y-2">
                      {nodePotentials.map((potential) => {
                        const isUsed = usedPotentialIds.has(potential.id)
                        return (
                          <button
                            key={potential.id}
                            onClick={() => !isUsed && handlePotentialClick(potential)}
                            disabled={isUsed || isLoading}
                            className={`w-full text-left p-3 rounded-lg border transition-colors ${
                              isUsed
                                ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                                : 'bg-white border-gray-200 hover:border-blue-300 hover:bg-blue-50 text-gray-700'
                            }`}
                          >
                            <div className="flex items-start gap-2">
                              <span className="text-blue-500 mt-0.5">→</span>
                              <span className="text-sm">{potential.question}</span>
                            </div>
                            {isUsed && (
                              <span className="text-xs text-gray-400 ml-5">已探索</span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* 推荐问题（来自最后一个QA） */}
                {selectedNode.qas.length > 0 && (
                  <div className="text-xs text-gray-400 mt-4">
                    点击上方问题或输入自定义问题继续探索
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
                <div className="text-center">
                  <div className="text-3xl mb-2">👆</div>
                  <p>点击思维导图中的节点</p>
                  <p className="mt-1">查看详情和继续探索</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 输入区域 - 固定在底部 */}
      <div className="border-t border-gray-200 p-4 bg-white">
        <form onSubmit={handleSubmit} className="space-y-3">
          {/* AI 模型选择器 */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">模型:</span>
            <select
              value={aiModel}
              onChange={(e) => setAIModel(e.target.value as typeof aiModel)}
              className="px-2 py-1 text-xs border border-gray-200 rounded bg-gray-50 text-gray-600"
              disabled={isLoading}
            >
              {AI_MODELS.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name} ({model.description})
                </option>
              ))}
            </select>
          </div>

          {/* 输入框和发送按钮 */}
          <div className="flex gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSubmit(e)
                }
              }}
              placeholder="输入你的问题..."
              disabled={isLoading}
              rows={3}
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-400 resize-none"
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors self-end"
            >
              {isLoading ? (
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
              ) : (
                '发送'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
