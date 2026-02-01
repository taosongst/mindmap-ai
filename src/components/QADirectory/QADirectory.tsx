'use client'

import { useMapStore } from '@/hooks/useMapStore'
import { truncateText } from '@/lib/utils'

interface QADirectoryProps {
  isOpen: boolean
  onClose: () => void
}

export function QADirectory({ isOpen, onClose }: QADirectoryProps) {
  const { allQAs, nodes, restoreNode } = useMapStore()

  if (!isOpen) return null

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

  return (
    <div className="fixed left-0 top-0 h-full w-[320px] bg-white shadow-xl border-r border-gray-200 z-50 flex flex-col">
      {/* 头部 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h3 className="font-medium text-gray-800">问答目录</h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 text-xl"
        >
          ×
        </button>
      </div>

      {/* 问答列表 */}
      <div className="flex-1 overflow-y-auto">
        {allQAs.length === 0 ? (
          <div className="p-4 text-center text-gray-400">暂无问答记录</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {allQAs.map((qa, index) => {
              const nodeInfo = qaToNodeMap.get(qa.id)
              const isHidden = nodeInfo?.isHidden ?? true

              return (
                <div
                  key={qa.id}
                  className={`p-3 ${isHidden ? 'bg-gray-50' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    {/* 序号 */}
                    <span className="text-xs text-gray-400 mt-0.5">
                      {index + 1}.
                    </span>

                    <div className="flex-1 min-w-0">
                      {/* 问题 */}
                      <div
                        className={`text-sm ${isHidden ? 'text-gray-400' : 'text-gray-700'}`}
                      >
                        {truncateText(qa.question, 50)}
                      </div>

                      {/* 来源标识 */}
                      {qa.source !== 'user' && (
                        <div className="text-xs text-purple-400 mt-1">
                          {qa.source === 'ai_suggestion' ? '来自AI推荐' : '来自原作者'}
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
                        <span className="text-xs text-green-500">展示中</span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
