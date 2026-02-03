'use client'

import { memo, useState } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import { truncateText } from '@/lib/utils'
import { NodeData, PotentialNodeData } from '@/types'

interface QANodeData {
  nodeData: NodeData
  isSelected: boolean
  onSelect: (id: string | null) => void
  potentialNodes: PotentialNodeData[]
  usedPotentialIds: Set<string>
  onPotentialClick: (data: PotentialNodeData) => void
  hasChildren: boolean
  isChildrenCollapsed: boolean
  onToggleCollapseChildren: (nodeId: string) => void
}

function QANodeComponent({ data, id }: NodeProps<QANodeData>) {
  const {
    nodeData,
    isSelected,
    onSelect,
    potentialNodes,
    usedPotentialIds,
    onPotentialClick,
    hasChildren,
    isChildrenCollapsed,
    onToggleCollapseChildren,
  } = data
  const primaryQA = nodeData.qas[0]
  const [isExpanded, setIsExpanded] = useState(false)

  if (!primaryQA) return null

  const hasPotentialNodes = potentialNodes && potentialNodes.length > 0
  const showCollapseButton = hasChildren

  return (
    <div className="relative">
      <div
        className={`
          px-4 py-3 rounded-lg shadow-md border-2 cursor-pointer
          min-w-[200px] max-w-[300px] bg-white
          transition-all duration-200
          ${isSelected ? 'border-blue-500 shadow-lg' : 'border-gray-200 hover:border-blue-300'}
        `}
        onClick={() => onSelect(isSelected ? null : id)}
      >
        <Handle type="target" position={Position.Top} className="!bg-gray-400" />

        {/* 问题 */}
        <div className="text-sm font-medium text-gray-800 mb-2">
          {truncateText(primaryQA.question, 60)}
        </div>

        {/* 回答预览 */}
        <div className="text-xs text-gray-500 line-clamp-2">
          {truncateText(primaryQA.answer, 100)}
        </div>

        {/* 合并指示器 */}
        {nodeData.qas.length > 1 && (
          <div className="mt-2 text-xs text-blue-500">
            +{nodeData.qas.length - 1} 个问答
          </div>
        )}

        {/* 来源标识 */}
        {primaryQA.source === 'forked_author' && (
          <div className="mt-2 flex items-center gap-1 text-xs text-purple-500">
            <span>来自原作者</span>
          </div>
        )}

        <Handle
          type="source"
          position={Position.Bottom}
          className="!bg-gray-400"
        />
      </div>

      {/* 底部按钮组 */}
      {(hasPotentialNodes || showCollapseButton) && (
        <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 flex gap-1 z-10">
          {/* 展开潜在节点的按钮 */}
          {hasPotentialNodes && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                setIsExpanded(!isExpanded)
              }}
              className={`
                w-6 h-6 rounded-full
                flex items-center justify-center
                text-sm font-medium
                transition-all duration-200
                ${isExpanded
                  ? 'bg-gray-500 text-white hover:bg-gray-600'
                  : 'bg-blue-500 text-white hover:bg-blue-600'
                }
              `}
              title={isExpanded ? '收起推荐问题' : '展开推荐问题'}
            >
              {isExpanded ? '−' : '+'}
            </button>
          )}

          {/* 折叠/展开子节点的按钮 */}
          {showCollapseButton && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onToggleCollapseChildren(id)
              }}
              className={`
                w-6 h-6 rounded-full
                flex items-center justify-center
                text-xs font-medium
                transition-all duration-200
                ${isChildrenCollapsed
                  ? 'bg-orange-500 text-white hover:bg-orange-600'
                  : 'bg-gray-400 text-white hover:bg-gray-500'
                }
              `}
              title={isChildrenCollapsed ? '展开子节点' : '折叠子节点'}
            >
              {isChildrenCollapsed ? '▶' : '▼'}
            </button>
          )}
        </div>
      )}

      {/* 潜在节点弹出窗口 */}
      {isExpanded && hasPotentialNodes && (
        <div
          className="absolute top-full left-1/2 -translate-x-1/2 mt-4 z-20"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-3 min-w-[250px] max-w-[350px]">
            <div className="text-xs text-gray-400 mb-2 flex items-center justify-between">
              <span>AI 推荐的问题</span>
              <span className="text-gray-300">{potentialNodes.length} 个</span>
            </div>
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {potentialNodes.map((pNode) => {
                const isUsed = usedPotentialIds.has(pNode.id)
                return (
                  <div
                    key={pNode.id}
                    onClick={() => {
                      if (!isUsed) {
                        onPotentialClick(pNode)
                        setIsExpanded(false)
                      }
                    }}
                    className={`
                      p-2 rounded border text-sm
                      transition-all duration-150
                      ${isUsed
                        ? 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed'
                        : 'bg-blue-50 border-blue-200 text-gray-700 cursor-pointer hover:bg-blue-100 hover:border-blue-300'
                      }
                    `}
                  >
                    <div className="flex items-start gap-2">
                      <span className="flex-shrink-0 mt-0.5">
                        {pNode.source === 'ai' ? '🤖' : '🧠'}
                      </span>
                      <span className={isUsed ? 'line-through' : ''}>
                        {pNode.question}
                      </span>
                    </div>
                    {isUsed && (
                      <div className="text-xs text-gray-400 mt-1 ml-6">已探索</div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
          {/* 箭头指向 */}
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-8 border-r-8 border-b-8 border-transparent border-b-white"></div>
        </div>
      )}
    </div>
  )
}

export const QANode = memo(QANodeComponent)
