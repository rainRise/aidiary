/**
 * 语音服务
 * 提供语音识别相关的API调用（用于第三方API方案）
 * 
 * 注意：当前使用浏览器原生 Web Speech API，
 * 此服务主要用于第三方API（如阿里云、讯飞）方案
 */

import api from './api'

/** 音频文件上传响应 */
export interface AudioUploadResponse {
  url: string
  duration?: number
}

/** 语音识别结果 */
export interface SpeechRecognitionResult {
  text: string
  confidence: number
  segments?: Array<{
    text: string
    start: number
    end: number
  }>
}

/** 语音服务配置 */
export interface SpeechServiceConfig {
  /** 识别语言，默认中文 */
  language?: string
  /** 是否添加标点 */
  punctuation?: boolean
}

/**
 * 语音服务
 * 用于调用后端语音识别API
 */
export const speechService = {
  /**
   * 上传音频文件并获取识别结果
   * @param file 音频文件
   * @param config 识别配置
   */
  uploadAndRecognize: async (
    file: File,
    config?: SpeechServiceConfig
  ): Promise<SpeechRecognitionResult> => {
    const formData = new FormData()
    formData.append('file', file)
    
    if (config?.language) {
      formData.append('language', config.language)
    }
    
    const response = await api.post<SpeechRecognitionResult>(
      '/api/v1/speech/recognize',
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000, // 语音识别可能需要更长时间
      }
    )
    return response.data
  },

  /**
   * 检查语音识别API是否可用
   */
  checkHealth: async (): Promise<boolean> => {
    try {
      const response = await api.get<{ status: string }>('/api/v1/speech/health')
      return response.data.status === 'ok'
    } catch {
      return false
    }
  },

  /**
   * 获取支持的语言列表
   */
  getSupportedLanguages: async (): Promise<string[]> => {
    const response = await api.get<{ languages: string[] }>('/api/v1/speech/languages')
    return response.data.languages
  },
}

/**
 * 浏览器原生语音识别工具类
 * 提供 Web Speech API 的便捷封装
 */
export class BrowserSpeechRecognizer {
  private recognition: SpeechRecognition | null = null
  private isInitialized = false

  /**
   * 初始化语音识别
   */
  init(): boolean {
    if (this.isInitialized) return true

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      console.error('Speech Recognition is not supported in this browser')
      return false
    }

    this.recognition = new SpeechRecognition()
    this.recognition.continuous = true
    this.recognition.interimResults = true
    this.recognition.lang = 'zh-CN'
    
    this.isInitialized = true
    return true
  }

  /**
   * 设置语言
   */
  setLanguage(lang: string): void {
    if (this.recognition) {
      this.recognition.lang = lang
    }
  }

  /**
   * 开始识别
   */
  start(onResult: (text: string, isFinal: boolean) => void, onError?: (error: string) => void): void {
    if (!this.recognition || !this.isInitialized) {
      if (!this.init()) {
        onError?.('语音识别初始化失败')
        return
      }
    }

    this.recognition!.onresult = (event: SpeechRecognitionEvent) => {
      let resultText = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        resultText += event.results[i][0].transcript
      }
      onResult(resultText, event.results[event.results.length - 1].isFinal)
    }

    this.recognition!.onerror = (event: SpeechRecognitionErrorEvent) => {
      onError?.(event.error)
    }

    this.recognition!.start()
  }

  /**
   * 停止识别
   */
  stop(): void {
    if (this.recognition) {
      this.recognition.stop()
    }
  }

  /**
   * 中止识别
   */
  abort(): void {
    if (this.recognition) {
      this.recognition.abort()
    }
  }

  /**
   * 检查是否支持语音识别
   */
  static isSupported(): boolean {
    return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window
  }
}

// 导出便捷函数
export const browserSpeechRecognizer = {
  /**
   * 检查浏览器是否支持语音识别
   */
  isSupported: BrowserSpeechRecognizer.isSupported,

  /**
   * 创建语音识别实例
   */
  create(): BrowserSpeechRecognizer {
    return new BrowserSpeechRecognizer()
  },
}

export default speechService
