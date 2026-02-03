'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'

interface ImportDialogProps {
  isOpen: boolean
  onClose: () => void
}

interface ChatGPTConversation {
  title?: string
  mapping?: Record<string, unknown>
}

type ImportMode = 'link' | 'json'

export function ImportDialog({ isOpen, onClose }: ImportDialogProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [mode, setMode] = useState<ImportMode>('json') // 默认JSON模式，更可靠
  const [url, setUrl] = useState('')
  const [customTitle, setCustomTitle] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [conversations, setConversations] = useState<ChatGPTConversation[]>([])
  const [selectedConvIndex, setSelectedConvIndex] = useState<number>(0)
  const [result, setResult] = useState<{
    success: boolean
    mapId: string
    qaCount: number
    mapTitle: string
  } | null>(null)

  // 处理文件选择
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setSelectedFile(file)
    setError(null)
    setConversations([])

    try {
      const text = await file.text()
      const data = JSON.parse(text)

      // ChatGPT 导出可能是数组或单个对话
      if (Array.isArray(data)) {
        setConversations(data)
        setSelectedConvIndex(0)
      } else if (data.mapping) {
        // 单个对话
        setConversations([data])
        setSelectedConvIndex(0)
      } else {
        setError('无法识别的文件格式，请确保是 ChatGPT 导出的 JSON 文件')
      }
    } catch {
      setError('JSON 解析失败，请检查文件格式')
    }
  }

  // 链接导入
  const handleLinkImport = async () => {
    if (!url.trim()) return

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch('/api/import/chatgpt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shareUrl: url.trim(),
          mapTitle: customTitle.trim() || undefined,
        }),
      })

      const data = await response.json()

      if (data.success) {
        setResult(data)
      } else {
        setError(data.message || data.error || '导入失败，建议使用 JSON 导入')
      }
    } catch {
      setError('网络错误，请重试')
    } finally {
      setLoading(false)
    }
  }

  // JSON 导入
  const handleJsonImport = async () => {
    if (conversations.length === 0) return

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const conversation = conversations[selectedConvIndex]

      const response = await fetch('/api/import/json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation,
          mapTitle: customTitle.trim() || undefined,
        }),
      })

      const data = await response.json()

      if (data.success) {
        setResult(data)
      } else {
        setError(data.error || '导入失败')
      }
    } catch {
      setError('网络错误，请重试')
    } finally {
      setLoading(false)
    }
  }

  const handleImport = () => {
    if (mode === 'link') {
      handleLinkImport()
    } else {
      handleJsonImport()
    }
  }

  const handleGoToMap = () => {
    if (result?.mapId) {
      router.push(`/map/${result.mapId}`)
      onClose()
    }
  }

  const handleClose = () => {
    setUrl('')
    setCustomTitle('')
    setError(null)
    setResult(null)
    setSelectedFile(null)
    setConversations([])
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-[500px] max-w-[90vw] max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-medium mb-4">导入 ChatGPT 对话</h2>

        {!result ? (
          <>
            {/* 模式切换 */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setMode('json')}
                className={`flex-1 py-2 px-3 rounded-lg text-sm transition-colors ${
                  mode === 'json'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                JSON 文件导入
              </button>
              <button
                onClick={() => setMode('link')}
                className={`flex-1 py-2 px-3 rounded-lg text-sm transition-colors ${
                  mode === 'link'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                分享链接导入
              </button>
            </div>

            <div className="space-y-4">
              {mode === 'json' ? (
                <>
                  {/* JSON 文件上传 */}
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">
                      选择 JSON 文件
                    </label>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".json"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full px-3 py-3 border border-gray-200 border-dashed rounded-lg text-sm text-gray-500 hover:border-blue-500 hover:text-blue-500 transition-colors"
                    >
                      {selectedFile ? selectedFile.name : '点击选择文件或拖拽到此处'}
                    </button>
                  </div>

                  {/* 对话选择（如果有多个） */}
                  {conversations.length > 1 && (
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">
                        选择对话 ({conversations.length} 个可用)
                      </label>
                      <select
                        value={selectedConvIndex}
                        onChange={(e) => setSelectedConvIndex(Number(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {conversations.map((conv, idx) => (
                          <option key={idx} value={idx}>
                            {conv.title || `对话 ${idx + 1}`}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* 显示选中对话信息 */}
                  {conversations.length > 0 && (
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-green-700 text-sm font-medium">
                        {conversations[selectedConvIndex]?.title || '未命名对话'}
                      </p>
                      <p className="text-green-600 text-xs mt-1">
                        已解析，点击导入创建地图
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {/* 链接输入 */}
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">
                      ChatGPT 分享链接
                    </label>
                    <input
                      type="text"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="https://chatgpt.com/share/xxx"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled={loading}
                    />
                  </div>
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-yellow-700 text-xs">
                      注意：链接导入可能因 Cloudflare 保护而失败，建议优先使用 JSON 导入
                    </p>
                  </div>
                </>
              )}

              {/* 自定义标题 */}
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  自定义标题（可选）
                </label>
                <input
                  type="text"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder="留空则使用原对话标题"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                />
              </div>
            </div>

            {error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={handleClose}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                disabled={loading}
              >
                取消
              </button>
              <button
                onClick={handleImport}
                disabled={
                  loading ||
                  (mode === 'link' && !url.trim()) ||
                  (mode === 'json' && conversations.length === 0)
                }
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {loading ? (
                  <>
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
                    导入中...
                  </>
                ) : (
                  '导入'
                )}
              </button>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs text-gray-400">
                如何导出 JSON：ChatGPT 设置 → 数据控制 → 导出数据 → 下载后解压找到 conversations.json
              </p>
            </div>
          </>
        ) : (
          // 成功状态
          <div className="text-center">
            <div className="text-4xl mb-4">✓</div>
            <h3 className="text-lg font-medium text-green-600 mb-2">导入成功！</h3>
            <p className="text-gray-600 mb-1">
              地图：<span className="font-medium">{result.mapTitle}</span>
            </p>
            <p className="text-gray-500 text-sm mb-6">
              共导入 {result.qaCount} 个问答节点
            </p>

            <div className="flex justify-center gap-2">
              <button
                onClick={handleClose}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                关闭
              </button>
              <button
                onClick={handleGoToMap}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                查看地图
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
