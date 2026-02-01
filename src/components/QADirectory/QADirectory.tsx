'use client'

import { useMapStore } from '@/hooks/useMapStore'
import { truncateText } from '@/lib/utils'

// 问答目录列表（头部由父组件控制）
export function QADirectory() {
  const { allQAs, nodes, restoreNode } = useMapStore()

  // 创建问答到节点的映射
  const qaToNodeMap = new Map<string, { nodeId: string; isHidden: boolean }>()
  nodes.forEach((node) => {
    node.qas.forEach((qa) => {
      qaToNodeMap.set(qa.id, { nodeId: node.id, isHidden: node.isHidden })
    })
  })

  const handleRestore = async (qaId: string) => {
    const nodeInfo = qaToNodeMap.get(qaId)
    if (!nodeInfo) return

    restoreNode(nodeInfo.nodeId)

    // 同步到后端
    await fetch('/api/nodes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: nodeInfo.nodeId, isHidden: false }),
    })
  }

  if (allQAs.length === 0) {
    return (
      <div className="p-4 text-center text-gray-400 text-sm">
        暂无问答记录
      </div>
    )
  }

  return (
    <div className="divide-y divide-gray-100 overflow-y-auto h-full">
      {allQAs.map((qa, index) => {
        const nodeInfo = qaToNodeMap.get(qa.id)
        const isHidden = nodeInfo?.isHidden ?? true

        return (
          <div
            key={qa.id}
            className={`p-3 ${isHidden ? 'bg-gray-50' : ''}`}
          >
            <div className="flex items-start gap-2">
              {/* 序号 */}
              <span className="text-xs text-gray-400 mt-0.5">
                {index + 1}.
              </span>

              <div className="flex-1 min-w-0">
                {/* 问题 */}
                <div
                  className={`text-sm ${isHidden ? 'text-gray-400' : 'text-gray-700'}`}
                >
                  {truncateText(qa.question, 40)}
                </div>

                {/* 来源标识 */}
                {qa.source !== 'user' && (
                  <div className="text-xs text-purple-400 mt-1">
                    {qa.source === 'ai_suggestion' ? 'AI推荐' : '原作者'}
                  </div>
                )}
              </div>

              {/* 状态/操作 */}
              <div className="flex-shrink-0">
                {isHidden ? (
                  <button
                    onClick={() => handleRestore(qa.id)}
                    className="text-xs text-blue-500 hover:text-blue-600"
                  >
                    恢复
                  </button>
                ) : (
                  <span className="text-xs text-green-500">显示</span>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
