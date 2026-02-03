import { create } from 'zustand'
import { NodeData, PotentialNodeData, QAData, EdgeData, AIModel } from '@/types'

interface MapState {
  // 地图数据
  mapId: string | null
  title: string
  nodes: NodeData[]
  potentialNodes: PotentialNodeData[]
  allQAs: QAData[] // 所有问答（包括隐藏的）
  edges: EdgeData[] // 用户自定义边
  usedPotentialIds: Set<string> // 已使用的潜在节点ID

  // UI状态
  selectedNodeId: string | null
  isLoading: boolean
  aiModel: AIModel
  collapsedNodeIds: Set<string> // 被折叠子节点的父节点ID

  // 流式响应状态
  isStreaming: boolean
  currentQuestion: string
  streamingAnswer: string
  streamingParentNodeId: string | null

  // Actions
  setMapData: (data: {
    id: string
    title: string
    nodes: NodeData[]
    potentialNodes: PotentialNodeData[]
    qas: QAData[]
    edges?: EdgeData[]
  }) => void
  addNode: (node: NodeData) => void
  updateNode: (id: string, updates: Partial<NodeData>) => void
  hideNode: (id: string) => void
  restoreNode: (id: string) => void
  addPotentialNodes: (nodes: PotentialNodeData[]) => void
  removePotentialNode: (id: string) => void
  replacePotentialNodes: (parentNodeId: string, nodes: PotentialNodeData[]) => void
  markPotentialAsUsed: (id: string) => void
  selectNode: (id: string | null) => void
  setLoading: (loading: boolean) => void
  setAIModel: (model: AIModel) => void
  addQA: (qa: QAData) => void
  getPotentialNodesForNode: (nodeId: string) => PotentialNodeData[]
  // 边操作
  addEdge: (edge: EdgeData) => void
  removeEdge: (id: string) => void
  // 流式响应操作
  startStreaming: (question: string, parentNodeId?: string) => void
  appendStreamingAnswer: (chunk: string) => void
  finishStreaming: () => void
  // 子节点折叠操作
  toggleCollapseChildren: (nodeId: string) => void
}

export const useMapStore = create<MapState>((set, get) => ({
  mapId: null,
  title: '',
  nodes: [],
  potentialNodes: [],
  allQAs: [],
  edges: [],
  usedPotentialIds: new Set(),
  selectedNodeId: null,
  isLoading: false,
  aiModel: 'gpt-4o-mini',
  collapsedNodeIds: new Set(),
  isStreaming: false,
  currentQuestion: '',
  streamingAnswer: '',
  streamingParentNodeId: null,

  setMapData: (data) => {
    // 收集现有 edges 的 target 节点 ID
    const existingEdgeTargets = new Set(
      (data.edges || []).map((e) => e.targetNodeId)
    )

    // 为有 parentNodeId 但没有对应 edge 的节点创建系统边（兼容旧数据）
    const systemEdges: EdgeData[] = data.nodes
      .filter((n) => n.parentNodeId && !existingEdgeTargets.has(n.id))
      .map((n) => ({
        id: `system-${n.parentNodeId}-${n.id}`,
        mapId: data.id,
        sourceNodeId: n.parentNodeId!,
        targetNodeId: n.id,
        edgeType: 'smoothstep',
        isUserCreated: false,
      }))

    set({
      mapId: data.id,
      title: data.title,
      nodes: data.nodes,
      potentialNodes: data.potentialNodes,
      allQAs: data.qas,
      edges: [...(data.edges || []), ...systemEdges],
      usedPotentialIds: new Set(),
      collapsedNodeIds: new Set(), // 重置折叠状态
    })
  },

  addNode: (node) =>
    set((state) => {
      // 如果节点有父节点，自动创建系统边
      const newEdges = node.parentNodeId
        ? [
            ...state.edges,
            {
              id: `system-${node.parentNodeId}-${node.id}`,
              mapId: state.mapId!,
              sourceNodeId: node.parentNodeId,
              targetNodeId: node.id,
              edgeType: 'smoothstep',
              isUserCreated: false,
            },
          ]
        : state.edges

      return {
        nodes: [...state.nodes, node],
        edges: newEdges,
      }
    }),

  updateNode: (id, updates) =>
    set((state) => ({
      nodes: state.nodes.map((n) => (n.id === id ? { ...n, ...updates } : n)),
    })),

  hideNode: (id) =>
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === id ? { ...n, isHidden: true } : n
      ),
    })),

  restoreNode: (id) =>
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === id ? { ...n, isHidden: false } : n
      ),
    })),

  addPotentialNodes: (nodes) =>
    set((state) => ({
      potentialNodes: [...state.potentialNodes, ...nodes],
    })),

  removePotentialNode: (id) =>
    set((state) => ({
      potentialNodes: state.potentialNodes.filter((n) => n.id !== id),
    })),

  replacePotentialNodes: (parentNodeId, nodes) =>
    set((state) => ({
      // 移除该父节点下所有 AI 来源的潜在节点，然后添加新的
      potentialNodes: [
        ...state.potentialNodes.filter(
          (n) => !(n.parentNodeId === parentNodeId && n.source === 'ai')
        ),
        ...nodes,
      ],
    })),

  markPotentialAsUsed: (id) =>
    set((state) => {
      const newSet = new Set(state.usedPotentialIds)
      newSet.add(id)
      return { usedPotentialIds: newSet }
    }),

  selectNode: (id) => set({ selectedNodeId: id }),

  setLoading: (loading) => set({ isLoading: loading }),

  setAIModel: (model) => set({ aiModel: model }),

  addQA: (qa) =>
    set((state) => ({
      allQAs: [...state.allQAs, qa],
    })),

  getPotentialNodesForNode: (nodeId) => {
    const state = get()
    return state.potentialNodes.filter((p) => p.parentNodeId === nodeId)
  },

  addEdge: (edge) =>
    set((state) => ({
      edges: [...state.edges, edge],
    })),

  removeEdge: (id) =>
    set((state) => ({
      edges: state.edges.filter((e) => e.id !== id),
    })),

  startStreaming: (question, parentNodeId) =>
    set({
      isStreaming: true,
      currentQuestion: question,
      streamingAnswer: '',
      streamingParentNodeId: parentNodeId || null,
      isLoading: true,
    }),

  appendStreamingAnswer: (chunk) =>
    set((state) => ({
      streamingAnswer: state.streamingAnswer + chunk,
    })),

  finishStreaming: () =>
    set({
      isStreaming: false,
      currentQuestion: '',
      streamingAnswer: '',
      streamingParentNodeId: null,
      isLoading: false,
    }),

  toggleCollapseChildren: (nodeId) =>
    set((state) => {
      const newSet = new Set(state.collapsedNodeIds)
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId)
      } else {
        newSet.add(nodeId)
      }
      return { collapsedNodeIds: newSet }
    }),
}))
