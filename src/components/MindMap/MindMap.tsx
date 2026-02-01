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
import { PotentialNode } from './PotentialNode'
import { NodeDetail } from './NodeDetail'
import { useMapStore } from '@/hooks/useMapStore'
import { calculateNodePosition } from '@/lib/utils'
import { NodeData, PotentialNodeData } from '@/types'

const nodeTypes: NodeTypes = {
  qaNode: QANode,
  potentialNode: PotentialNode,
}

interface MindMapProps {
  onAskQuestion: (question: string, parentNodeId?: string) => void
}

export function MindMap({ onAskQuestion }: MindMapProps) {
  const {
    nodes: storeNodes,
    potentialNodes,
    selectedNodeId,
    selectNode,
    hideNode,
  } = useMapStore()

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

      flowNodes.push({
        id: node.id,
        type: 'qaNode',
        position,
        data: {
          nodeData: node,
          isSelected: selectedNodeId === node.id,
          onSelect: selectNode,
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

    // 添加潜在节点
    potentialNodes.forEach((pNode, index) => {
      const parentPos = nodePositions.get(pNode.parentNodeId)
      if (!parentPos) return

      // 获取该父节点下已有的子节点数量
      const existingChildren =
        (childrenMap.get(pNode.parentNodeId) || []).length + index

      const position = calculateNodePosition(
        parentPos,
        existingChildren + 1,
        existingChildren
      )

      flowNodes.push({
        id: `potential-${pNode.id}`,
        type: 'potentialNode',
        position,
        data: {
          potentialData: pNode,
          onClick: (data: PotentialNodeData) => {
            onAskQuestion(data.question, data.parentNodeId)
          },
        },
      })

      flowEdges.push({
        id: `e-${pNode.parentNodeId}-potential-${pNode.id}`,
        source: pNode.parentNodeId,
        target: `potential-${pNode.id}`,
        type: 'smoothstep',
        style: { strokeDasharray: '5,5', stroke: '#9CA3AF' },
      })
    })

    return { flowNodes, flowEdges }
  }, [storeNodes, potentialNodes, selectedNodeId, selectNode, onAskQuestion])

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
        onClose={() => selectNode(null)}
        onHide={handleHideNode}
      />
    </div>
  )
}
