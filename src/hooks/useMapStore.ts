import { create } from 'zustand'
import { NodeData, PotentialNodeData, QAData, AIProvider } from '@/types'

interface MapState {
  // 地图数据
  mapId: string | null
  title: string
  nodes: NodeData[]
  potentialNodes: PotentialNodeData[]
  allQAs: QAData[] // 所有问答（包括隐藏的）

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
  }) => void
  addNode: (node: NodeData) => void
  updateNode: (id: string, updates: Partial<NodeData>) => void
  hideNode: (id: string) => void
  restoreNode: (id: string) => void
  addPotentialNodes: (nodes: PotentialNodeData[]) => void
  removePotentialNode: (id: string) => void
  selectNode: (id: string | null) => void
  setLoading: (loading: boolean) => void
  setAIProvider: (provider: AIProvider) => void
  addQA: (qa: QAData) => void
}

export const useMapStore = create<MapState>((set) => ({
  mapId: null,
  title: '',
  nodes: [],
  potentialNodes: [],
  allQAs: [],
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

  selectNode: (id) => set({ selectedNodeId: id }),

  setLoading: (loading) => set({ isLoading: loading }),

  setAIProvider: (provider) => set({ aiProvider: provider }),

  addQA: (qa) =>
    set((state) => ({
      allQAs: [...state.allQAs, qa],
    })),
}))
