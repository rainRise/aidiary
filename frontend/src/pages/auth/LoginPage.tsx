// 登录页面 - 温暖柔和心理日记风格
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { authService } from '@/services/auth.service'
import { toast } from '@/components/ui/toast'
import { Sparkles, Leaf, Brain } from 'lucide-react'
import SliderCaptcha, { type CaptchaResult } from '@/components/common/SliderCaptcha'

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
  const [showCaptcha, setShowCaptcha] = useState(false)

  const handleRequestCode = () => {
    if (!email || !email.includes('@')) {
      toast('请输入有效的邮箱地址', 'error')
      return
    }
    setShowCaptcha(true)
  }

  const handleCaptchaSuccess = async (captchaResult: CaptchaResult) => {
    setShowCaptcha(false)
    try {
      await authService.sendLoginCode(email, captchaResult)
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
    if (!email) { toast('请输入邮箱地址', 'error'); return }
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

  const inputClass = "w-full h-12 px-4 rounded-2xl bg-white/90 border border-stone-200 text-stone-700 text-sm placeholder:text-stone-300 outline-none transition-all duration-200 focus:border-[#d8b8a8] focus:ring-2 focus:ring-[#f4e6df] shadow-sm"

  return (
    <div className="min-h-screen flex" style={{ background: 'linear-gradient(158deg, #f8f5ef 0%, #f2eef5 58%, #f5f2ee 100%)' }}>
      {/* 左侧品牌区域 */}
      <div className="hidden lg:flex lg:w-[45%] relative overflow-hidden items-center justify-center p-16">
        {/* 晨雾纸感背景图 */}
        <img
          src="/branding/login-morning-mist-bg.jpg"
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(120deg, rgba(248,245,239,0.86) 0%, rgba(245,242,238,0.72) 48%, rgba(242,238,245,0.82) 100%)' }} />
        <div className="absolute top-20 left-16 w-72 h-72 rounded-full opacity-25 animate-float"
          style={{ background: 'radial-gradient(circle, rgba(173,166,191,0.22), rgba(248,245,239,0))' }} />
        <div className="absolute bottom-24 right-8 w-56 h-56 rounded-full opacity-25 animate-float"
          style={{ animationDelay: '1.5s', background: 'radial-gradient(circle, rgba(235,143,123,0.22), rgba(248,245,239,0))' }} />

        <div className="relative z-10 max-w-md">
          <div className="mb-10 flex items-center gap-3">
            <img
              src="/branding/yinji-logo-nanobanana-v1_1.png"
              alt="印记 Logo"
              className="w-10 h-10 rounded-2xl object-cover shadow-md"
            />
            <span className="text-stone-700 text-xl font-semibold">印记</span>
            <span className="text-xs text-stone-400 bg-[#f5efea] border border-[#e7dbd5] rounded-full px-2.5 py-0.5">Beta</span>
          </div>

          <h2 className="text-4xl font-bold leading-tight mb-5" style={{ color: '#3d2b2b' }}>
            你的每一天，<br />
            <span className="text-gradient">都值得被记住</span>
          </h2>
          <p className="text-stone-500 text-sm leading-relaxed mb-12">
            基于 AI 的智能日记应用，通过深度心理分析帮助你更好地认识自己。
            记录生活，探索内心，让每一段文字都有温度。
          </p>

          <div className="space-y-4">
            {[
              { icon: <Brain className="w-5 h-5 text-[#b56f61]" />, title: 'AI 深度分析', desc: '萨提亚冰山模型，看见内心深处' },
              { icon: <Leaf className="w-5 h-5 text-emerald-400" />, title: '情绪追踪', desc: '可视化情绪变化，了解自己的规律' },
              { icon: <Sparkles className="w-5 h-5 text-amber-400" />, title: '疗愈回应', desc: '温暖的 AI 反馈，给你情感支持' },
            ].map((item) => (
              <div key={item.title} className="flex items-start gap-4 p-4 rounded-2xl bg-white/70 backdrop-blur-sm border border-[#e9e3de]">
                <span className="mt-0.5">{item.icon}</span>
                <div>
                  <div className="text-sm font-semibold text-stone-700">{item.title}</div>
                  <div className="text-xs text-stone-400 mt-0.5">{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 右侧登录表单 */}
      <div className="w-full lg:w-[55%] flex items-center justify-center px-6 sm:px-16">
        <div className="w-full max-w-[420px] animate-fade-in">
          {/* 移动端logo */}
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <img
              src="/branding/yinji-logo-nanobanana-v1_1.png"
              alt="印记 Logo"
              className="w-8 h-8 rounded-xl object-cover shadow-sm"
            />
            <span className="text-stone-700 font-semibold">印记</span>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold text-stone-800">欢迎回来</h1>
            <p className="text-stone-400 text-sm mt-1.5">很高兴再次见到你</p>
          </div>

          {/* 登录方式切换 */}
          <div className="flex rounded-2xl bg-[#efe9e4] p-1 mb-6">
            {(['password', 'code'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => { setMode(m); clearError() }}
                className={`flex-1 h-9 rounded-xl text-sm font-medium transition-all duration-200 ${
                  mode === m
                    ? 'bg-white text-[#dd6d59] shadow-sm'
                    : 'text-stone-400 hover:text-stone-600'
                }`}
              >
                {m === 'password' ? '密码登录' : '验证码登录'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 邮箱 */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-stone-500">邮箱地址</label>
              <input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
              />
            </div>

            {mode === 'password' ? (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-stone-500">密码</label>
                  <button
                    type="button"
                    onClick={() => navigate('/forgot-password')}
                    className="text-xs text-[#b56f61] hover:text-[#a45f52] hover:underline transition-colors"
                  >
                    忘记密码？
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="请输入密码"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`${inputClass} pr-12`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-300 hover:text-stone-500 transition-colors"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      {showPassword ? (
                        <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>
                      ) : (
                        <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" /><line x1="1" y1="1" x2="23" y2="23" /></>
                      )}
                    </svg>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-stone-500">验证码</label>
                <div className="flex gap-2.5">
                  <input
                    type="text"
                    placeholder="6 位验证码"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    maxLength={6}
                    className={`${inputClass} flex-1 text-center tracking-[0.4em] placeholder:tracking-normal`}
                  />
                  <button
                    type="button"
                    onClick={handleRequestCode}
                    disabled={!email || !email.includes('@') || countdown > 0}
                    className="shrink-0 h-12 px-4 rounded-2xl text-sm font-medium border border-[#dfccc2] text-[#b56f61] bg-[#f5efea] hover:bg-[#efe6e0] disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
                  >
                    {countdown > 0 ? `${countdown}s` : '发送'}
                  </button>
                </div>
              </div>
            )}

            {/* 错误提示 */}
            {error && (
              <div className="px-4 py-3 rounded-2xl bg-red-50 border border-red-100 text-red-500 text-sm animate-fade-in">
                {error}
              </div>
            )}

            {/* 登录按钮 */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 rounded-2xl text-sm font-semibold text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] shadow-md mt-2"
              style={{ background: 'linear-gradient(135deg, #e88f7b, #a09ab8)' }}
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin mx-auto" />
              ) : '登录'}
            </button>

            <div className="flex items-center gap-4">
              <div className="flex-1 h-px bg-[#e7dbd5]" />
              <span className="text-xs text-stone-300">或</span>
              <div className="flex-1 h-px bg-[#e7dbd5]" />
            </div>

            <button
              type="button"
              onClick={() => navigate('/register')}
              className="w-full h-12 rounded-2xl text-sm font-medium text-[#b56f61] bg-[#f6f1ec] border border-[#e7dbd5] hover:bg-[#efe8e2] transition-all duration-200 active:scale-[0.98]"
            >
              还没有账号？立即注册
            </button>
          </form>
        </div>
      </div>
      {/* 滑动验证码弹窗 */}
      {showCaptcha && (
        <SliderCaptcha
          onSuccess={handleCaptchaSuccess}
          onClose={() => setShowCaptcha(false)}
        />
      )}
    </div>
  )
}
