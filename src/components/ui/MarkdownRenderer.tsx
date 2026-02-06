'use client'

import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'

interface MarkdownRendererProps {
  content: string
  className?: string
  darkMode?: boolean
}

export function MarkdownRenderer({ content, className, darkMode = false }: MarkdownRendererProps) {
  return (
    <div className={`${className} overflow-x-auto`}>
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          // 自定义水平分割线样式
          hr: () => (
            <hr className={`my-6 border-0 h-px ${darkMode ? 'bg-[#444]' : 'bg-gray-200'}`} />
          ),
          // 自定义加粗标题样式（用于 **1. 标题** 格式）
          strong: ({ children }) => (
            <strong className={`font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              {children}
            </strong>
          ),
          // 优化段落间距
          p: ({ children }) => (
            <p className="mb-4 last:mb-0">{children}</p>
          ),
          // 优化列表样式
          ul: ({ children }) => (
            <ul className="mb-4 pl-5 list-disc space-y-1">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-4 pl-5 list-decimal space-y-1">{children}</ol>
          ),
          // 优化代码块样式
          code: ({ className: codeClassName, children, ...props }) => {
            const isInline = !codeClassName
            if (isInline) {
              return (
                <code
                  className={`px-1.5 py-0.5 rounded text-sm ${
                    darkMode
                      ? 'bg-[#2f2f2f] text-[#e06c75]'
                      : 'bg-gray-100 text-red-600'
                  }`}
                  {...props}
                >
                  {children}
                </code>
              )
            }
            return (
              <code className={codeClassName} {...props}>
                {children}
              </code>
            )
          },
          // 代码块容器
          pre: ({ children }) => (
            <pre
              className={`mb-4 p-4 rounded-lg overflow-x-auto text-sm ${
                darkMode
                  ? 'bg-[#1a1a1a] text-[#ececec]'
                  : 'bg-gray-900 text-gray-100'
              }`}
            >
              {children}
            </pre>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
