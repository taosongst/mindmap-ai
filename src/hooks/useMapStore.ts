import { create } from 'zustand'
import { NodeData, PotentialNodeData, QAData, EdgeData, AIProvider } from '@/types'

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
  aiProvider: AIProvider

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
  markPotentialAsUsed: (id: string) => void
  selectNode: (id: string | null) => void
  setLoading: (loading: boolean) => void
  setAIProvider: (provider: AIProvider) => void
  addQA: (qa: QAData) => void
  getPotentialNodesForNode: (nodeId: string) => PotentialNodeData[]
  // 边操作
  addEdge: (edge: EdgeData) => void
  removeEdge: (id: string) => void
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
  aiProvider: 'openai',

  setMapData: (data) =>
    set({
      mapId: data.id,
      title: data.title,
      nodes: data.nodes,
      potentialNodes: data.potentialNodes,
      allQAs: data.qas,
      edges: data.edges || [],
      usedPotentialIds: new Set(),
    }),

  addNode: (node) =>
    set((state) => ({
      nodes: [...state.nodes, node],
    })),

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

  markPotentialAsUsed: (id) =>
    set((state) => {
      const newSet = new Set(state.usedPotentialIds)
      newSet.add(id)
      return { usedPotentialIds: newSet }
    }),

  selectNode: (id) => set({ selectedNodeId: id }),

  setLoading: (loading) => set({ isLoading: loading }),

  setAIProvider: (provider) => set({ aiProvider: provider }),

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
}))
