'use client'

import { useState, FormEvent } from 'react'
import { useMapStore } from '@/hooks/useMapStore'
import { AI_MODELS } from '@/types'

interface ChatInputProps {
  onSubmit: (question: string) => void
  placeholder?: string
  disabled?: boolean
}

export function ChatInput({
  onSubmit,
  placeholder = '输入你的问题...',
  disabled = false,
}: ChatInputProps) {
  const [input, setInput] = useState('')
  const { isLoading, aiModel, setAIModel } = useMapStore()

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading || disabled) return

    onSubmit(input.trim())
    setInput('')
  }

  return (
    <div className="bg-white border-t border-gray-200 p-4">
      <form onSubmit={handleSubmit} className="flex gap-3 items-end">
        {/* AI 模型选择器 */}
        <select
          value={aiModel}
          onChange={(e) => setAIModel(e.target.value as typeof aiModel)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-600"
          disabled={isLoading}
        >
          {AI_MODELS.map((model) => (
            <option key={model.id} value={model.id}>
              {model.name}
            </option>
          ))}
        </select>

        {/* 输入框 */}
        <div className="flex-1 relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={placeholder}
            disabled={isLoading || disabled}
            className="w-full px-4 py-2 border border-gray-200 rounded-lg text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-400"
          />
        </div>

        {/* 发送按钮 */}
        <button
          type="submit"
          disabled={!input.trim() || isLoading || disabled}
          className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              思考中
            </span>
          ) : (
            '发送'
          )}
        </button>
      </form>
    </div>
  )
}
