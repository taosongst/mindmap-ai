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

  // 转换节点和边数据为ReactFlow格式
  const { flowNodes, flowEdges } = useMemo(() => {
    const flowNodes: Node[] = []
    const flowEdges: Edge[] = []
    const nodePositions = new Map<string, { x: number; y: number }>()

    // 构建节点层级关系
    const childrenMap = new Map<string | null, NodeData[]>()
    storeNodes
      .filter((n) => !n.isHidden)
      .forEach((node) => {
        const parentId = node.parentNodeId || null
        if (!childrenMap.has(parentId)) {
          childrenMap.set(parentId, [])
        }
        childrenMap.get(parentId)!.push(node)
      })

    // 递归计算位置并创建节点
    function processNode(node: NodeData, depth: number, index: number) {
      const parentPos = node.parentNodeId
        ? nodePositions.get(node.parentNodeId)
        : null
      const siblings = childrenMap.get(node.parentNodeId || null) || []

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
        },
      })

      // 创建系统边（基于parentNodeId）
      if (node.parentNodeId) {
        flowEdges.push({
          id: `e-${node.parentNodeId}-${node.id}`,
          source: node.parentNodeId,
          target: node.id,
          type: 'smoothstep',
        })
      }

      // 处理子节点
      const children = childrenMap.get(node.id) || []
      children.forEach((child, i) => processNode(child, depth + 1, i))
    }

    // 从根节点开始处理
    const rootNodes = childrenMap.get(null) || []
    rootNodes.forEach((node, i) => processNode(node, 0, i))

    // 添加用户自定义边（从store）
    storeEdges.forEach((edge) => {
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
    })

    return { flowNodes, flowEdges }
  }, [storeNodes, storeEdges, selectedNodeId, selectNode, getPotentialNodesForNode, usedPotentialIds, handlePotentialClick])

  const [nodes, setNodes, onNodesChange] = useNodesState(flowNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(flowEdges)

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
