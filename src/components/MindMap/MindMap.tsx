'use client'

import { useCallback, useMemo } from 'react'
import ReactFlow, {
  Node,
  Edge,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Background,
  Controls,
  MiniMap,
  NodeTypes,
} from 'reactflow'
import 'reactflow/dist/style.css'

import { QANode } from './QANode'
import { NodeDetail } from './NodeDetail'
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
    nodes: storeNodes,
    potentialNodes,
    usedPotentialIds,
    selectedNodeId,
    selectNode,
    hideNode,
    markPotentialAsUsed,
  } = useMapStore()

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

  // 转换节点数据为ReactFlow格式
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

      const position =
        node.positionX !== null && node.positionY !== null
          ? { x: node.positionX!, y: node.positionY! }
          : calculateNodePosition(parentPos || null, siblings.length, index)

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

      // 创建边
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

    return { flowNodes, flowEdges }
  }, [storeNodes, selectedNodeId, selectNode, getPotentialNodesForNode, usedPotentialIds, handlePotentialClick])

  const [nodes, setNodes, onNodesChange] = useNodesState(flowNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(flowEdges)

  // 同步store变化到ReactFlow
  useMemo(() => {
    setNodes(flowNodes)
    setEdges(flowEdges)
  }, [flowNodes, flowEdges, setNodes, setEdges])

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  )

  const selectedNode = useMemo(() => {
    return storeNodes.find((n) => n.id === selectedNodeId) || null
  }, [storeNodes, selectedNodeId])

  // 获取选中节点的潜在子节点
  const selectedNodePotentials = useMemo(() => {
    if (!selectedNodeId) return []
    return getPotentialNodesForNode(selectedNodeId)
  }, [selectedNodeId, getPotentialNodesForNode])

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
        nodeTypes={nodeTypes}
        fitView
        attributionPosition="bottom-left"
      >
        <Background color="#f0f0f0" gap={16} />
        <Controls />
        <MiniMap />
      </ReactFlow>

      {/* 节点详情面板 */}
      <NodeDetail
        node={selectedNode}
        potentialNodes={selectedNodePotentials}
        usedPotentialIds={usedPotentialIds}
        onClose={() => selectNode(null)}
        onHide={handleHideNode}
        onPotentialClick={handlePotentialClick}
      />
    </div>
  )
}
