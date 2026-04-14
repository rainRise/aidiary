/**
 * 语音输入组件
 * 提供语音转文字输入功能，支持实时显示识别结果
 */
import { useEffect, useCallback } from 'react'
import { Mic, MicOff, Loader2, X, AlertCircle } from 'lucide-react'
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition'
import { Button } from '@/components/ui/button'

export interface VoiceInputProps {
  /** 语言设置，默认中文 */
  language?: string
  /** 是否显示识别结果文字 */
  showTranscript?: boolean
  /** 实时文本回调 */
  onTranscriptChange?: (text: string, isFinal: boolean) => void
  /** 结束时回调 */
  onFinal?: (text: string) => void
  /** 是否禁用 */
  disabled?: boolean
  /** 自定义类名 */
  className?: string
  /** 按钮大小 */
  size?: 'sm' | 'md' | 'lg'
  /** 是否在组件卸载时自动停止 */
  autoStopOnUnmount?: boolean
}

/**
 * 语音输入组件
 */
export function VoiceInput({
  language = 'zh-CN',
  showTranscript = true,
  onTranscriptChange,
  onFinal,
  disabled = false,
  className = '',
  size = 'md',
  autoStopOnUnmount = true,
}: VoiceInputProps) {
  const {
    transcript,
    interimTranscript,
    status,
    error,
    isSupported,
    startListening,
    stopListening,
    resetTranscript,
  } = useSpeechRecognition({
    lang: language,
    continuous: false,
    interimResults: true,
  })

  // 监听转录变化
  useEffect(() => {
    if (onTranscriptChange) {
      const fullText = transcript + interimTranscript
      onTranscriptChange(fullText, false)
    }
  }, [transcript, interimTranscript, onTranscriptChange])

  // 监听最终结果
  useEffect(() => {
    if (transcript && status === 'idle') {
      onFinal?.(transcript)
    }
  }, [transcript, status, onFinal])

  // 组件卸载时停止
  useEffect(() => {
    return () => {
      if (autoStopOnUnmount && status === 'listening') {
        stopListening()
      }
    }
  }, [autoStopOnUnmount, status, stopListening])

  // 切换录音状态
  const toggleRecording = useCallback(() => {
    if (status === 'listening') {
      stopListening()
    } else {
      resetTranscript()
      startListening()
    }
  }, [status, stopListening, resetTranscript, startListening])

  // 尺寸映射
  const sizeMap = {
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-12 w-12',
  }

  // 图标尺寸
  const iconSizeMap = {
    sm: 16,
    md: 20,
    lg: 24,
  }

  // 浏览器不支持
  if (!isSupported) {
    return (
      <div className={`inline-flex ${className}`}>
        <Button
          variant="ghost"
          size="icon"
          disabled
          className={`text-gray-400 cursor-not-allowed ${sizeMap[size]}`}
          title="您的浏览器不支持语音识别"
        >
          <MicOff size={iconSizeMap[size]} />
        </Button>
      </div>
    )
  }

  const isListening = status === 'listening'
  const hasError = status === 'error'
  const hasTranscript = transcript || interimTranscript

  return (
    <div className={`inline-flex flex-col ${className}`}>
      {/* 控制按钮 */}
      <div className="flex items-center gap-1">
        <Button
          variant={isListening ? 'default' : 'ghost'}
          size="icon"
          onClick={toggleRecording}
          disabled={disabled}
          className={`
            ${sizeMap[size]} 
            transition-all duration-200
            ${isListening 
              ? 'bg-red-500 hover:bg-red-600 animate-pulse text-white' 
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }
            ${hasError ? 'bg-red-100 text-red-600 hover:bg-red-100' : ''}
          `}
          title={isListening ? '点击停止' : '点击开始语音输入'}
        >
          {isListening ? (
            <Mic size={iconSizeMap[size]} className="animate-pulse" />
          ) : hasError ? (
            <AlertCircle size={iconSizeMap[size]} />
          ) : (
            <Mic size={iconSizeMap[size]} />
          )}
        </Button>

        {/* 录音中显示停止按钮 */}
        {isListening && (
          <Button
            variant="ghost"
            size="icon"
            onClick={stopListening}
            className={`${sizeMap[size]} text-gray-500 hover:text-gray-700`}
            title="停止录音"
          >
            <X size={iconSizeMap[size]} />
          </Button>
        )}
      </div>

      {/* 识别结果展示 */}
      {showTranscript && (
        <div className="mt-2 min-h-[24px]">
          {/* 加载状态 */}
          {status === 'listening' && !hasTranscript && (
            <div className="flex items-center gap-1 text-sm text-gray-500">
              <Loader2 size={14} className="animate-spin" />
              <span>正在聆听...</span>
            </div>
          )}

          {/* 实时转录 */}
          {interimTranscript && (
            <div className="text-sm text-gray-500 italic">
              {interimTranscript}
            </div>
          )}

          {/* 最终结果 */}
          {transcript && (
            <div className="text-sm text-gray-700">
              {transcript}
            </div>
          )}

          {/* 错误信息 */}
          {error && (
            <div className="flex items-center gap-1 text-sm text-red-500">
              <AlertCircle size={14} />
              <span>{error}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default VoiceInput
