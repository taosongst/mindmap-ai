'use client'

import { memo } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import { truncateText } from '@/lib/utils'
import { NodeData } from '@/types'

interface QANodeData {
  nodeData: NodeData
  isSelected: boolean
  onSelect: (id: string) => void
}

function QANodeComponent({ data, id }: NodeProps<QANodeData>) {
  const { nodeData, isSelected, onSelect } = data
  const primaryQA = nodeData.qas[0]

  if (!primaryQA) return null

  return (
    <div
      className={`
        px-4 py-3 rounded-lg shadow-md border-2 cursor-pointer
        min-w-[200px] max-w-[300px] bg-white
        transition-all duration-200
        ${isSelected ? 'border-blue-500 shadow-lg' : 'border-gray-200 hover:border-blue-300'}
      `}
      onClick={() => onSelect(id)}
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
          <span>🧠</span>
          <span>来自原作者</span>
        </div>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-gray-400"
      />
    </div>
  )
}

export const QANode = memo(QANodeComponent)
