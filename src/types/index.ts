// 前端使用的类型定义

export type AIProvider = 'openai' | 'anthropic'

// 具体模型选项
export type AIModel =
  | 'gpt-4o-mini'      // OpenAI: 快速便宜
  | 'gpt-4o'           // OpenAI: 通用旗舰
  | 'gpt-4.1'          // OpenAI: 最新最强
  | 'gpt-5'            // OpenAI: GPT-5
  | 'gpt-5-mini'       // OpenAI: GPT-5 Mini
  | 'gpt-5.2'          // OpenAI: GPT-5.2 最新
  | 'o3-mini'          // OpenAI: 推理模型
  | 'claude-sonnet'    // Anthropic: Claude 3.5 Sonnet
  | 'claude-opus'      // Anthropic: Claude Opus

// 模型信息
export interface ModelInfo {
  id: AIModel
  name: string
  provider: AIProvider
  description: string
}

export const AI_MODELS: ModelInfo[] = [
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai', description: '快速便宜' },
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai', description: '通用旗舰' },
  { id: 'gpt-4.1', name: 'GPT-4.1', provider: 'openai', description: '编码增强' },
  { id: 'gpt-5-mini', name: 'GPT-5 Mini', provider: 'openai', description: '快速高效' },
  { id: 'gpt-5', name: 'GPT-5', provider: 'openai', description: '强大推理' },
  { id: 'gpt-5.2', name: 'GPT-5.2', provider: 'openai', description: '最新最强' },
  { id: 'o3-mini', name: 'o3-mini', provider: 'openai', description: '推理专用' },
  { id: 'claude-sonnet', name: 'Claude Sonnet', provider: 'anthropic', description: 'Claude 3.5' },
]

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

// 用户自定义边
export interface EdgeStyle {
  color?: string
  strokeWidth?: number
}

export interface EdgeData {
  id: string
  mapId: string
  sourceNodeId: string
  targetNodeId: string
  edgeType: string
  label?: string
  style?: EdgeStyle
  isUserCreated: boolean
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
