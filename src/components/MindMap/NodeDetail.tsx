'use client'

import { NodeData, PotentialNodeData } from '@/types'
import ReactMarkdown from 'react-markdown'

interface NodeDetailProps {
  node: NodeData | null
  potentialNodes: PotentialNodeData[]
  usedPotentialIds: Set<string>
  onClose: () => void
  onHide: (id: string) => void
  onPotentialClick: (data: PotentialNodeData) => void
}

export function NodeDetail({
  node,
  potentialNodes,
  usedPotentialIds,
  onClose,
  onHide,
  onPotentialClick,
}: NodeDetailProps) {
  if (!node) return null

  return (
    <div className="fixed right-0 top-0 h-full w-[400px] bg-white shadow-xl border-l border-gray-200 overflow-y-auto z-50">
      {/* 头部 */}
      <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between z-10">
        <h3 className="font-medium text-gray-800">节点详情</h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 text-xl"
        >
          ×
        </button>
      </div>

      {/* 内容 */}
      <div className="p-4 space-y-6">
        {node.qas.map((qa, index) => (
          <div key={qa.id} className="space-y-3">
            {index > 0 && <hr className="border-gray-200" />}

            {/* 问题 */}
            <div>
              <div className="text-xs text-gray-400 mb-1">问题</div>
              <div className="text-gray-800 font-medium">{qa.question}</div>
            </div>

            {/* 回答 */}
            <div>
              <div className="text-xs text-gray-400 mb-1">回答</div>
              <div className="prose prose-sm max-w-none text-gray-700">
                <ReactMarkdown>{qa.answer}</ReactMarkdown>
              </div>
            </div>

            {/* 来源 */}
            {qa.source !== 'user' && (
              <div className="text-xs text-purple-500">
                {qa.source === 'ai_suggestion'
                  ? '来自AI推荐'
                  : '来自原作者探索'}
              </div>
            )}
          </div>
        ))}

        {/* 潜在节点列表 */}
        {potentialNodes.length > 0 && (
          <div className="pt-4 border-t border-gray-200">
            <div className="text-xs text-gray-400 mb-3 flex items-center gap-2">
              <span>🤖</span>
              <span>AI 推荐的后续问题</span>
            </div>
            <div className="space-y-2">
              {potentialNodes.map((pNode) => {
                const isUsed = usedPotentialIds.has(pNode.id)
                return (
                  <div
                    key={pNode.id}
                    onClick={() => {
                      if (!isUsed) {
                        onPotentialClick(pNode)
                      }
                    }}
                    className={`
                      p-3 rounded-lg border text-sm
                      transition-all duration-150
                      ${isUsed
                        ? 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed'
                        : 'bg-blue-50 border-blue-200 text-gray-700 cursor-pointer hover:bg-blue-100 hover:border-blue-300'
                      }
                    `}
                  >
                    <div className="flex items-start gap-2">
                      <span className="flex-shrink-0 mt-0.5">
                        {pNode.source === 'ai' ? '💡' : '🧠'}
                      </span>
                      <span className={isUsed ? 'line-through' : ''}>
                        {pNode.question}
                      </span>
                    </div>
                    {isUsed && (
                      <div className="text-xs text-gray-400 mt-1 ml-6">已探索</div>
                    )}
                    {pNode.source === 'forked_author' && !isUsed && (
                      <div className="text-xs text-purple-400 mt-1 ml-6">原作者的探索路径</div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* 操作按钮 */}
      <div className="sticky bottom-0 bg-white border-t border-gray-200 px-4 py-3 flex gap-2">
        <button
          onClick={() => onHide(node.id)}
          className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded"
        >
          隐藏节点
        </button>
      </div>
    </div>
  )
}
