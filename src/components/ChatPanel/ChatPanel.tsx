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
  isFullWidth?: boolean
}

export function ChatPanel({
  selectedNode,
  onAskQuestion,
  isCollapsed,
  onToggleCollapse,
  width,
  isFullWidth = false,
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
      setActiveTab('node')
    } else if (!selectedNode && prevSelectedNodeId.current) {
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

  // 自动定位到底部
  useEffect(() => {
    if (activeTab === 'chat' && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight
    }
  }, [streamingAnswer, allQAs, activeTab, isStreaming])

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const parentNodeId = activeTab === 'node' && selectedNode ? selectedNode.id : undefined
    onAskQuestion(input.trim(), parentNodeId)
    setInput('')
  }

  const nodePotentials = selectedNode
    ? potentialNodes.filter((p) => p.parentNodeId === selectedNode.id)
    : []

  const handlePotentialClick = (potential: PotentialNodeData) => {
    markPotentialAsUsed(potential.id)
    onAskQuestion(potential.question, potential.parentNodeId)
  }

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

  // 折叠状态
  if (isCollapsed) {
    return (
      <div className="w-10 flex flex-col items-center border-l border-[#444] bg-[#212121]">
        <button
          onClick={onToggleCollapse}
          className="mt-4 p-2 text-[#888] hover:text-[#ccc] hover:bg-[#2f2f2f] rounded"
          title="展开对话面板"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="mt-4 writing-vertical text-xs text-[#888]">对话面板</div>
      </div>
    )
  }

  return (
    <div
      style={isFullWidth ? undefined : { width: width || 380 }}
      className={`flex flex-col h-full min-h-0 bg-[#212121] ${isFullWidth ? 'flex-1' : 'flex-shrink-0'}`}
    >
      {/* 头部：标签切换 */}
      <div className="flex items-center justify-between px-2 border-b border-[#444]">
        <div className="flex">
          <button
            onClick={() => setActiveTab('chat')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'chat'
                ? 'text-white border-white'
                : 'text-[#888] border-transparent hover:text-[#ccc]'
            }`}
          >
            对话模式
          </button>
          <button
            onClick={() => setActiveTab('node')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'node'
                ? 'text-white border-white'
                : 'text-[#888] border-transparent hover:text-[#ccc]'
            }`}
          >
            节点模式
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#888] px-2 py-1 bg-[#2f2f2f] rounded">
            按 Tab 切换视图
          </span>
          {!isFullWidth && (
            <button
              onClick={onToggleCollapse}
              className="p-2 text-[#888] hover:text-[#ccc] hover:bg-[#2f2f2f] rounded"
              title="收起面板"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* 内容区域 */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto min-h-0 bg-[#212121]">
        {activeTab === 'chat' ? (
          // ========== 对话模式 ==========
          <div className={`py-6 space-y-6 ${isFullWidth ? 'max-w-3xl mx-auto' : ''} px-4`}>
            {allQAs.map((qa: QAData) => (
              <div key={qa.id} className="space-y-6">
                {/* 用户问题 */}
                <div className="flex justify-end">
                  <div className="bg-[#2f2f2f] text-[#ececec] px-5 py-3 rounded-3xl max-w-[85%]">
                    <p className="text-base leading-relaxed">{qa.question}</p>
                  </div>
                </div>
                {/* AI 回答 */}
                <div className="flex justify-start">
                  <div className="text-[#ececec] max-w-full">
                    <MarkdownRenderer
                      content={qa.answer}
                      className="text-base text-[#ececec] prose prose-invert max-w-none leading-relaxed"
                      darkMode={true}
                    />
                    {/* 推荐问题 */}
                    {qa.suggestedQuestions && qa.suggestedQuestions.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-[#444]">
                        <p className="text-xs text-[#888] mb-3">继续探索：</p>
                        <div className="flex flex-wrap gap-2">
                          {qa.suggestedQuestions.slice(0, 3).map((sq, i) => (
                            <button
                              key={i}
                              onClick={() => onAskQuestion(sq)}
                              disabled={isLoading}
                              className="text-sm px-3 py-2 rounded-xl border text-[#ececec] border-[#444] hover:bg-[#2f2f2f] transition-colors disabled:opacity-50"
                            >
                              {sq.length > 40 ? sq.slice(0, 40) + '...' : sq}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* 流式响应 */}
            {isStreaming && (
              <div className="space-y-6">
                <div className="flex justify-end">
                  <div className="bg-[#2f2f2f] text-[#ececec] px-5 py-3 rounded-3xl max-w-[85%]">
                    <p className="text-base leading-relaxed">{currentQuestion}</p>
                  </div>
                </div>
                <div className="flex justify-start">
                  <div className="text-[#ececec] max-w-full">
                    <MarkdownRenderer
                      content={streamingAnswer.split('---SUGGESTIONS---')[0]}
                      className="text-base text-[#ececec] prose prose-invert max-w-none leading-relaxed"
                      darkMode={true}
                    />
                    <span className="inline-block w-2 h-5 bg-[#ececec] animate-pulse ml-0.5" />
                  </div>
                </div>
              </div>
            )}

            {/* 空状态 */}
            {allQAs.length === 0 && !isStreaming && (
              <div className="flex items-center justify-center h-60 text-[#888]">
                <div className="text-center">
                  <div className="text-4xl mb-3">💬</div>
                  <p className="text-lg">输入问题开始探索</p>
                </div>
              </div>
            )}
          </div>
        ) : (
          // ========== 节点模式 ==========
          <div className={`py-6 ${isFullWidth ? 'max-w-3xl mx-auto' : ''} px-4`}>
            {selectedNode ? (
              <div className="space-y-6">
                {/* 节点问答 */}
                {selectedNode.qas.map((qa: QAData) => (
                  <div key={qa.id} className="space-y-6">
                    {/* 用户问题 */}
                    <div className="flex justify-end">
                      <div className="bg-[#2f2f2f] text-[#ececec] px-5 py-3 rounded-3xl max-w-[85%]">
                        <p className="text-base leading-relaxed">{qa.question}</p>
                      </div>
                    </div>
                    {/* AI 回答 */}
                    <div className="flex justify-start">
                      <div className="text-[#ececec] max-w-full">
                        <MarkdownRenderer
                          content={qa.answer}
                          className="text-base text-[#ececec] prose prose-invert max-w-none leading-relaxed"
                          darkMode={true}
                        />
                      </div>
                    </div>
                  </div>
                ))}

                {/* 重新生成推荐问题按钮 */}
                <button
                  onClick={handleRegenerateSuggestions}
                  disabled={isRegenerating || isLoading}
                  className="w-full py-3 px-4 text-sm text-[#ececec] bg-[#2f2f2f] border border-[#444] rounded-xl hover:bg-[#3a3a3a] hover:border-[#555] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {isRegenerating ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
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

                {/* 潜在子节点 */}
                {nodePotentials.length > 0 && (
                  <div className="bg-[#2f2f2f] rounded-xl p-4 border border-[#444]">
                    <h3 className="text-sm font-medium text-[#ececec] mb-3">
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
                                ? 'bg-[#1a1a1a] border-[#333] text-[#666] cursor-not-allowed'
                                : 'bg-[#212121] border-[#444] hover:border-[#666] hover:bg-[#2a2a2a] text-[#ececec]'
                            }`}
                          >
                            <div className="flex items-start gap-2">
                              <span className={`mt-0.5 ${isUsed ? 'text-[#666]' : 'text-[#10a37f]'}`}>→</span>
                              <span className="text-sm">{potential.question}</span>
                            </div>
                            {isUsed && (
                              <span className="text-xs text-[#666] ml-5">已探索</span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {selectedNode.qas.length > 0 && (
                  <div className="text-xs text-[#888] mt-4">
                    点击上方问题或输入自定义问题继续探索
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-60 text-[#888]">
                <div className="text-center">
                  <div className="text-4xl mb-3">👆</div>
                  <p className="text-lg">点击思维导图中的节点</p>
                  <p className="mt-1">查看详情和继续探索</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 输入区域 */}
      <div className="p-4 bg-[#212121]">
        <form onSubmit={handleSubmit} className={`space-y-3 ${isFullWidth ? 'max-w-3xl mx-auto' : ''}`}>
          {/* AI 模型选择器 */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#888]">模型:</span>
            <select
              value={aiModel}
              onChange={(e) => setAIModel(e.target.value as typeof aiModel)}
              className="px-2 py-1 text-xs border rounded border-[#444] bg-[#2f2f2f] text-[#ececec]"
              disabled={isLoading}
            >
              {AI_MODELS.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name} ({model.description})
                </option>
              ))}
            </select>
          </div>

          {/* 输入框 */}
          <div className="flex gap-3 items-end bg-[#2f2f2f] rounded-3xl p-2 pl-4">
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
              rows={1}
              className="flex-1 py-2 resize-none focus:outline-none disabled:opacity-50 bg-transparent text-[#ececec] placeholder:text-[#888] text-base"
              style={{ maxHeight: '200px' }}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="p-2 rounded-full bg-white text-black hover:bg-gray-200 disabled:bg-[#444] disabled:text-[#888] disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? (
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                </svg>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
