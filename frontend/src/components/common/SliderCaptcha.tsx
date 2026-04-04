import { useState, useRef, useCallback, useEffect } from 'react'
import { ShieldCheck, RefreshCw, X } from 'lucide-react'

interface CaptchaData {
  target_x: number
  target_y: number
  token: string
  piece_size: number
  bg_width: number
  bg_height: number
}

export interface CaptchaResult {
  token: string
  slide_x: number
  duration: number
}

interface SliderCaptchaProps {
  onSuccess: (result: CaptchaResult) => void
  onClose?: () => void
}

const BG_IMAGES = [
  'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
  'linear-gradient(135deg, #d4fc79 0%, #96e6a1 100%)',
  'linear-gradient(135deg, #fbc2eb 0%, #a6c1ee 100%)',
  'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
  'linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)',
  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
]

function drawPuzzlePath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  tab: number
) {
  const r = tab
  ctx.beginPath()
  ctx.moveTo(x, y)
  // top
  ctx.lineTo(x + size * 0.4, y)
  ctx.arc(x + size * 0.5, y - r * 0.4, r, Math.PI * 0.7, Math.PI * 0.3, false)
  ctx.lineTo(x + size, y)
  // right
  ctx.lineTo(x + size, y + size * 0.4)
  ctx.arc(x + size + r * 0.4, y + size * 0.5, r, Math.PI * 1.2, Math.PI * 0.8, false)
  ctx.lineTo(x + size, y + size)
  // bottom
  ctx.lineTo(x, y + size)
  // left
  ctx.lineTo(x, y)
  ctx.closePath()
}

export default function SliderCaptcha({ onSuccess, onClose }: SliderCaptchaProps) {
  const [captcha, setCaptcha] = useState<CaptchaData | null>(null)
  const [loading, setLoading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [sliderX, setSliderX] = useState(0)
  const [status, setStatus] = useState<'idle' | 'success' | 'fail'>('idle')

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pieceRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const startXRef = useRef(0)
  const startTimeRef = useRef(0)

  const fetchCaptcha = useCallback(async () => {
    setLoading(true)
    setSliderX(0)
    setStatus('idle')
    try {
      const resp = await fetch('/api/v1/auth/captcha')
      const data: CaptchaData = await resp.json()
      setCaptcha(data)
    } catch {
      // retry silently
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCaptcha()
  }, [fetchCaptcha])

  // Draw puzzle when captcha data arrives
  useEffect(() => {
    if (!captcha || !canvasRef.current || !pieceRef.current) return

    const { target_x, target_y, piece_size, bg_width, bg_height } = captcha
    const scale = window.devicePixelRatio || 1

    // Main canvas
    const canvas = canvasRef.current
    canvas.width = bg_width * scale
    canvas.height = bg_height * scale
    canvas.style.width = `${bg_width}px`
    canvas.style.height = `${bg_height}px`
    const ctx = canvas.getContext('2d')!
    ctx.scale(scale, scale)

    // Draw gradient background with noise pattern
    const bgIdx = Math.floor(Math.random() * BG_IMAGES.length)
    const grd = ctx.createLinearGradient(0, 0, bg_width, bg_height)
    // Parse gradient colors roughly
    const colors = [
      ['#a8edea', '#fed6e3'],
      ['#d4fc79', '#96e6a1'],
      ['#fbc2eb', '#a6c1ee'],
      ['#ffecd2', '#fcb69f'],
      ['#a1c4fd', '#c2e9fb'],
      ['#667eea', '#764ba2'],
    ]
    const [c1, c2] = colors[bgIdx]
    grd.addColorStop(0, c1)
    grd.addColorStop(1, c2)
    ctx.fillStyle = grd
    ctx.fillRect(0, 0, bg_width, bg_height)

    // Draw some random decorative circles
    for (let i = 0; i < 6; i++) {
      ctx.beginPath()
      ctx.arc(
        Math.random() * bg_width,
        Math.random() * bg_height,
        10 + Math.random() * 30,
        0,
        Math.PI * 2
      )
      ctx.fillStyle = `rgba(255,255,255,${0.1 + Math.random() * 0.15})`
      ctx.fill()
    }

    // Draw puzzle hole (darker)
    const tab = piece_size * 0.25
    drawPuzzlePath(ctx, target_x, target_y, piece_size, tab)
    ctx.fillStyle = 'rgba(0,0,0,0.35)'
    ctx.fill()

    // Piece canvas
    const pieceCanvas = pieceRef.current
    const pw = piece_size + tab * 2
    const ph = piece_size + tab * 2
    pieceCanvas.width = pw * scale
    pieceCanvas.height = ph * scale
    pieceCanvas.style.width = `${pw}px`
    pieceCanvas.style.height = `${ph}px`
    const pctx = pieceCanvas.getContext('2d')!
    pctx.scale(scale, scale)

    // Clip piece shape from main canvas image
    pctx.save()
    drawPuzzlePath(pctx, tab * 0.5, tab * 0.8, piece_size, tab)
    pctx.clip()
    // Re-draw the same background region into piece
    pctx.fillStyle = grd
    pctx.fillRect(0, 0, pw, ph)
    // Draw the matching circles
    for (let i = 0; i < 6; i++) {
      pctx.beginPath()
      pctx.arc(
        Math.random() * bg_width - target_x + tab * 0.5,
        Math.random() * bg_height - target_y + tab * 0.8,
        10 + Math.random() * 30,
        0,
        Math.PI * 2
      )
      pctx.fillStyle = `rgba(255,255,255,${0.1 + Math.random() * 0.15})`
      pctx.fill()
    }
    pctx.restore()

    // Piece border
    drawPuzzlePath(pctx, tab * 0.5, tab * 0.8, piece_size, tab)
    pctx.strokeStyle = 'rgba(255,255,255,0.8)'
    pctx.lineWidth = 1.5
    pctx.stroke()

    // Shadow
    pctx.shadowColor = 'rgba(0,0,0,0.3)'
    pctx.shadowBlur = 6
    pctx.shadowOffsetX = 2
    pctx.shadowOffsetY = 2
  }, [captcha])

  const getClientX = (e: React.MouseEvent | React.TouchEvent) => {
    if ('touches' in e) return e.touches[0].clientX
    return e.clientX
  }

  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (status !== 'idle' || !captcha) return
    e.preventDefault()
    setIsDragging(true)
    startXRef.current = getClientX(e) - sliderX
    startTimeRef.current = Date.now()
  }

  const handleMove = useCallback(
    (e: MouseEvent | TouchEvent) => {
      if (!isDragging || !captcha) return
      e.preventDefault()
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
      const newX = Math.max(0, Math.min(clientX - startXRef.current, captcha.bg_width - captcha.piece_size))
      setSliderX(newX)
    },
    [isDragging, captcha]
  )

  const handleEnd = useCallback(async () => {
    if (!isDragging || !captcha) return
    setIsDragging(false)

    const duration = Date.now() - startTimeRef.current
    const result: CaptchaResult = {
      token: captcha.token,
      slide_x: Math.round(sliderX),
      duration,
    }

    // Check locally first (approximate)
    const tolerance = 6
    if (Math.abs(sliderX - captcha.target_x) <= tolerance && duration >= 300) {
      setStatus('success')
      setTimeout(() => onSuccess(result), 400)
    } else {
      setStatus('fail')
      setTimeout(() => {
        fetchCaptcha()
      }, 800)
    }
  }, [isDragging, captcha, sliderX, onSuccess, fetchCaptcha])

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMove, { passive: false })
      window.addEventListener('touchmove', handleMove, { passive: false })
      window.addEventListener('mouseup', handleEnd)
      window.addEventListener('touchend', handleEnd)
    }
    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('touchmove', handleMove)
      window.removeEventListener('mouseup', handleEnd)
      window.removeEventListener('touchend', handleEnd)
    }
  }, [isDragging, handleMove, handleEnd])

  if (!captcha && !loading) return null

  const pieceTop = captcha ? captcha.target_y - captcha.piece_size * 0.25 * 0.8 : 0

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/30 backdrop-blur-sm animate-fade-in">
      <div
        ref={containerRef}
        className="bg-white rounded-2xl shadow-2xl overflow-hidden w-[340px] animate-fade-in"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100">
          <div className="flex items-center gap-2 text-sm text-stone-600 font-medium">
            <ShieldCheck className="w-4 h-4 text-violet-500" />
            安全验证
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={fetchCaptcha}
              className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-400 transition-colors"
              title="刷新"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-400 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Canvas area */}
        <div className="relative px-5 pt-4" style={{ userSelect: 'none' }}>
          {loading ? (
            <div className="w-[300px] h-[180px] rounded-xl bg-stone-100 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-stone-300 border-t-stone-500 rounded-full animate-spin" />
            </div>
          ) : (
            <div className="relative rounded-xl overflow-hidden">
              <canvas
                ref={canvasRef}
                className="block rounded-xl"
              />
              {/* Sliding puzzle piece */}
              <canvas
                ref={pieceRef}
                className="absolute pointer-events-none transition-none"
                style={{
                  left: `${sliderX}px`,
                  top: `${pieceTop}px`,
                  filter: isDragging ? 'drop-shadow(0 2px 8px rgba(0,0,0,0.3))' : 'drop-shadow(0 1px 4px rgba(0,0,0,0.2))',
                }}
              />
              {/* Status overlay */}
              {status !== 'idle' && (
                <div className={`absolute inset-0 flex items-center justify-center rounded-xl transition-all duration-300 ${
                  status === 'success' ? 'bg-emerald-500/20' : 'bg-red-500/20'
                }`}>
                  <span className={`text-sm font-bold px-4 py-1.5 rounded-full ${
                    status === 'success' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
                  }`}>
                    {status === 'success' ? '验证通过' : '验证失败，请重试'}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Slider track */}
        <div className="px-5 py-4">
          <div className="relative h-10 rounded-full bg-stone-100 border border-stone-200 overflow-hidden select-none">
            {/* Filled track */}
            <div
              className={`absolute left-0 top-0 bottom-0 rounded-full transition-colors ${
                status === 'success'
                  ? 'bg-emerald-100'
                  : status === 'fail'
                  ? 'bg-red-100'
                  : 'bg-violet-50'
              }`}
              style={{ width: `${sliderX + 44}px` }}
            />
            {/* Hint text */}
            {sliderX === 0 && status === 'idle' && (
              <div className="absolute inset-0 flex items-center justify-center text-xs text-stone-300 pointer-events-none">
                向右拖动滑块完成拼图
              </div>
            )}
            {/* Slider thumb */}
            <div
              className={`absolute top-0.5 w-9 h-9 rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing transition-colors shadow-sm ${
                status === 'success'
                  ? 'bg-emerald-500'
                  : status === 'fail'
                  ? 'bg-red-400'
                  : isDragging
                  ? 'bg-violet-500'
                  : 'bg-white border border-stone-200 hover:border-violet-300'
              }`}
              style={{ left: `${sliderX + 2}px` }}
              onMouseDown={handleStart}
              onTouchStart={handleStart}
            >
              {status === 'success' ? (
                <ShieldCheck className="w-4 h-4 text-white" />
              ) : status === 'fail' ? (
                <X className="w-4 h-4 text-white" />
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={isDragging ? 'white' : '#a1a1aa'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
