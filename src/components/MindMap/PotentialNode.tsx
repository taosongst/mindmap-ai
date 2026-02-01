'use client'

import { memo } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import { truncateText } from '@/lib/utils'
import { PotentialNodeData } from '@/types'

interface PotentialNodeProps {
  potentialData: PotentialNodeData
  onClick: (data: PotentialNodeData) => void
}

function PotentialNodeComponent({ data }: NodeProps<PotentialNodeProps>) {
  const { potentialData, onClick } = data

  return (
    <div
      className={`
        px-4 py-3 rounded-lg border-2 border-dashed cursor-pointer
        min-w-[180px] max-w-[250px] bg-gray-50
        transition-all duration-200
        hover:bg-blue-50 hover:border-blue-400
        ${potentialData.source === 'ai' ? 'border-gray-300' : 'border-purple-300'}
      `}
      onClick={() => onClick(potentialData)}
    >
      <Handle type="target" position={Position.Top} className="!bg-gray-300" />

      {/* 来源图标 */}
      <div className="flex items-center gap-2 mb-1">
        <span className="text-sm">
          {potentialData.source === 'ai' ? '🤖' : '🧠'}
        </span>
        <span className="text-xs text-gray-400">
          {potentialData.source === 'ai' ? 'AI推荐' : '原作者路径'}
        </span>
      </div>

      {/* 问题 */}
      <div className="text-sm text-gray-600">
        {truncateText(potentialData.question, 50)}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-gray-300"
      />
    </div>
  )
}

export const PotentialNode = memo(PotentialNodeComponent)
