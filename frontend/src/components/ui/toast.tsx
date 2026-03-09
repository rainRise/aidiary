// Toast通知组件 - Apple风格
import { useState, useEffect, useCallback } from 'react'
import { cn } from '@/utils/cn'

interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'info'
}

let addToastFn: ((message: string, type?: Toast['type']) => void) | null = null

export function toast(message: string, type: Toast['type'] = 'info') {
  addToastFn?.(message, type)
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = Date.now().toString()
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 3000)
  }, [])

  useEffect(() => {
    addToastFn = addToast
    return () => { addToastFn = null }
  }, [addToast])

  return (
    <>
      {children}
      <div className="fixed top-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              'pointer-events-auto px-5 py-3 rounded-2xl text-sm font-medium shadow-2xl',
              'backdrop-blur-xl border animate-slide-in',
              'transition-all duration-300',
              t.type === 'success' && 'bg-emerald-500/15 border-emerald-500/20 text-emerald-400',
              t.type === 'error' && 'bg-red-500/15 border-red-500/20 text-red-400',
              t.type === 'info' && 'bg-white/10 border-white/10 text-white/90',
            )}
          >
            <div className="flex items-center gap-2">
              {t.type === 'success' && <span>&#10003;</span>}
              {t.type === 'error' && <span>&#10007;</span>}
              {t.type === 'info' && <span className="opacity-60">&#9432;</span>}
              {t.message}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
