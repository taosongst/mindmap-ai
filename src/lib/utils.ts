import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// 生成节点的自动布局位置
export function calculateNodePosition(
  parentPosition: { x: number; y: number } | null,
  siblingCount: number,
  index: number
): { x: number; y: number } {
  if (!parentPosition) {
    // 根节点
    return { x: 400, y: 50 }
  }

  const horizontalSpacing = 280
  const verticalSpacing = 150

  // 子节点水平分布在父节点下方
  const totalWidth = (siblingCount - 1) * horizontalSpacing
  const startX = parentPosition.x - totalWidth / 2

  return {
    x: startX + index * horizontalSpacing,
    y: parentPosition.y + verticalSpacing,
  }
}

// 截断文本
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength) + '...'
}
