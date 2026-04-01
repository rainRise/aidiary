import type { ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'

interface ConfirmDialogProps {
  open: boolean
  title: string
  description?: ReactNode
  confirmText?: string
  cancelText?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmText = '确认',
  cancelText = '取消',
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="关闭确认弹窗"
        className="absolute inset-0 bg-[#2d2621]/35 backdrop-blur-[2px]"
        onClick={onCancel}
      />

      <div className="relative w-full max-w-md rounded-3xl border border-[#e8ddd5] bg-[#fffdfa] p-6 shadow-[0_24px_60px_rgba(76,49,27,0.18)]">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 h-9 w-9 rounded-2xl bg-[#f8ece8] text-[#c46f5b] flex items-center justify-center">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-stone-700 leading-6">{title}</h3>
            {description ? (
              <div className="mt-2 text-sm leading-6 text-stone-500">
                {description}
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="h-10 px-4 rounded-xl border border-[#e7dbd5] bg-white text-sm font-medium text-stone-500 hover:bg-[#f8f5f2] transition-all active:scale-[0.98]"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="h-10 px-5 rounded-xl text-sm font-semibold text-white shadow-sm transition-all active:scale-[0.98]"
            style={
              danger
                ? { background: 'linear-gradient(135deg, #e88f7b, #c67b6c)' }
                : { background: 'linear-gradient(135deg, #e88f7b, #a09ab8)' }
            }
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}

