import { useEffect, useMemo, useRef, useState } from 'react'
import { X, Send, MessageCircle, PlusCircle, History, Trash2 } from 'lucide-react'
import { assistantService, type AssistantMessage, type AssistantSession } from '@/services/assistant.service'
import { useAuthStore } from '@/store/authStore'
import { toast } from '@/components/ui/toast'

type Pos = { x: number; y: number }

const STORAGE_POS = 'yinji_sprite_pos_v1'
const STORAGE_MUTED = 'yinji_sprite_muted_v1'

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v))
}

function defaultPos() {
  return { x: window.innerWidth - 110, y: window.innerHeight - 130 }
}

export default function YinjiSprite() {
  const { isAuthenticated } = useAuthStore()
  const [open, setOpen] = useState(false)
  const [muted, setMuted] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [position, setPosition] = useState<Pos>(() => defaultPos())
  const [profileLoaded, setProfileLoaded] = useState(false)
  const [needInit, setNeedInit] = useState(false)
  const [nicknameInput, setNicknameInput] = useState('')
  const [displayName, setDisplayName] = useState('你')

  const [sessions, setSessions] = useState<AssistantSession[]>([])
  const [sessionId, setSessionId] = useState<number | null>(null)
  const [messages, setMessages] = useState<AssistantMessage[]>([])
  const [input, setInput] = useState('')
  const [responding, setResponding] = useState(false)

  const dragRef = useRef({ offsetX: 0, offsetY: 0 })
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isAuthenticated) return
    const saved = localStorage.getItem(STORAGE_POS)
    const mutedSaved = localStorage.getItem(STORAGE_MUTED)
    if (saved) {
      try {
        const p = JSON.parse(saved)
        setPosition({
          x: clamp(p.x ?? defaultPos().x, 0, window.innerWidth - 72),
          y: clamp(p.y ?? defaultPos().y, 0, window.innerHeight - 72),
        })
      } catch {
        setPosition(defaultPos())
      }
    }
    if (mutedSaved === '1') setMuted(true)
  }, [isAuthenticated])

  useEffect(() => {
    if (!isAuthenticated) return
    let mounted = true
    Promise.all([assistantService.getProfile(), assistantService.listSessions()])
      .then(async ([profile, sessionList]) => {
        if (!mounted) return
        setProfileLoaded(true)
        setDisplayName(profile.nickname || '你')
        setNeedInit(!profile.initialized)
        setMuted(profile.is_muted || localStorage.getItem(STORAGE_MUTED) === '1')
        setSessions(sessionList || [])
        const sid = sessionList?.[0]?.id ?? null
        setSessionId(sid)
        if (sid) {
          const msgs = await assistantService.listMessages(sid)
          if (mounted) setMessages(msgs)
        }
      })
      .catch(() => {
        if (!mounted) return
        setProfileLoaded(true)
      })
    return () => {
      mounted = false
    }
  }, [isAuthenticated])

  useEffect(() => {
    const onResize = () => {
      setPosition((p) => ({
        x: clamp(p.x, 0, window.innerWidth - 72),
        y: clamp(p.y, 0, window.innerHeight - 72),
      }))
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const panelStyle = useMemo(() => {
    const width = 360
    const height = 510
    const left = position.x + 72 > window.innerWidth - width - 12 ? position.x - width - 12 : position.x + 70
    const top = position.y > window.innerHeight - height - 20 ? window.innerHeight - height - 20 : position.y - 20
    return { left: clamp(left, 10, window.innerWidth - width - 10), top: clamp(top, 10, window.innerHeight - height - 10) }
  }, [position.x, position.y])

  const beginDrag = (e: React.PointerEvent<HTMLButtonElement>) => {
    setShowMenu(false)
    setDragging(true)
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    dragRef.current = { offsetX: e.clientX - rect.left, offsetY: e.clientY - rect.top }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  const onDrag = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragging) return
    const x = clamp(e.clientX - dragRef.current.offsetX, 0, window.innerWidth - 72)
    const y = clamp(e.clientY - dragRef.current.offsetY, 0, window.innerHeight - 72)
    setPosition({ x, y })
  }

  const endDrag = () => {
    setDragging(false)
    localStorage.setItem(STORAGE_POS, JSON.stringify(position))
  }

  const toggleMuted = async (value: boolean) => {
    setMuted(value)
    localStorage.setItem(STORAGE_MUTED, value ? '1' : '0')
    setShowMenu(false)
    try {
      await assistantService.updateProfile({ is_muted: value })
    } catch {
      // ignore
    }
  }

  const saveNickname = async () => {
    const nick = nicknameInput.trim()
    if (!nick) return
    try {
      const updated = await assistantService.updateProfile({ nickname: nick })
      setDisplayName(updated.nickname || '你')
      setNeedInit(false)
      toast('精灵记住你的称呼啦', 'success')
    } catch {
      toast('保存称呼失败', 'error')
    }
  }

  const openSession = async (sid: number) => {
    setSessionId(sid)
    const msgs = await assistantService.listMessages(sid)
    setMessages(msgs)
  }

  const createSession = async () => {
    try {
      const session = await assistantService.createSession()
      setSessions((prev) => [session, ...prev])
      setSessionId(session.id)
      setMessages([])
    } catch {
      toast('新建会话失败', 'error')
    }
  }

  const clearCurrentSession = async () => {
    if (!sessionId) return
    try {
      await assistantService.clearSession(sessionId)
      setMessages([])
      toast('已清空当前对话', 'success')
    } catch {
      toast('清空失败', 'error')
    }
  }

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || responding) return
    setInput('')
    const userMsg: AssistantMessage = {
      id: Date.now(),
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, userMsg])

    const tempAiId = Date.now() + 1
    setMessages((prev) => [
      ...prev,
      { id: tempAiId, role: 'assistant', content: '', created_at: new Date().toISOString() },
    ])
    setResponding(true)

    try {
      let resolvedSessionId: number | null = sessionId
      await assistantService.streamChat(
        { message: text, session_id: resolvedSessionId },
        {
          onMeta: async (meta) => {
            resolvedSessionId = meta.session_id
            if (!sessionId) {
              setSessionId(meta.session_id)
              const list = await assistantService.listSessions()
              setSessions(list)
            }
          },
          onChunk: (piece) => {
            setMessages((prev) =>
              prev.map((m) => (m.id === tempAiId ? { ...m, content: (m.content || '') + piece } : m))
            )
          },
          onDone: async () => {
            setResponding(false)
            if (resolvedSessionId) {
              const latest = await assistantService.listMessages(resolvedSessionId)
              setMessages(latest)
            }
          },
          onError: (msg) => {
            setResponding(false)
            toast(msg || '回复失败', 'error')
          },
        }
      )
    } catch (e: any) {
      setResponding(false)
      toast(e?.message || '发送失败', 'error')
    }
  }

  if (!isAuthenticated || !profileLoaded) return null

  return (
    <>
      <button
        onPointerDown={beginDrag}
        onPointerMove={onDrag}
        onPointerUp={endDrag}
        onContextMenu={(e) => {
          e.preventDefault()
          setShowMenu((v) => !v)
        }}
        onClick={() => !dragging && !muted && setOpen((v) => !v)}
        className={`fixed z-[9999] select-none ${muted ? 'w-12 h-12' : 'w-[72px] h-[72px]'} rounded-full shadow-lg border border-white/70 bg-white/80 backdrop-blur-md overflow-hidden transition-all duration-200 ${dragging ? 'scale-95' : 'hover:scale-[1.03]'}`}
        style={{ left: position.x, top: position.y }}
      >
        {muted ? (
          <span className="text-stone-600 text-xs font-semibold">AI</span>
        ) : responding ? (
          <video
            src="/Video 1.webm"
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-cover"
            onError={(e) => {
              const v = e.currentTarget
              if (v.src.endsWith('.webm')) v.src = '/Video 1.mp4'
            }}
          />
        ) : (
          <img src="/Image 1.png" alt="映记精灵" className="w-full h-full object-contain bg-transparent" />
        )}
      </button>

      {showMenu && (
        <div
          className="fixed z-[10000] w-36 rounded-xl border border-stone-200 bg-white shadow-lg p-1.5"
          style={{ left: position.x - 70, top: position.y - 56 }}
        >
          {!muted ? (
            <button onClick={() => toggleMuted(true)} className="w-full text-left px-2.5 py-2 rounded-lg text-sm text-stone-600 hover:bg-stone-50">
              屏蔽助手
            </button>
          ) : (
            <button onClick={() => toggleMuted(false)} className="w-full text-left px-2.5 py-2 rounded-lg text-sm text-stone-600 hover:bg-stone-50">
              唤醒助手
            </button>
          )}
        </div>
      )}

      {open && !muted && (
        <div
          ref={panelRef}
          className="fixed z-[9998] w-[360px] h-[510px] rounded-3xl border border-[#e9ddd5] bg-[linear-gradient(160deg,#fffdfa_0%,#fbf6f2_40%,#f7f2f8_100%)] shadow-[0_22px_50px_rgba(136,116,121,0.28)] overflow-hidden"
          style={panelStyle}
        >
          <div className="h-12 px-4 border-b border-[#ede2dc] flex items-center justify-between bg-white/65">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-[#b36d61]" />
              <p className="text-sm font-semibold text-stone-700">映记精灵</p>
            </div>
            <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-400">
              <X className="w-4 h-4" />
            </button>
          </div>

          {needInit && (
            <div className="absolute inset-0 z-10 bg-white/95 backdrop-blur-sm p-5 flex flex-col justify-center">
              <h3 className="text-lg font-semibold text-stone-700 mb-1">你好，先认识一下你</h3>
              <p className="text-sm text-stone-500 mb-4">你希望我怎么称呼你呢？</p>
              <input
                value={nicknameInput}
                onChange={(e) => setNicknameInput(e.target.value)}
                maxLength={50}
                placeholder="输入你的称呼..."
                className="h-11 px-3 rounded-xl border border-stone-200 bg-white text-sm text-stone-700 outline-none focus:ring-2 focus:ring-[#d4b8ae]/60"
              />
              <button
                onClick={saveNickname}
                className="mt-3 h-10 rounded-xl text-sm font-semibold text-white"
                style={{ background: 'linear-gradient(135deg,#df8f7b,#a19bb8)' }}
              >
                确认
              </button>
            </div>
          )}

          <div className="h-[70px] border-b border-[#efe4de] px-3 py-2 bg-white/45">
            <div className="flex items-center gap-1.5 mb-1.5">
              <button onClick={createSession} className="px-2 py-1 rounded-lg text-xs text-stone-600 hover:bg-white border border-stone-200 flex items-center gap-1">
                <PlusCircle className="w-3.5 h-3.5" /> 新对话
              </button>
              <button onClick={clearCurrentSession} className="px-2 py-1 rounded-lg text-xs text-stone-600 hover:bg-white border border-stone-200 flex items-center gap-1">
                <Trash2 className="w-3.5 h-3.5" /> 清空
              </button>
              <span className="ml-auto text-[11px] text-stone-400 flex items-center gap-1">
                <History className="w-3 h-3" /> {displayName}
              </span>
            </div>
            <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
              {sessions.slice(0, 8).map((s) => (
                <button
                  key={s.id}
                  onClick={() => openSession(s.id)}
                  className={`shrink-0 px-2 py-1 rounded-lg text-[11px] border ${s.id === sessionId ? 'text-white border-transparent' : 'text-stone-600 border-stone-200 bg-white/70'}`}
                  style={s.id === sessionId ? { background: 'linear-gradient(135deg,#de8f7b,#a29cb9)' } : undefined}
                >
                  {s.title || '新对话'}
                </button>
              ))}
            </div>
          </div>

          <div className="h-[342px] overflow-y-auto px-3 py-3 space-y-2.5">
            {messages.length === 0 ? (
              <div className="text-center text-stone-400 text-sm pt-12">和我聊聊今天的感受吧</div>
            ) : (
              messages.map((m) => (
                <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[82%] rounded-2xl px-3 py-2 text-sm leading-6 whitespace-pre-wrap ${
                      m.role === 'user'
                        ? 'text-white'
                        : 'text-stone-700 border border-[#eee2da] bg-white/85'
                    }`}
                    style={m.role === 'user' ? { background: 'linear-gradient(135deg,#df8f7b,#a19ab8)' } : undefined}
                  >
                    {m.content || (responding && m.role === 'assistant' ? '...' : '')}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="h-[86px] border-t border-[#efe4de] px-3 py-2 bg-white/60">
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    sendMessage()
                  }
                }}
                placeholder="和映记精灵说点什么..."
                className="flex-1 h-[62px] resize-none rounded-xl border border-stone-200 bg-white/85 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#d6bdb4]/55"
              />
              <button
                onClick={sendMessage}
                disabled={responding || !input.trim()}
                className="h-10 w-10 rounded-xl text-white disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg,#df8f7b,#a19ab8)' }}
              >
                <Send className="w-4 h-4 mx-auto" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
