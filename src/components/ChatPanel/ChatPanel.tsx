'use client'

import { useState, FormEvent, useEffect, useRef } from 'react'
import { useMapStore } from '@/hooks/useMapStore'
import { NodeData, QAData } from '@/types'

interface ChatPanelProps {
  selectedNode: NodeData | null
  onAskQuestion: (question: string, parentNodeId?: string) => void
}

export function ChatPanel({ selectedNode, onAskQuestion }: ChatPanelProps) {
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const {
    isLoading,
    isStreaming,
    currentQuestion,
    streamingAnswer,
    aiProvider,
    setAIProvider,
    selectedNodeId,
  } = useMapStore()

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [streamingAnswer, selectedNode])

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    onAskQuestion(input.trim(), selectedNodeId || undefined)
    setInput('')
  }

  return (
    <div className="w-[350px] flex flex-col border-l border-gray-200 bg-white h-full">
      {/* 响应区域 - 占据大部分空间 */}
      <div className="flex-1 overflow-y-auto">
        {/* 当前流式响应 */}
        {isStreaming && (
          <div className="p-4 space-y-4">
            {/* 用户问题 */}
            <div className="flex justify-end">
              <div className="bg-blue-500 text-white px-4 py-2 rounded-2xl rounded-tr-sm max-w-[85%]">
                <p className="text-sm">{currentQuestion}</p>
              </div>
            </div>
            {/* AI 回答（流式） */}
            <div className="flex justify-start">
              <div className="bg-gray-100 px-4 py-2 rounded-2xl rounded-tl-sm max-w-[85%]">
                <p className="text-sm text-gray-800 whitespace-pre-wrap">
                  {/* 过滤掉分隔符及其后面的内容 */}
                  {streamingAnswer.split('---SUGGESTIONS---')[0]}
                  <span className="inline-block w-2 h-4 bg-gray-400 animate-pulse ml-0.5" />
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 选中节点的历史对话 */}
        {!isStreaming && selectedNode && selectedNode.qas.length > 0 && (
          <div className="p-4 space-y-4">
            {selectedNode.qas.map((qa: QAData) => (
              <div key={qa.id} className="space-y-3">
                {/* 问题 */}
                <div className="flex justify-end">
                  <div className="bg-blue-500 text-white px-4 py-2 rounded-2xl rounded-tr-sm max-w-[85%]">
                    <p className="text-sm">{qa.question}</p>
                  </div>
                </div>
                {/* 回答 */}
                <div className="flex justify-start">
                  <div className="bg-gray-100 px-4 py-2 rounded-2xl rounded-tl-sm max-w-[85%]">
                    <p className="text-sm text-gray-800 whitespace-pre-wrap">{qa.answer}</p>
                    {/* 推荐问题 */}
                    {qa.suggestedQuestions.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <p className="text-xs text-gray-500 mb-2">继续探索：</p>
                        <div className="flex flex-wrap gap-1">
                          {qa.suggestedQuestions.slice(0, 3).map((sq, i) => (
                            <button
                              key={i}
                              onClick={() => onAskQuestion(sq, selectedNode.id)}
                              className="text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-2 py-1 rounded-full border border-blue-200"
                            >
                              {sq.length > 20 ? sq.slice(0, 20) + '...' : sq}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 空状态 */}
        {!isStreaming && !selectedNode && (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">
            <div className="text-center p-8">
              <div className="text-4xl mb-4">💭</div>
              <p>选择一个节点查看对话</p>
              <p className="mt-1">或输入问题开始探索</p>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 输入区域 - 固定在底部 */}
      <div className="border-t border-gray-200 p-4 bg-white">
        <form onSubmit={handleSubmit} className="space-y-3">
          {/* AI 选择器 */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">AI:</span>
            <select
              value={aiProvider}
              onChange={(e) => setAIProvider(e.target.value as 'openai' | 'anthropic')}
              className="px-2 py-1 text-xs border border-gray-200 rounded bg-gray-50 text-gray-600"
              disabled={isLoading}
            >
              <option value="openai">GPT-4o</option>
              <option value="anthropic">Claude</option>
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
