/**
 * 语音识别 Hook
 * 使用浏览器原生 Web Speech API 实现语音转文字
 */

import { useState, useEffect, useCallback, useRef } from 'react'

// 语音识别结果类型
export interface SpeechRecognitionResult {
  transcript: string
  confidence: number
  isFinal: boolean
}

// 语音识别状态
export type SpeechRecognitionStatus = 'idle' | 'listening' | 'processing' | 'error'

// 语音识别配置
export interface SpeechRecognitionConfig {
  lang?: string
  continuous?: boolean
  interimResults?: boolean
  maxAlternatives?: number
}

// 语音识别返回结果
export interface UseSpeechRecognitionReturn {
  transcript: string
  interimTranscript: string
  status: SpeechRecognitionStatus
  error: string | null
  isSupported: boolean
  startListening: () => void
  stopListening: () => void
  resetTranscript: () => void
}

// 声明 Web Speech API 类型
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition
    webkitSpeechRecognition: typeof SpeechRecognition
  }
}

/**
 * 语音识别 Hook
 * @param config 识别配置
 * @returns 语音识别状态和方法
 */
export function useSpeechRecognition(
  config: SpeechRecognitionConfig = {}
): UseSpeechRecognitionReturn {
  const {
    lang = 'zh-CN',
    continuous = false,
    interimResults = true,
    maxAlternatives = 1,
  } = config

  const [transcript, setTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [status, setStatus] = useState<SpeechRecognitionStatus>('idle')
  const [error, setError] = useState<string | null>(null)

  const recognitionRef = useRef<SpeechRecognition | null>(null)

  // 检查浏览器是否支持语音识别
  const isSupported = typeof window !== 'undefined' && 
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

  // 初始化语音识别
  useEffect(() => {
    if (!isSupported) {
      setError('您的浏览器不支持语音识别功能')
      return
    }

    const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SpeechRecognitionClass()

    recognition.continuous = continuous
    recognition.interimResults = interimResults
    recognition.maxAlternatives = maxAlternatives
    recognition.lang = lang

    // 开始识别
    recognition.onstart = () => {
      setStatus('listening')
      setError(null)
    }

    // 识别结果
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = ''
      let interimText = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          finalTranscript += result[0].transcript
        } else {
          interimText += result[0].transcript
        }
      }

      if (finalTranscript) {
        setTranscript((prev) => prev + finalTranscript)
        setInterimTranscript('')
      } else {
        setInterimTranscript(interimText)
      }
    }

    // 识别结束
    recognition.onend = () => {
      if (status === 'listening') {
        setStatus('idle')
      }
    }

    // 错误处理
    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error)
      
      switch (event.error) {
        case 'no-speech':
          setError('未检测到语音，请重试')
          break
        case 'audio-capture':
          setError('无法访问麦克风，请检查权限设置')
          break
        case 'not-allowed':
          setError('麦克风权限被拒绝，请在浏览器设置中允许访问')
          break
        case 'network':
          setError('网络错误，请检查网络连接')
          break
        case 'aborted':
          setError('语音识别已停止')
          break
        default:
          setError(`语音识别错误: ${event.error}`)
      }
      setStatus('error')
    }

    recognitionRef.current = recognition

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort()
      }
    }
  }, [isSupported, lang, continuous, interimResults, maxAlternatives, status])

  // 开始监听
  const startListening = useCallback(() => {
    if (!isSupported || !recognitionRef.current) {
      setError('语音识别不可用')
      return
    }

    if (status === 'listening') {
      return
    }

    setError(null)
    setStatus('listening')
    
    try {
      recognitionRef.current.start()
    } catch (err) {
      console.error('Failed to start recognition:', err)
      // 如果已经在运行，先停止再启动
      recognitionRef.current.abort()
      try {
        recognitionRef.current.start()
      } catch (e) {
        setError('启动语音识别失败')
        setStatus('error')
      }
    }
  }, [isSupported, status])

  // 停止监听
  const stopListening = useCallback(() => {
    if (recognitionRef.current && status === 'listening') {
      recognitionRef.current.stop()
      setStatus('idle')
    }
  }, [status])

  // 重置转录内容
  const resetTranscript = useCallback(() => {
    setTranscript('')
    setInterimTranscript('')
    setError(null)
  }, [])

  return {
    transcript,
    interimTranscript,
    status,
    error,
    isSupported,
    startListening,
    stopListening,
    resetTranscript,
  }
}

export default useSpeechRecognition
