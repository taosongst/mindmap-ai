// 前端使用的类型定义

export type AIProvider = 'openai' | 'anthropic'

export interface MapData {
  id: string
  title: string
  forkedFromId?: string
  createdAt: Date
  updatedAt: Date
}

export interface QAData {
  id: string
  mapId: string
  question: string
  answer: string
  suggestedQuestions: string[]
  timestamp: number
  source: 'user' | 'ai_suggestion' | 'forked_author'
  sourceAuthorId?: string
}

export interface NodeData {
  id: string
  mapId: string
  parentNodeId?: string
  positionX?: number
  positionY?: number
  isHidden: boolean
  order: number
  qas: QAData[] // 关联的问答（可能多个，合并场景）
}

export interface PotentialNodeData {
  id: string
  mapId: string
  parentNodeId: string
  question: string
  source: 'ai' | 'forked_author'
  sourceAuthorId?: string
  linkedQaId?: string
}

// ReactFlow 节点类型
export interface MindMapNode {
  id: string
  type: 'qaNode' | 'potentialNode'
  position: { x: number; y: number }
  data: {
    nodeData?: NodeData
    potentialData?: PotentialNodeData
    isSelected?: boolean
  }
}

// ReactFlow 边类型
export interface MindMapEdge {
  id: string
  source: string
  target: string
  type?: string
}

// AI 聊天相关
export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatRequest {
  mapId: string
  parentNodeId?: string
  question: string
  provider: AIProvider
}

export interface ChatResponse {
  answer: string
  suggestedQuestions: string[]
  qa: QAData
  node: NodeData
}
