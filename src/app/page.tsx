'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface MapSummary {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  _count: {
    qas: number
    nodes: number
  }
}

export default function Home() {
  const router = useRouter()
  const [maps, setMaps] = useState<MapSummary[]>([])
  const [isCreating, setIsCreating] = useState(false)
  const [newTitle, setNewTitle] = useState('')

  // 加载地图列表
  useEffect(() => {
    async function loadMaps() {
      try {
        const response = await fetch('/api/maps')
        if (response.ok) {
          const data = await response.json()
          setMaps(data)
        }
      } catch (error) {
        console.error('Failed to load maps:', error)
      }
    }

    loadMaps()
  }, [])

  // 创建新地图
  const handleCreate = async () => {
    if (!newTitle.trim()) return

    try {
      const response = await fetch('/api/maps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle }),
      })

      if (response.ok) {
        const map = await response.json()
        router.push(`/map/${map.id}`)
      }
    } catch (error) {
      console.error('Failed to create map:', error)
    }
  }

  // 删除地图
  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('确定要删除这个地图吗？')) return

    try {
      const response = await fetch(`/api/maps/${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setMaps(maps.filter((m) => m.id !== id))
      }
    } catch (error) {
      console.error('Failed to delete map:', error)
    }
  }

  return (
    <main className="min-h-screen bg-gray-50">
      {/* 头部 */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold text-gray-800">MindMap AI</h1>
          <p className="text-gray-500 mt-1">
            与AI一起探索知识，构建你的思维地图
          </p>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* 创建新地图 */}
        {isCreating ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="输入探索主题，如：美国电力系统"
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate()
                if (e.key === 'Escape') setIsCreating(false)
              }}
            />
            <div className="flex gap-2">
              <button
                onClick={handleCreate}
                disabled={!newTitle.trim()}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300"
              >
                开始探索
              </button>
              <button
                onClick={() => setIsCreating(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                取消
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setIsCreating(true)}
            className="w-full bg-white rounded-lg shadow-sm border border-gray-200 border-dashed p-6 mb-6 text-gray-500 hover:border-blue-500 hover:text-blue-500 transition-colors"
          >
            + 开始新的探索
          </button>
        )}

        {/* 地图列表 */}
        <div className="space-y-3">
          {maps.length === 0 ? (
            <div className="text-center text-gray-400 py-12">
              还没有探索记录，开始你的第一次探索吧！
            </div>
          ) : (
            maps.map((map) => (
              <div
                key={map.id}
                onClick={() => router.push(`/map/${map.id}`)}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 cursor-pointer hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-medium text-gray-800">{map.title}</h3>
                    <p className="text-sm text-gray-400 mt-1">
                      {map._count.qas} 个问答 · {map._count.nodes} 个节点
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">
                      {new Date(map.updatedAt).toLocaleDateString()}
                    </span>
                    <button
                      onClick={(e) => handleDelete(map.id, e)}
                      className="text-gray-400 hover:text-red-500 p-1"
                    >
                      x
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  )
}
