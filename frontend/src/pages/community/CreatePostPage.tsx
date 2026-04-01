// 发帖页面
import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { communityService } from '@/services/community.service'
import { toast } from '@/components/ui/toast'
import { ArrowLeft, ImagePlus, X, EyeOff } from 'lucide-react'

const CIRCLES = [
  { id: 'anxiety', name: '焦虑', label: '我们都在焦虑的事', icon: '😰', color: '#e88f7b' },
  { id: 'sadness', name: '失落', label: '那些低落的时刻', icon: '😔', color: '#a09ab8' },
  { id: 'growth', name: '成长', label: '突破自我的瞬间', icon: '🌱', color: '#6abf8a' },
  { id: 'peace', name: '平静', label: '享受当下的时光', icon: '☀️', color: '#7bc5d3' },
  { id: 'confusion', name: '困惑', label: '想不明白的时候', icon: '🤔', color: '#d4a75b' },
]

export default function CreatePostPage() {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [circleId, setCircleId] = useState('')
  const [content, setContent] = useState('')
  const [images, setImages] = useState<string[]>([])
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    if (images.length + files.length > 9) {
      toast('最多上传9张图片', 'error')
      return
    }

    setIsUploading(true)
    try {
      for (const file of Array.from(files)) {
        const url = await communityService.uploadImage(file)
        setImages((prev) => [...prev, url])
      }
    } catch {
      toast('图片上传失败', 'error')
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async () => {
    if (!circleId) {
      toast('请选择一个圈子', 'error')
      return
    }
    if (!content.trim()) {
      toast('请输入内容', 'error')
      return
    }

    setIsSubmitting(true)
    try {
      await communityService.createPost({
        circle_id: circleId,
        content: content.trim(),
        images,
        is_anonymous: isAnonymous,
      })
      toast('发布成功', 'success')
      navigate('/community', { replace: true })
    } catch (err: any) {
      toast(err?.response?.data?.detail || '发布失败', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(158deg, #f8f5ef 0%, #f2eef5 58%, #f5f2ee 100%)' }}>
      {/* 顶栏 */}
      <header className="sticky top-0 z-50 backdrop-blur-xl border-b border-stone-200/70" style={{ background: 'rgba(248,245,239,0.85)' }}>
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <div className="flex justify-between items-center h-14">
            <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-stone-400 hover:text-stone-600 transition-colors">
              <ArrowLeft className="w-4 h-4" />
              取消
            </button>
            <h1 className="text-sm font-semibold text-stone-700">发布动态</h1>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !content.trim() || !circleId}
              className="h-8 px-5 rounded-xl text-sm font-semibold text-white shadow-sm disabled:opacity-40 transition-all active:scale-[0.97]"
              style={{ background: 'linear-gradient(135deg, #e88f7b, #a09ab8)' }}
            >
              {isSubmitting ? '发布中...' : '发布'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* 选择圈子 */}
        <div>
          <p className="text-xs text-stone-400 mb-2.5">选择圈子</p>
          <div className="flex flex-wrap gap-2">
            {CIRCLES.map((c) => (
              <button
                key={c.id}
                onClick={() => setCircleId(c.id)}
                className={`px-3.5 py-2 rounded-2xl text-sm border transition-all flex items-center gap-1.5 ${
                  circleId === c.id
                    ? 'bg-white text-stone-700 border-stone-300 shadow-sm'
                    : 'bg-white/50 text-stone-400 border-transparent hover:bg-white/80'
                }`}
              >
                <span>{c.icon}</span>
                {c.name}
              </button>
            ))}
          </div>
          {circleId && (
            <p className="text-xs text-stone-400 mt-2 ml-1">
              {CIRCLES.find((c) => c.id === circleId)?.label}
            </p>
          )}
        </div>

        {/* 内容输入 */}
        <div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="分享你此刻的感受..."
            rows={8}
            maxLength={5000}
            className="w-full px-4 py-3.5 rounded-2xl bg-white/70 border border-white/80 text-sm text-stone-700 placeholder-stone-300 resize-none focus:outline-none focus:ring-2 focus:ring-[#e88f7b]/20 focus:border-[#e88f7b]/30 transition-all leading-relaxed"
          />
          <p className="text-right text-[10px] text-stone-300 mt-1">{content.length} / 5000</p>
        </div>

        {/* 图片 */}
        <div>
          <div className="flex flex-wrap gap-2">
            {images.map((img, i) => (
              <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden group">
                <img src={img} alt="" className="w-full h-full object-cover" />
                <button
                  onClick={() => removeImage(i)}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
              </div>
            ))}
            {images.length < 9 && (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="w-20 h-20 rounded-xl border-2 border-dashed border-stone-200 flex flex-col items-center justify-center text-stone-300 hover:text-stone-400 hover:border-stone-300 transition-all"
              >
                <ImagePlus className="w-5 h-5" />
                <span className="text-[10px] mt-0.5">{isUploading ? '上传中' : '添加'}</span>
              </button>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            multiple
            className="hidden"
            onChange={handleImageUpload}
          />
        </div>

        {/* 匿名开关 */}
        <div className="flex items-center justify-between p-4 rounded-2xl bg-white/60 border border-white/80">
          <div className="flex items-center gap-2.5">
            <EyeOff className="w-4 h-4 text-stone-400" />
            <div>
              <p className="text-sm text-stone-600">匿名发布</p>
              <p className="text-[10px] text-stone-300">其他人不会看到你的身份</p>
            </div>
          </div>
          <button
            onClick={() => setIsAnonymous(!isAnonymous)}
            className={`w-11 h-6 rounded-full transition-all duration-200 relative ${
              isAnonymous ? 'bg-[#e88f7b]' : 'bg-stone-200'
            }`}
          >
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all duration-200 ${
              isAnonymous ? 'left-[22px]' : 'left-0.5'
            }`} />
          </button>
        </div>

        {isAnonymous && (
          <div className="px-4 py-3 rounded-2xl bg-amber-50/60 border border-amber-100/80">
            <p className="text-xs text-amber-600/80">
              匿名帖子发布后不可编辑，请确认内容后再发布。
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
