// 登录页面 - Apple风格
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { authService } from '@/services/auth.service'
import { toast } from '@/components/ui/toast'

type LoginMode = 'password' | 'code'

export default function LoginPage() {
  const navigate = useNavigate()
  const { login, loginWithPassword, isLoading, error, clearError } = useAuthStore()

  const [mode, setMode] = useState<LoginMode>('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [code, setCode] = useState('')
  const [countdown, setCountdown] = useState(0)

  const handleSendCode = async () => {
    if (!email || !email.includes('@')) {
      toast('请输入有效的邮箱地址', 'error')
      return
    }
    try {
      await authService.sendLoginCode(email)
      toast('验证码已发送', 'success')
      setCountdown(60)
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) { clearInterval(timer); return 0 }
          return prev - 1
        })
      }, 1000)
    } catch (err: any) {
      toast(err.response?.data?.detail || '发送验证码失败', 'error')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    clearError()

    if (!email) {
      toast('请输入邮箱地址', 'error')
      return
    }

    try {
      if (mode === 'password') {
        if (!password) { toast('请输入密码', 'error'); return }
        await loginWithPassword(email, password)
      } else {
        if (!code) { toast('请输入验证码', 'error'); return }
        await login(email, code)
      }
      navigate('/')
    } catch (err: any) {
      console.error('Login failed:', err)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* 左侧品牌区域 */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden items-center justify-center">
        <div className="absolute inset-0 bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a]" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-primary/5 rounded-full blur-[80px]" />
        <div className="relative z-10 px-16 max-w-lg">
          <div className="mb-8">
            <span className="text-primary text-lg font-semibold tracking-wide">印记</span>
            <span className="ml-3 text-xs text-white/30 border border-white/10 rounded-full px-2.5 py-0.5">
              Beta
            </span>
          </div>
          <h2 className="text-4xl font-bold text-white/90 leading-tight mb-4">
            你的每一天，<br />都值得被记住
          </h2>
          <p className="text-white/40 text-sm leading-relaxed">
            基于 AI 的智能日记应用，通过深度分析帮助你更好地认识自己。
            记录生活，探索内心，让每一段文字都有温度。
          </p>
          <div className="mt-12 flex gap-8 text-sm">
            <div>
              <div className="text-2xl font-bold text-white/80">AI</div>
              <div className="text-white/30 mt-1">智能分析</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-white/80">RAG</div>
              <div className="text-white/30 mt-1">知识图谱</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-white/80">E2E</div>
              <div className="text-white/30 mt-1">隐私加密</div>
            </div>
          </div>
        </div>
      </div>

      {/* 右侧登录表单 */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-6 sm:px-12">
        <div className="w-full max-w-[400px] animate-fade-in">
          <div className="mb-10">
            <h1 className="text-3xl font-bold text-white/95 tracking-tight">欢迎回来</h1>
            <p className="text-white/40 text-sm mt-2">请输入您的账号信息登录</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* 邮箱 */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-white/50 uppercase tracking-wider">
                邮箱
              </label>
              <input
                type="email"
                placeholder="请输入邮箱"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-12 px-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white/90 text-sm placeholder:text-white/20 outline-none transition-all duration-200 focus:border-primary/50 focus:bg-white/[0.06]"
              />
              <p className="text-[11px] text-white/25">请使用注册时的邮箱登录</p>
            </div>

            {/* 密码/验证码切换 */}
            {mode === 'password' ? (
              <div className="space-y-2">
                <label className="text-xs font-medium text-white/50 uppercase tracking-wider">
                  密码
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="请输入密码"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full h-12 px-4 pr-12 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white/90 text-sm placeholder:text-white/20 outline-none transition-all duration-200 focus:border-primary/50 focus:bg-white/[0.06]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      {showPassword ? (
                        <>
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </>
                      ) : (
                        <>
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                          <line x1="1" y1="1" x2="23" y2="23" />
                        </>
                      )}
                    </svg>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-xs font-medium text-white/50 uppercase tracking-wider">
                  验证码
                </label>
                <div className="flex gap-3">
                  <input
                    type="text"
                    placeholder="6位验证码"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    maxLength={6}
                    className="flex-1 h-12 px-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white/90 text-sm text-center tracking-[0.3em] placeholder:text-white/20 placeholder:tracking-normal outline-none transition-all duration-200 focus:border-primary/50 focus:bg-white/[0.06]"
                  />
                  <button
                    type="button"
                    onClick={handleSendCode}
                    disabled={!email || !email.includes('@') || countdown > 0}
                    className="shrink-0 h-12 px-5 rounded-xl text-sm font-medium bg-white/[0.06] border border-white/[0.08] text-white/70 hover:bg-white/[0.1] hover:text-white/90 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200"
                  >
                    {countdown > 0 ? `${countdown}s` : '发送'}
                  </button>
                </div>
              </div>
            )}

            {/* 记住我 / 切换登录方式 */}
            <div className="flex items-center justify-between text-xs">
              <label className="flex items-center gap-2 text-white/40 cursor-pointer group">
                <div className="w-4 h-4 rounded border border-white/15 group-hover:border-white/30 transition-colors" />
                记住我
              </label>
              <button
                type="button"
                onClick={() => { setMode(mode === 'password' ? 'code' : 'password'); clearError() }}
                className="text-white/40 hover:text-primary transition-colors"
              >
                {mode === 'password' ? '验证码登录' : '密码登录'}
              </button>
            </div>

            {/* 错误提示 */}
            {error && (
              <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/15 text-red-400 text-sm animate-fade-in">
                {error}
              </div>
            )}

            {/* 登录按钮 */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 rounded-xl text-sm font-semibold bg-primary hover:bg-primary/90 text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" />
              ) : '登录'}
            </button>

            {/* 分隔线 */}
            <div className="flex items-center gap-4 py-1">
              <div className="flex-1 h-px bg-white/[0.06]" />
              <span className="text-[11px] text-white/20">或</span>
              <div className="flex-1 h-px bg-white/[0.06]" />
            </div>

            {/* 注册入口 */}
            <button
              type="button"
              onClick={() => navigate('/register')}
              className="w-full h-12 rounded-xl text-sm font-medium bg-white/[0.04] border border-white/[0.08] text-white/70 hover:bg-white/[0.08] hover:text-white/90 transition-all duration-200 active:scale-[0.98]"
            >
              注册新账号
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
