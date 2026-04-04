// 注册页面 - 温暖柔和心理日记风格
import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { authService } from '@/services/auth.service'
import { toast } from '@/components/ui/toast'
import { Check } from 'lucide-react'
import SliderCaptcha, { type CaptchaResult } from '@/components/common/SliderCaptcha'

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
  const [agreedToTerms, setAgreedToTerms] = useState(false)
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
      await authService.sendRegisterCode(email, captchaResult)
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

  const handleResendCode = () => {
    if (countdown > 0) return
    setShowCaptcha(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    clearError()

    if (!email || !password || !code) {
      toast('请填写完整信息', 'error')
      return
    }
    if (!agreedToTerms) {
      toast('请先同意服务条款和隐私政策', 'error')
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

  const inputClass = "w-full h-12 px-4 rounded-2xl bg-white/90 border border-stone-200 text-stone-700 text-sm placeholder:text-stone-300 outline-none transition-all duration-200 focus:border-[#d8b8a8] focus:ring-2 focus:ring-[#f4e6df] shadow-sm"

  const strengthColor = (len: number, i: number) => {
    if (len < i * 3) return 'bg-stone-100'
    if (len >= 12) return 'bg-emerald-400'
    if (len >= 8) return 'bg-violet-400'
    return 'bg-amber-300'
  }

  return (
    <div className="min-h-screen flex" style={{ background: 'linear-gradient(158deg, #f8f5ef 0%, #f2eef5 58%, #f5f2ee 100%)' }}>
      {/* 左侧品牌区域 */}
      <div className="hidden lg:flex lg:w-[45%] relative overflow-hidden items-center justify-center p-16">
        <div className="absolute top-16 right-20 w-64 h-64 rounded-full opacity-20 animate-float"
          style={{ background: 'radial-gradient(circle, rgba(163,154,188,0.28), rgba(248,245,239,0.02))' }} />
        <div className="absolute bottom-20 left-10 w-52 h-52 rounded-full opacity-15 animate-float"
          style={{ animationDelay: '1.2s', background: 'radial-gradient(circle, rgba(232,143,123,0.2), rgba(248,245,239,0.02))' }} />
        <div className="absolute top-1/2 left-1/4 w-36 h-36 rounded-full opacity-10 animate-float"
          style={{ animationDelay: '0.6s', background: 'radial-gradient(circle, #fde68a, #fdba74)' }} />

        <div className="relative z-10 max-w-md">
          <div className="mb-10 flex items-center gap-3">
            <img
              src="/branding/yinji-logo-nanobanana-v1_1.png"
              alt="印记 Logo"
              className="w-10 h-10 rounded-2xl object-cover shadow-md"
            />
            <span className="text-stone-700 text-xl font-semibold">印记</span>
          </div>

          <h2 className="text-4xl font-bold leading-tight mb-5" style={{ color: '#3d2b2b' }}>
            开始记录，<br />
            <span className="text-gradient">遇见更好的自己</span>
          </h2>
          <p className="text-stone-500 text-sm leading-relaxed mb-12">
            创建你的印记账号，AI 将随着每一篇日记更了解你。
            从今天起，让文字成为通往内心的桥梁。
          </p>

          <div className="space-y-3">
            {[
              { num: '1', label: '验证邮箱', desc: '获取注册验证码', active: true },
              { num: '2', label: '设置密码', desc: '保护你的账号安全', active: step === 2 },
              { num: '3', label: '开始探索', desc: '书写第一篇日记', active: false },
            ].map((s) => (
              <div key={s.num} className={`flex items-center gap-4 p-3.5 rounded-2xl transition-all duration-300 ${s.active ? 'bg-white/70 border border-[#e9e3de]' : 'opacity-50'}`}>
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold text-white ${s.active ? '' : 'opacity-60'}`}
                  style={{ background: s.active ? 'linear-gradient(135deg, #e88f7b, #a09ab8)' : '#e5e7eb' }}>
                  {s.num}
                </div>
                <div>
                  <div className="text-sm font-semibold text-stone-700">{s.label}</div>
                  <div className="text-xs text-stone-400">{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 右侧注册表单 */}
      <div className="w-full lg:w-[55%] flex items-center justify-center px-6 sm:px-16">
        <div className="w-full max-w-[420px] animate-fade-in">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <img
              src="/branding/yinji-logo-nanobanana-v1_1.png"
              alt="印记 Logo"
              className="w-8 h-8 rounded-xl object-cover shadow-sm"
            />
            <span className="text-stone-700 font-semibold">印记</span>
          </div>

          <div className="mb-6">
            <h1 className="text-2xl font-bold text-stone-800">创建账号</h1>
            <p className="text-stone-400 text-sm mt-1.5">
              {step === 1 ? '输入邮箱，开始你的心灵之旅' : '完善信息，完成注册'}
            </p>
          </div>

          {/* 步骤进度条 */}
          <div className="flex items-center gap-3 mb-7">
            {/* 步骤1 */}
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                step >= 2 ? 'bg-emerald-400 text-white' : 'text-white'
              }`}
                style={step < 2 ? { background: 'linear-gradient(135deg, #e88f7b, #a09ab8)' } : undefined}
              >
                {step >= 2 ? <Check className="w-3.5 h-3.5" /> : '1'}
              </div>
              <span className={`text-xs font-medium hidden sm:inline ${step >= 1 ? 'text-stone-600' : 'text-stone-300'}`}>验证邮箱</span>
            </div>
            {/* 连接线 */}
            <div className="flex-1 h-1 rounded-full overflow-hidden bg-stone-100">
              <div className={`h-full rounded-full transition-all duration-500 ease-out`}
                style={{
                  width: step >= 2 ? '100%' : '0%',
                  background: 'linear-gradient(90deg, #e88f7b, #a09ab8)'
                }} />
            </div>
            {/* 步骤2 */}
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                step >= 2 ? 'text-white' : 'bg-stone-100 text-stone-300'
              }`}
                style={step >= 2 ? { background: 'linear-gradient(135deg, #a09ab8, #8b9bb1)' } : undefined}
              >
                2
              </div>
              <span className={`text-xs font-medium hidden sm:inline ${step >= 2 ? 'text-stone-600' : 'text-stone-300'}`}>完善信息</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 邮箱 */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-stone-500">邮箱地址</label>
              <div className="flex gap-2.5">
                <input
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={step === 2}
                  className={`${inputClass} flex-1 disabled:bg-stone-50 disabled:text-stone-400`}
                />
                {step === 1 && (
                  <button
                    type="button"
                    onClick={handleRequestCode}
                    disabled={!email || !email.includes('@') || countdown > 0}
                    className="shrink-0 h-12 px-4 rounded-2xl text-sm font-medium text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 shadow-sm"
                    style={{ background: 'linear-gradient(135deg, #e88f7b, #a09ab8)' }}
                  >
                    {countdown > 0 ? `${countdown}s` : '发送验证码'}
                  </button>
                )}
              </div>
              {step === 2 && (
                <button type="button" onClick={() => setStep(1)}
                  className="text-xs text-[#b56f61] hover:text-[#a45f52] transition-colors">
                  ← 更换邮箱
                </button>
              )}
            </div>

            {step === 2 && (
              <div className="space-y-4 animate-fade-in">
                {/* 验证码 */}
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
                      onClick={handleResendCode}
                      disabled={countdown > 0}
                      className="shrink-0 h-12 px-4 rounded-2xl text-sm font-medium border border-[#dfccc2] text-[#b56f61] bg-[#f5efea] hover:bg-[#efe6e0] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                      {countdown > 0 ? `${countdown}s` : '重发'}
                    </button>
                  </div>
                </div>

                {/* 用户名 */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-stone-500">
                    昵称 <span className="text-stone-300">（选填）</span>
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
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-stone-500">密码</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="至少 6 位密码"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={`${inputClass} pr-12`}
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-300 hover:text-stone-500 transition-colors">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        {showPassword
                          ? <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>
                          : <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" /><line x1="1" y1="1" x2="23" y2="23" /></>
                        }
                      </svg>
                    </button>
                  </div>
                  {password && (
                    <div className="flex gap-1 mt-1.5">
                      {[1, 2, 3, 4].map((i) => (
                        <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-300 ${strengthColor(password.length, i)}`} />
                      ))}
                    </div>
                  )}
                </div>

                {/* 确认密码 */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-stone-500">确认密码</label>
                  <input
                    type="password"
                    placeholder="再次输入密码"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={`${inputClass} ${confirmPassword && password !== confirmPassword ? 'border-red-200 focus:border-red-300' : ''}`}
                  />
                  {confirmPassword && password !== confirmPassword && (
                    <p className="text-xs text-red-400">两次密码不一致</p>
                  )}
                </div>
              </div>
            )}

            {error && (
              <div className="px-4 py-3 rounded-2xl bg-red-50 border border-red-100 text-red-500 text-sm animate-fade-in">
                {error}
              </div>
            )}

            {step === 2 && (
              <>
                {/* 同意条款 */}
                <label className="flex items-start gap-2.5 cursor-pointer group mt-1">
                  <div className="relative mt-0.5">
                    <input
                      type="checkbox"
                      checked={agreedToTerms}
                      onChange={(e) => setAgreedToTerms(e.target.checked)}
                      className="sr-only"
                    />
                    <div className={`w-4 h-4 rounded border-2 transition-all duration-200 flex items-center justify-center ${
                      agreedToTerms ? 'border-[#e88f7b] bg-[#e88f7b]' : 'border-stone-300 group-hover:border-stone-400'
                    }`}>
                      {agreedToTerms && <Check className="w-3 h-3 text-white" />}
                    </div>
                  </div>
                  <span className="text-xs text-stone-400 leading-relaxed">
                    我已阅读并同意
                    <Link to="/terms" className="text-[#b56f61] hover:underline mx-0.5">服务条款</Link>
                    和
                    <Link to="/privacy" className="text-[#b56f61] hover:underline mx-0.5">隐私政策</Link>
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={!code || !password || password !== confirmPassword || !agreedToTerms || isLoading}
                  className="w-full h-12 rounded-2xl text-sm font-semibold text-white transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] shadow-md mt-1"
                  style={{ background: 'linear-gradient(135deg, #e88f7b, #a09ab8)' }}
                >
                  {isLoading
                    ? <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin mx-auto" />
                    : '完成注册'}
                </button>
              </>
            )}

            <div className="flex items-center gap-4">
              <div className="flex-1 h-px bg-[#e7dbd5]" />
              <span className="text-xs text-stone-300">或</span>
              <div className="flex-1 h-px bg-[#e7dbd5]" />
            </div>

            <button
              type="button"
              onClick={() => navigate('/login')}
              className="w-full h-12 rounded-2xl text-sm font-medium text-[#b56f61] bg-[#f6f1ec] border border-[#e7dbd5] hover:bg-[#efe8e2] transition-all duration-200 active:scale-[0.98]"
            >
              已有账号？立即登录
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
