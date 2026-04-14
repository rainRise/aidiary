/**
 * 语音转文字演示页面
 * 独立的语音识别功能测试页面
 */
import { useState, useCallback, useEffect } from 'react'

// 声明 Web Speech API 类型
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition
    webkitSpeechRecognition: typeof SpeechRecognition
  }
}

type RecognitionStatus = 'idle' | 'listening' | 'processing' | 'error'

export default function VoiceDemo() {
  const [isSupported, setIsSupported] = useState(false)
  const [status, setStatus] = useState<RecognitionStatus>('idle')
  const [transcript, setTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [language, setLanguage] = useState('zh-CN')
  const [history, setHistory] = useState<string[]>([])

  const recognitionRef = { current: null as any }

  // 检查浏览器支持
  useEffect(() => {
    const supported = 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window
    setIsSupported(supported)
  }, [])

  // 语言选项
  const languages = [
    { value: 'zh-CN', label: '中文' },
    { value: 'en-US', label: 'English' },
    { value: 'ja-JP', label: '日本語' },
    { value: 'ko-KR', label: '한국어' },
  ]

  // 开始识别
  const startListening = useCallback(() => {
    if (!isSupported) return

    const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SpeechRecognitionClass()

    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = language

    recognition.onstart = () => {
      setStatus('listening')
      setError(null)
    }

    recognition.onresult = (event: any) => {
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
        setTranscript(prev => prev + finalTranscript + '\n')
        setInterimTranscript('')
      } else {
        setInterimTranscript(interimText)
      }
    }

    recognition.onerror = (event: any) => {
      console.error('Recognition error:', event.error)
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
        default:
          setError(`错误: ${event.error}`)
      }
      setStatus('error')
    }

    recognition.onend = () => {
      if (status === 'listening') {
        setStatus('idle')
      }
    }

    recognitionRef.current = recognition
    recognition.start()
  }, [isSupported, language, status])

  // 停止识别
  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
    }
    setStatus('idle')
    setInterimTranscript('')
  }, [])

  // 切换录音
  const toggleRecording = useCallback(() => {
    if (status === 'listening') {
      stopListening()
    } else {
      setTranscript('')
      setError(null)
      startListening()
    }
  }, [status, startListening, stopListening])

  // 清空
  const clearTranscript = useCallback(() => {
    setTranscript('')
    setInterimTranscript('')
    setError(null)
    if (status === 'listening') {
      stopListening()
    }
    setStatus('idle')
  }, [status, stopListening])

  // 保存到历史
  const saveToHistory = useCallback(() => {
    if (transcript.trim()) {
      setHistory(prev => [transcript.trim(), ...prev.slice(0, 9)])
      setTranscript('')
    }
  }, [transcript])

  // 复制文本
  const copyText = useCallback(() => {
    const text = transcript || interimTranscript
    if (text) {
      navigator.clipboard.writeText(text)
    }
  }, [transcript, interimTranscript])

  // 组件卸载时停止
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort()
      }
    }
  }, [])

  const isListening = status === 'listening'

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* 标题 */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-gray-800 mb-3">
            🎤 语音转文字
          </h1>
          <p className="text-gray-600">
            使用浏览器原生语音识别技术，实时将语音转换为文字
          </p>
        </div>

        {/* 浏览器不支持提示 */}
        {!isSupported && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 mb-8 text-center">
            <div className="text-4xl mb-3">⚠️</div>
            <h2 className="text-xl font-semibold text-yellow-800 mb-2">
              浏览器不支持
            </h2>
            <p className="text-yellow-700">
              请使用 Chrome、Edge 或 Safari 浏览器访问此页面
            </p>
          </div>
        )}

        {/* 主功能卡片 */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
          {/* 语言选择 */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              识别语言
            </label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              disabled={isListening}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed transition-all"
            >
              {languages.map((lang) => (
                <option key={lang.value} value={lang.value}>
                  {lang.label}
                </option>
              ))}
            </select>
          </div>

          {/* 麦克风按钮 */}
          <div className="flex flex-col items-center mb-8">
            <button
              onClick={toggleRecording}
              disabled={!isSupported}
              className={`
                relative w-32 h-32 rounded-full flex items-center justify-center
                transition-all duration-300 transform
                ${isListening 
                  ? 'bg-red-500 hover:bg-red-600 animate-pulse scale-105 shadow-lg shadow-red-300' 
                  : 'bg-blue-500 hover:bg-blue-600 shadow-lg shadow-blue-300 hover:scale-105'
                }
                ${!isSupported ? 'opacity-50 cursor-not-allowed' : ''}
                disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
              `}
            >
              {isListening ? (
                <>
                  {/* 录音中动画 */}
                  <div className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-25" />
                  <svg className="w-16 h-16 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5zm6 6c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                  </svg>
                </>
              ) : (
                <svg className="w-16 h-16 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5zm6 6c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                </svg>
              )}
            </button>
            
            {/* 状态文字 */}
            <div className="mt-4 text-lg font-medium">
              {isListening ? (
                <span className="text-red-500 flex items-center gap-2">
                  <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                  正在聆听...
                </span>
              ) : status === 'error' ? (
                <span className="text-red-500">识别出错</span>
              ) : (
                <span className="text-gray-600">点击麦克风开始说话</span>
              )}
            </div>
          </div>

          {/* 错误信息 */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
              <div className="flex items-center gap-2 text-red-700">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
                </svg>
                <span>{error}</span>
              </div>
            </div>
          )}

          {/* 识别结果 */}
          <div className="bg-gray-50 rounded-xl p-4 min-h-[120px] mb-4">
            {interimTranscript ? (
              <p className="text-gray-500 italic">{interimTranscript}</p>
            ) : transcript ? (
              <p className="text-gray-800 whitespace-pre-wrap">{transcript}</p>
            ) : (
              <p className="text-gray-400 italic">识别结果将显示在这里...</p>
            )}
          </div>

          {/* 操作按钮 */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={copyText}
              disabled={!transcript && !interimTranscript}
              className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/>
              </svg>
              复制文本
            </button>
            <button
              onClick={saveToHistory}
              disabled={!transcript.trim()}
              className="flex-1 px-4 py-2 bg-blue-100 hover:bg-blue-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/>
              </svg>
              保存记录
            </button>
            <button
              onClick={clearTranscript}
              className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
              </svg>
              清空
            </button>
          </div>
        </div>

        {/* 历史记录 */}
        {history.length > 0 && (
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              历史记录
            </h2>
            <div className="space-y-3">
              {history.map((item, index) => (
                <div
                  key={index}
                  className="bg-gray-50 rounded-lg p-4 text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => {
                    navigator.clipboard.writeText(item)
                  }}
                >
                  <div className="text-sm text-gray-500 mb-1">
                    记录 {history.length - index}
                  </div>
                  <p className="whitespace-pre-wrap line-clamp-3">{item}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 底部信息 */}
        <div className="text-center mt-8 text-gray-500 text-sm">
          <p>基于 Web Speech API 构建</p>
          <p className="mt-1">推荐使用 Chrome、Edge 或 Safari 浏览器</p>
        </div>
      </div>
    </div>
  )
}
