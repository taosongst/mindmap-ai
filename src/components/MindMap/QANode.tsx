'use client'

import { memo, useState, useRef, useCallback, useMemo } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import { truncateText } from '@/lib/utils'
import { NodeData, PotentialNodeData } from '@/types'

// 从回答中提取主标题
function extractHeadings(text: string, maxCount: number = 4): { headings: string[]; hasMore: boolean } {
  const headings: string[] = []
  const lines = text.split('\n')
  let hasMore = false

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    // 匹配各种标题格式
    // 中文数字标题：一、二、三、等
    const chineseNumMatch = trimmed.match(/^[一二三四五六七八九十]+[、.．]\s*(.+)/)
    // 阿拉伯数字标题：1. 2. 3. 等（但排除子列表如 1.1）
    const arabicNumMatch = trimmed.match(/^(\d+)[.、．]\s*(?!\d)(.+)/)
    // Markdown 标题：## ### 等
    const mdHeadingMatch = trimmed.match(/^#{1,3}\s+(.+)/)
    // 加粗标题：**xxx**
    const boldMatch = trimmed.match(/^\*\*(.+?)\*\*\s*$/)

    let heading = ''
    if (chineseNumMatch) {
      heading = trimmed
    } else if (arabicNumMatch && parseInt(arabicNumMatch[1]) <= 10) {
      heading = trimmed
    } else if (mdHeadingMatch) {
      heading = mdHeadingMatch[1]
    } else if (boldMatch && trimmed.length < 50) {
      heading = boldMatch[1]
    }

    if (heading && heading.length > 2 && heading.length < 80) {
      if (headings.length >= maxCount) {
        hasMore = true
        break
      }
      headings.push(heading)
    }
  }

  return { headings, hasMore }
}

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
  showAnswerPreview: boolean
  onHideNode: (nodeId: string) => void
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
    showAnswerPreview,
    onHideNode,
  } = data
  const primaryQA = nodeData.qas[0]
  const [isExpanded, setIsExpanded] = useState(false)
  const [showHoverPreview, setShowHoverPreview] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const hoverTimerRef = useRef<NodeJS.Timeout | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // 鼠标进入节点
  const handleMouseEnter = useCallback(() => {
    // 清除之前的定时器
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current)
    }
    // 1秒后显示预览
    hoverTimerRef.current = setTimeout(() => {
      setShowHoverPreview(true)
    }, 1000)
  }, [])

  // 鼠标离开节点
  const handleMouseLeave = useCallback(() => {
    // 清除定时器
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current)
      hoverTimerRef.current = null
    }
    setShowHoverPreview(false)
  }, [])

  // 处理删除节点
  const handleHideNode = useCallback(() => {
    setShowMenu(false)
    onHideNode(id)
  }, [id, onHideNode])

  // 提取回答中的主标题
  const { headings, hasMoreHeadings } = useMemo(() => {
    if (!primaryQA) return { headings: [], hasMoreHeadings: false }
    const result = extractHeadings(primaryQA.answer, 4)
    return { headings: result.headings, hasMoreHeadings: result.hasMore }
  }, [primaryQA])

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
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <Handle type="target" position={Position.Top} className="!bg-gray-400" />

        {/* 右上角操作按钮 */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            setShowMenu(!showMenu)
          }}
          className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center text-gray-400 hover:text-gray-600 hover:border-gray-300 transition-colors"
          title="更多操作"
        >
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 16 16">
            <circle cx="8" cy="3" r="1.5" />
            <circle cx="8" cy="8" r="1.5" />
            <circle cx="8" cy="13" r="1.5" />
          </svg>
        </button>

        {/* 操作菜单 */}
        {showMenu && (
          <div
            ref={menuRef}
            className="absolute top-6 right-0 z-50 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[120px]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={handleHideNode}
              className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              删除节点
            </button>
          </div>
        )}

        {/* 问题 */}
        <div className={`text-sm font-medium text-gray-800 ${showAnswerPreview ? 'mb-2' : ''}`}>
          {truncateText(primaryQA.question, 60)}
        </div>

        {/* 回答预览（可选） */}
        {showAnswerPreview && (
          <div className="text-xs text-gray-500 line-clamp-2">
            {truncateText(primaryQA.answer, 100)}
          </div>
        )}

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

      {/* 悬停预览弹窗 */}
      {showHoverPreview && (
        <div
          className="absolute left-full top-0 ml-3 z-30 pointer-events-none"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <div className="bg-white rounded-lg shadow-xl border border-gray-200 p-4 min-w-[280px] max-w-[400px]">
            {/* 问题标题 */}
            <div className="text-sm font-medium text-gray-800 mb-3 pb-2 border-b border-gray-100">
              {primaryQA.question}
            </div>

            {/* 内容预览：优先显示主标题，否则显示文本预览 */}
            {headings.length >= 2 ? (
              <div className="space-y-2">
                <div className="text-xs text-gray-400 mb-1">内容大纲：</div>
                {headings.map((heading, index) => (
                  <div
                    key={index}
                    className="text-xs text-gray-700 flex items-start gap-2"
                  >
                    <span className="text-blue-500 flex-shrink-0">•</span>
                    <span className="line-clamp-1">{heading}</span>
                  </div>
                ))}
                {hasMoreHeadings && (
                  <div className="text-xs text-gray-400 pl-4">...</div>
                )}
              </div>
            ) : (
              <div className="text-xs text-gray-600 leading-relaxed line-clamp-6 whitespace-pre-wrap">
                {truncateText(primaryQA.answer, 300)}
              </div>
            )}

            {/* 更多提示 */}
            <div className="text-xs text-gray-400 mt-3 pt-2 border-t border-gray-100">
              点击节点查看完整内容
            </div>
          </div>
          {/* 左侧箭头 */}
          <div className="absolute top-4 -left-2 w-0 h-0 border-t-8 border-b-8 border-r-8 border-transparent border-r-white"></div>
        </div>
      )}

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
