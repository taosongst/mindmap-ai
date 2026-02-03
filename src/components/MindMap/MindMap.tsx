'use client'

import { useCallback, useMemo, useRef, useEffect } from 'react'
import ReactFlow, {
  Node,
  Edge,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Background,
  Controls,
  NodeTypes,
  NodeDragHandler,
} from 'reactflow'
import 'reactflow/dist/style.css'

import { QANode } from './QANode'
import { useMapStore } from '@/hooks/useMapStore'
import { calculateNodePosition } from '@/lib/utils'
import { NodeData, PotentialNodeData } from '@/types'

const nodeTypes: NodeTypes = {
  qaNode: QANode,
}

interface MindMapProps {
  onAskQuestion: (question: string, parentNodeId?: string) => void
}

export function MindMap({ onAskQuestion }: MindMapProps) {
  const {
    mapId,
    nodes: storeNodes,
    potentialNodes,
    edges: storeEdges,
    usedPotentialIds,
    selectedNodeId,
    selectNode,
    hideNode,
    markPotentialAsUsed,
    updateNode,
    addEdge: addStoreEdge,
    removeEdge: removeStoreEdge,
    collapsedNodeIds,
    toggleCollapseChildren,
  } = useMapStore()

  // 用于跟踪已知节点ID，检测新增节点
  const knownNodeIds = useRef<Set<string>>(new Set())

  // 用于跟踪用户拖动的位置（优先级高于store）
  const userPositions = useRef<Map<string, { x: number; y: number }>>(new Map())

  // 处理潜在节点点击
  const handlePotentialClick = useCallback(
    (data: PotentialNodeData) => {
      markPotentialAsUsed(data.id)
      onAskQuestion(data.question, data.parentNodeId)
    },
    [markPotentialAsUsed, onAskQuestion]
  )

  // 获取指定节点的潜在子节点
  const getPotentialNodesForNode = useCallback(
    (nodeId: string) => {
      return potentialNodes.filter((p) => p.parentNodeId === nodeId)
    },
    [potentialNodes]
  )

  // 基于 edges 构建父子关系映射
  const { parentMap, childrenSet } = useMemo(() => {
    const parentMap = new Map<string, string | null>()
    const childrenSet = new Map<string, Set<string>>()

    // 从 edges 构建父子关系
    storeEdges.forEach((edge) => {
      // 每个节点可能有多个父节点（用户连接），取第一个作为主父节点
      if (!parentMap.has(edge.targetNodeId)) {
        parentMap.set(edge.targetNodeId, edge.sourceNodeId)
      }
      // 记录子节点
      if (!childrenSet.has(edge.sourceNodeId)) {
        childrenSet.set(edge.sourceNodeId, new Set())
      }
      childrenSet.get(edge.sourceNodeId)!.add(edge.targetNodeId)
    })

    return { parentMap, childrenSet }
  }, [storeEdges])

  // 检查节点是否因为祖先被折叠而应该隐藏
  const isCollapsedByAncestor = useCallback((nodeId: string): boolean => {
    let currentParentId = parentMap.get(nodeId)
    while (currentParentId) {
      if (collapsedNodeIds.has(currentParentId)) {
        return true
      }
      currentParentId = parentMap.get(currentParentId) || null
    }
    return false
  }, [collapsedNodeIds, parentMap])

  // 转换节点和边数据为ReactFlow格式
  const { flowNodes, flowEdges } = useMemo(() => {
    const flowNodes: Node[] = []
    const flowEdges: Edge[] = []
    const nodePositions = new Map<string, { x: number; y: number }>()

    // 构建节点层级关系（排除隐藏的和因祖先折叠而隐藏的）
    const childrenMap = new Map<string | null, NodeData[]>()
    storeNodes
      .filter((n) => !n.isHidden && !isCollapsedByAncestor(n.id))
      .forEach((node) => {
        const parentId = parentMap.get(node.id) || null
        if (!childrenMap.has(parentId)) {
          childrenMap.set(parentId, [])
        }
        childrenMap.get(parentId)!.push(node)
      })

    // 计算每个节点是否有子节点（基于 edges，不考虑折叠状态）
    const hasChildrenMap = new Map<string, boolean>()
    childrenSet.forEach((children, parentId) => {
      // 检查是否有未隐藏的子节点
      const hasVisibleChildren = Array.from(children).some((childId) => {
        const childNode = storeNodes.find((n) => n.id === childId)
        return childNode && !childNode.isHidden
      })
      if (hasVisibleChildren) {
        hasChildrenMap.set(parentId, true)
      }
    })

    // 递归计算位置并创建节点
    function processNode(node: NodeData, depth: number, index: number) {
      const nodeParentId = parentMap.get(node.id) || null
      const parentPos = nodeParentId ? nodePositions.get(nodeParentId) : null
      const siblings = childrenMap.get(nodeParentId) || []

      // 位置优先级：用户拖动 > store保存 > 自动计算
      let position: { x: number; y: number }

      if (userPositions.current.has(node.id)) {
        // 用户拖动过的位置
        position = userPositions.current.get(node.id)!
      } else if (node.positionX !== null && node.positionX !== undefined &&
                 node.positionY !== null && node.positionY !== undefined) {
        // store中保存的位置
        position = { x: node.positionX, y: node.positionY }
      } else {
        // 自动计算位置（仅对新节点）
        position = calculateNodePosition(parentPos || null, siblings.length, index)
      }

      nodePositions.set(node.id, position)

      // 获取该节点的潜在子节点
      const nodePotentials = getPotentialNodesForNode(node.id)

      flowNodes.push({
        id: node.id,
        type: 'qaNode',
        position,
        data: {
          nodeData: node,
          isSelected: selectedNodeId === node.id,
          onSelect: selectNode,
          potentialNodes: nodePotentials,
          usedPotentialIds,
          onPotentialClick: handlePotentialClick,
          hasChildren: hasChildrenMap.has(node.id),
          isChildrenCollapsed: collapsedNodeIds.has(node.id),
          onToggleCollapseChildren: toggleCollapseChildren,
        },
      })

      // 处理子节点
      const children = childrenMap.get(node.id) || []
      children.forEach((child, i) => processNode(child, depth + 1, i))
    }

    // 从根节点开始处理
    const rootNodes = childrenMap.get(null) || []
    rootNodes.forEach((node, i) => processNode(node, 0, i))

    // 收集可见节点的 ID
    const visibleNodeIds = new Set(flowNodes.map((n) => n.id))

    // 添加边（从 store，只添加两端节点都可见的边）
    storeEdges.forEach((edge) => {
      if (visibleNodeIds.has(edge.sourceNodeId) && visibleNodeIds.has(edge.targetNodeId)) {
        flowEdges.push({
          id: edge.id,
          source: edge.sourceNodeId,
          target: edge.targetNodeId,
          type: edge.edgeType || 'smoothstep',
          label: edge.label,
          style: edge.style ? {
            stroke: edge.style.color,
            strokeWidth: edge.style.strokeWidth,
          } : undefined,
        })
      }
    })

    return { flowNodes, flowEdges }
  }, [storeNodes, storeEdges, selectedNodeId, selectNode, getPotentialNodesForNode, usedPotentialIds, handlePotentialClick, collapsedNodeIds, toggleCollapseChildren, isCollapsedByAncestor, parentMap, childrenSet])

  const [nodes, setNodes, onNodesChange] = useNodesState(flowNodes)
  const [edges, setEdges, defaultOnEdgesChange] = useEdgesState(flowEdges)

  // 自定义边变化处理：同步删除到 store
  const onEdgesChange = useCallback(
    (changes: Parameters<typeof defaultOnEdgesChange>[0]) => {
      // 处理边删除
      changes.forEach((change) => {
        if (change.type === 'remove') {
          const edgeId = change.id
          // 从 store 删除
          removeStoreEdge(edgeId)
          // 同步到后端（只删除数据库中存在的边，系统边可能不在数据库中）
          fetch(`/api/edges?id=${encodeURIComponent(edgeId)}`, { method: 'DELETE' }).catch((err) =>
            console.error('Failed to delete edge:', err)
          )
        }
      })
      // 应用变化到 UI
      defaultOnEdgesChange(changes)
    },
    [defaultOnEdgesChange, removeStoreEdge]
  )

  // 智能同步：只更新变化的部分，保持用户拖动的位置
  useEffect(() => {
    const currentNodeIds = new Set(storeNodes.filter(n => !n.isHidden).map(n => n.id))

    // 检测新增的节点
    const newNodeIds = new Set<string>()
    currentNodeIds.forEach(id => {
      if (!knownNodeIds.current.has(id)) {
        newNodeIds.add(id)
      }
    })

    // 更新已知节点集合
    knownNodeIds.current = currentNodeIds

    setNodes(currentNodes => {
      const currentNodeMap = new Map(currentNodes.map(n => [n.id, n]))

      return flowNodes.map(flowNode => {
        const existingNode = currentNodeMap.get(flowNode.id)

        if (existingNode && !newNodeIds.has(flowNode.id)) {
          // 已存在的节点：保持当前位置，只更新data
          return {
            ...existingNode,
            data: flowNode.data,
          }
        } else {
          // 新节点：使用计算的位置
          return flowNode
        }
      })
    })

    // 直接使用flowEdges（包含系统边和store中的用户边）
    setEdges(flowEdges)
  }, [flowNodes, flowEdges, storeNodes, setNodes, setEdges])

  // 处理新建连接
  const onConnect = useCallback(
    async (params: Connection) => {
      if (!mapId || !params.source || !params.target) return

      const edgeId = `user-${params.source}-${params.target}`

      // 检查是否已存在
      const existingEdge = storeEdges.find(
        e => e.sourceNodeId === params.source && e.targetNodeId === params.target
      )
      if (existingEdge) return

      const newEdge = {
        id: edgeId,
        mapId,
        sourceNodeId: params.source,
        targetNodeId: params.target,
        edgeType: 'smoothstep',
        isUserCreated: true,
      }

      // 立即更新UI
      setEdges((eds) => addEdge({ ...params, id: edgeId, type: 'smoothstep' }, eds))

      // 保存到store
      addStoreEdge(newEdge)

      // 同步到后端
      try {
        const response = await fetch('/api/edges', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newEdge),
        })

        if (response.ok) {
          const savedEdge = await response.json()
          // 用后端返回的ID更新（如果不同）
          if (savedEdge.id !== edgeId) {
            removeStoreEdge(edgeId)
            addStoreEdge(savedEdge)
          }
        }
      } catch (error) {
        console.error('Failed to save edge:', error)
      }
    },
    [mapId, storeEdges, setEdges, addStoreEdge, removeStoreEdge]
  )

  // 处理节点拖动结束：保存位置
  const onNodeDragStop: NodeDragHandler = useCallback(
    async (event, node) => {
      // 保存到本地缓存
      userPositions.current.set(node.id, node.position)

      // 更新store
      updateNode(node.id, {
        positionX: node.position.x,
        positionY: node.position.y,
      })

      // 同步到后端
      await fetch('/api/nodes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: node.id,
          positionX: node.position.x,
          positionY: node.position.y,
        }),
      })
    },
    [updateNode]
  )

  const handleHideNode = async (id: string) => {
    hideNode(id)
    selectNode(null)

    // 同步到后端
    await fetch('/api/nodes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, isHidden: true }),
    })
  }

  return (
    <div className="w-full h-full relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDragStop={onNodeDragStop}
        nodeTypes={nodeTypes}
        fitView
        attributionPosition="bottom-left"
      >
        <Background color="#f0f0f0" gap={16} />
        <Controls />
      </ReactFlow>
    </div>
  )
}
