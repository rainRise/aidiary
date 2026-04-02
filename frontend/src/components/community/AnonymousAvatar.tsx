import { EyeOff } from 'lucide-react'
import { useState } from 'react'

export default function AnonymousAvatar({
  size = 'md',
}: {
  size?: 'sm' | 'md' | 'lg'
}) {
  const [imgFailed, setImgFailed] = useState(false)
  const sizeClass =
    size === 'sm' ? 'w-6 h-6' : size === 'lg' ? 'w-10 h-10' : 'w-8 h-8'
  const iconClass =
    size === 'sm' ? 'w-3 h-3' : size === 'lg' ? 'w-4 h-4' : 'w-3.5 h-3.5'

  return (
    <div
      className={`${sizeClass} rounded-full relative overflow-hidden flex items-center justify-center border border-white/70 shadow-sm`}
      style={{
        background:
          'radial-gradient(120% 120% at 22% 18%, #f2d2c9 0%, #d9c9e8 48%, #b7c9e7 100%)',
      }}
      aria-label="匿名头像"
    >
      {!imgFailed ? (
        <img
          src="/assets/avatars/anonymous-default.png"
          alt="匿名头像"
          className="w-full h-full object-cover"
          onError={() => setImgFailed(true)}
        />
      ) : (
        <>
          <div
            className="absolute inset-0 opacity-35"
            style={{
              background:
                'linear-gradient(135deg, rgba(255,255,255,0.55), rgba(255,255,255,0) 50%, rgba(109,99,140,0.15))',
            }}
          />
          <EyeOff className={`${iconClass} text-stone-600 relative z-10`} />
        </>
      )}
    </div>
  )
}
