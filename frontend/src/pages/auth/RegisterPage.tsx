// 注册页面 - Apple风格
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { authService } from '@/services/auth.service'
import { toast } from '@/components/ui/toast'

export default function RegisterPage() {
  const navigate = useNavigate()
  const { register, isLoading, error, clearError } = useAuthStore()

  const [step, setStep] = useState<1 | 2>(1)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [username, setUsername] = useState('')
  const [code, setCode] = useState('')
  const [countdown, setCountdown] = useState(0)
  const [showPassword, setShowPassword] = useState(false)

  const handleSendCode = async () => {
    if (!email || !email.includes('@')) {
      toast('请输入有效的邮箱地址', 'error')
      return
    }
    try {
      await authService.sendRegisterCode(email)
      setStep(2)
      toast('验证码已发送到您的邮箱', 'success')
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

    if (!email || !password || !code) {
      toast('请填写完整信息', 'error')
      return
    }
    if (password !== confirmPassword) {
      toast('两次输入的密码不一致', 'error')
      return
    }
    if (password.length < 6) {
      toast('密码长度至少6位', 'error')
      return
    }

    try {
      await register(email, password, code, username || undefined)
      toast('注册成功', 'success')
      navigate('/login')
    } catch (err: any) {
      console.error('Register failed:', err)
    }
  }

  const inputClass = "w-full h-12 px-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white/90 text-sm placeholder:text-white/20 outline-none transition-all duration-200 focus:border-primary/50 focus:bg-white/[0.06]"

  return (
    <div className="min-h-screen flex">
      {/* 左侧品牌区域 */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden items-center justify-center">
        <div className="absolute inset-0 bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a]" />
        <div className="absolute top-1/3 right-1/4 w-80 h-80 bg-primary/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/3 left-1/3 w-56 h-56 bg-emerald-500/5 rounded-full blur-[80px]" />
        <div className="relative z-10 px-16 max-w-lg">
          <div className="mb-8">
            <span className="text-primary text-lg font-semibold tracking-wide">印记</span>
          </div>
          <h2 className="text-4xl font-bold text-white/90 leading-tight mb-4">
            开始记录，<br />遇见更好的自己
          </h2>
          <p className="text-white/40 text-sm leading-relaxed">
            创建你的印记账号，AI 将随着你的每一篇日记更加了解你。
            从今天起，让文字成为通往内心的桥梁。
          </p>

          <div className="mt-12 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center text-primary text-xs">1</div>
              <span className="text-white/50 text-sm">验证邮箱，获取验证码</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-white/[0.04] flex items-center justify-center text-white/30 text-xs">2</div>
              <span className="text-white/30 text-sm">设置密码，完成注册</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-white/[0.04] flex items-center justify-center text-white/30 text-xs">3</div>
              <span className="text-white/30 text-sm">开始书写第一篇日记</span>
            </div>
          </div>
        </div>
      </div>

      {/* 右侧注册表单 */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-6 sm:px-12">
        <div className="w-full max-w-[400px] animate-fade-in">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white/95 tracking-tight">创建账号</h1>
            <p className="text-white/40 text-sm mt-2">
              {step === 1 ? '输入邮箱开始注册' : '完善信息，完成注册'}
            </p>
          </div>

          {/* 步骤指示器 */}
          <div className="flex items-center gap-2 mb-8">
            <div className={`h-1 rounded-full transition-all duration-500 ${step >= 1 ? 'bg-primary w-16' : 'bg-white/10 w-8'}`} />
            <div className={`h-1 rounded-full transition-all duration-500 ${step >= 2 ? 'bg-primary w-16' : 'bg-white/10 w-8'}`} />
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Step 1: 邮箱验证 */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-white/50 uppercase tracking-wider">
                邮箱
              </label>
              <div className="flex gap-3">
                <input
                  type="email"
                  placeholder="请输入邮箱"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={step === 2}
                  className={`${inputClass} flex-1 disabled:opacity-50`}
                />
                {step === 1 && (
                  <button
                    type="button"
                    onClick={handleSendCode}
                    disabled={!email || !email.includes('@') || countdown > 0}
                    className="shrink-0 h-12 px-5 rounded-xl text-sm font-medium bg-primary hover:bg-primary/90 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200"
                  >
                    {countdown > 0 ? `${countdown}s` : '发送验证码'}
                  </button>
                )}
              </div>
              {step === 2 && (
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-[11px] text-white/30 hover:text-primary transition-colors"
                >
                  更换邮箱
                </button>
              )}
            </div>

            {/* Step 2: 验证码 + 密码 */}
            {step === 2 && (
              <div className="space-y-5 animate-fade-in">
                {/* 验证码 */}
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
                      className={`${inputClass} flex-1 text-center tracking-[0.3em] placeholder:tracking-normal`}
                    />
                    <button
                      type="button"
                      onClick={handleSendCode}
                      disabled={countdown > 0}
                      className="shrink-0 h-12 px-4 rounded-xl text-sm bg-white/[0.06] border border-white/[0.08] text-white/60 hover:bg-white/[0.1] disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200"
                    >
                      {countdown > 0 ? `${countdown}s` : '重发'}
                    </button>
                  </div>
                </div>

                {/* 用户名 */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-white/50 uppercase tracking-wider">
                    用户名 <span className="text-white/20 normal-case">（选填）</span>
                  </label>
                  <input
                    type="text"
                    placeholder="如何称呼你"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className={inputClass}
                  />
                </div>

                {/* 密码 */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-white/50 uppercase tracking-wider">
                    密码
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="至少6位密码"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={`${inputClass} pr-12`}
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
                  {password && (
                    <div className="flex gap-1.5 mt-1">
                      {[1, 2, 3, 4].map((i) => (
                        <div
                          key={i}
                          className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                            password.length >= i * 3
                              ? password.length >= 12
                                ? 'bg-emerald-400'
                                : password.length >= 8
                                  ? 'bg-primary'
                                  : 'bg-amber-400'
                              : 'bg-white/10'
                          }`}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* 确认密码 */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-white/50 uppercase tracking-wider">
                    确认密码
                  </label>
                  <input
                    type="password"
                    placeholder="再次输入密码"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={inputClass}
                  />
                  {confirmPassword && password !== confirmPassword && (
                    <p className="text-[11px] text-red-400/70">密码不一致</p>
                  )}
                </div>
              </div>
            )}

            {/* 错误提示 */}
            {error && (
              <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/15 text-red-400 text-sm animate-fade-in">
                {error}
              </div>
            )}

            {/* 注册按钮 */}
            {step === 2 && (
              <button
                type="submit"
                disabled={!code || !password || password !== confirmPassword || isLoading}
                className="w-full h-12 rounded-xl text-sm font-semibold bg-primary hover:bg-primary/90 text-white transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" />
                ) : '注册'}
              </button>
            )}

            {/* 分隔线 */}
            <div className="flex items-center gap-4 py-1">
              <div className="flex-1 h-px bg-white/[0.06]" />
              <span className="text-[11px] text-white/20">或</span>
              <div className="flex-1 h-px bg-white/[0.06]" />
            </div>

            {/* 登录入口 */}
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="w-full h-12 rounded-xl text-sm font-medium bg-white/[0.04] border border-white/[0.08] text-white/70 hover:bg-white/[0.08] hover:text-white/90 transition-all duration-200 active:scale-[0.98]"
            >
              已有账号？立即登录
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
