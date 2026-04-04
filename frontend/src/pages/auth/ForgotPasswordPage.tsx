// 忘记密码页面
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authService } from '@/services/auth.service'
import { toast } from '@/components/ui/toast'
import { Check, ArrowLeft } from 'lucide-react'
import SliderCaptcha, { type CaptchaResult } from '@/components/common/SliderCaptcha'

type Step = 1 | 2 | 3

export default function ForgotPasswordPage() {
  const navigate = useNavigate()

  const [step, setStep] = useState<Step>(1)
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
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
      await authService.sendResetPasswordCode(email, captchaResult)
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

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!code) { toast('请输入验证码', 'error'); return }
    if (!password || password.length < 6) { toast('密码长度至少6位', 'error'); return }
    if (password !== confirmPassword) { toast('两次密码不一致', 'error'); return }

    setIsLoading(true)
    try {
      await authService.resetPassword(email, code, password)
      setStep(3)
      toast('密码重置成功', 'success')
    } catch (err: any) {
      toast(err.response?.data?.detail || '重置密码失败', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const inputClass = "w-full h-12 px-4 rounded-2xl bg-white/90 border border-stone-200 text-stone-700 text-sm placeholder:text-stone-300 outline-none transition-all duration-200 focus:border-[#d8b8a8] focus:ring-2 focus:ring-[#f4e6df] shadow-sm"

  const stepLabels = ['验证邮箱', '设置新密码', '完成']

  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background: 'linear-gradient(158deg, #f8f5ef 0%, #f2eef5 58%, #f5f2ee 100%)' }}>
      <div className="w-full max-w-[420px] animate-fade-in">
        {/* Logo */}
        <div className="flex items-center gap-2 mb-8">
          <img
            src="/branding/yinji-logo-nanobanana-v1_1.png"
            alt="印记 Logo"
            className="w-8 h-8 rounded-xl object-cover shadow-sm"
          />
          <span className="text-stone-700 font-semibold">印记</span>
        </div>

        {/* 返回登录 */}
        <button
          type="button"
          onClick={() => navigate('/login')}
          className="flex items-center gap-1.5 text-sm text-stone-400 hover:text-stone-600 transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          返回登录
        </button>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-stone-800">重置密码</h1>
          <p className="text-stone-400 text-sm mt-1.5">
            {step === 1 && '输入注册邮箱，我们将发送验证码'}
            {step === 2 && '输入验证码和新密码'}
            {step === 3 && '密码已重置成功'}
          </p>
        </div>

        {/* 步骤进度条 */}
        <div className="flex items-center gap-2 mb-7">
          {stepLabels.map((label, i) => {
            const stepNum = i + 1
            const isCompleted = step > stepNum
            const isActive = step === stepNum
            return (
              <div key={i} className="flex items-center gap-2 flex-1">
                <div className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                  isCompleted ? 'bg-emerald-400 text-white' :
                  isActive ? 'text-white' : 'bg-stone-100 text-stone-300'
                }`}
                  style={isActive ? { background: 'linear-gradient(135deg, #e88f7b, #a09ab8)' } : undefined}
                >
                  {isCompleted ? <Check className="w-3.5 h-3.5" /> : stepNum}
                </div>
                <span className={`text-xs font-medium hidden sm:inline ${isActive || isCompleted ? 'text-stone-600' : 'text-stone-300'}`}>
                  {label}
                </span>
                {i < stepLabels.length - 1 && (
                  <div className="flex-1 h-1 rounded-full overflow-hidden bg-stone-100 ml-1">
                    <div className="h-full rounded-full transition-all duration-500 ease-out"
                      style={{
                        width: isCompleted ? '100%' : '0%',
                        background: 'linear-gradient(90deg, #e88f7b, #a09ab8)'
                      }} />
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Step 1: 输入邮箱 */}
        {step === 1 && (
          <div className="space-y-4 animate-fade-in">
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
            <button
              type="button"
              onClick={handleRequestCode}
              disabled={!email || !email.includes('@') || countdown > 0}
              className="w-full h-12 rounded-2xl text-sm font-semibold text-white transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] shadow-md"
              style={{ background: 'linear-gradient(135deg, #e88f7b, #a09ab8)' }}
            >
              {countdown > 0 ? `${countdown}s 后重新发送` : '发送验证码'}
            </button>
          </div>
        )}

        {/* Step 2: 输入验证码和新密码 */}
        {step === 2 && (
          <form onSubmit={handleResetPassword} className="space-y-4 animate-fade-in">
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
                  disabled={countdown > 0}
                  className="shrink-0 h-12 px-4 rounded-2xl text-sm font-medium border border-[#dfccc2] text-[#b56f61] bg-[#f5efea] hover:bg-[#efe6e0] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  {countdown > 0 ? `${countdown}s` : '重发'}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-stone-500">新密码</label>
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
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-stone-500">确认新密码</label>
              <input
                type="password"
                placeholder="再次输入新密码"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={`${inputClass} ${confirmPassword && password !== confirmPassword ? 'border-red-200 focus:border-red-300' : ''}`}
              />
              {confirmPassword && password !== confirmPassword && (
                <p className="text-xs text-red-400">两次密码不一致</p>
              )}
            </div>

            <button
              type="submit"
              disabled={!code || !password || password !== confirmPassword || isLoading}
              className="w-full h-12 rounded-2xl text-sm font-semibold text-white transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] shadow-md"
              style={{ background: 'linear-gradient(135deg, #e88f7b, #a09ab8)' }}
            >
              {isLoading
                ? <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin mx-auto" />
                : '重置密码'}
            </button>
          </form>
        )}

        {/* Step 3: 成功 */}
        {step === 3 && (
          <div className="text-center space-y-6 animate-fade-in">
            <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto">
              <Check className="w-8 h-8 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-stone-700">密码重置成功</h2>
              <p className="text-sm text-stone-400 mt-1">请使用新密码登录</p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="w-full h-12 rounded-2xl text-sm font-semibold text-white transition-all duration-200 active:scale-[0.98] shadow-md"
              style={{ background: 'linear-gradient(135deg, #e88f7b, #a09ab8)' }}
            >
              前往登录
            </button>
          </div>
        )}
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
