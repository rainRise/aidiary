import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, Send, MessageCircle, PlusCircle, History, Trash2 } from 'lucide-react'
import { assistantService, type AssistantMessage, type AssistantSession } from '@/services/assistant.service'
import { useAuthStore } from '@/store/authStore'
import { toast } from '@/components/ui/toast'

// 解析 [[diary:ID|显示文字]] 为可点击链接
function renderMessageContent(text: string, onDiaryClick: (id: number) => void) {
  if (!text) return null
  const parts: (string | JSX.Element)[] = []
  const regex = /\[\[diary:(\d+)\|([^\]]+)\]\]/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }
    const diaryId = parseInt(match[1], 10)
    const label = match[2]
    parts.push(
      <button
        key={`diary-${diaryId}-${match.index}`}
        onClick={(e) => { e.stopPropagation(); onDiaryClick(diaryId) }}
        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-lg text-[#b56f61] bg-[#faf0ec] hover:bg-[#f3e4de] border border-[#e8d5cc] transition-colors text-xs font-medium"
      >
        📖 {label}
      </button>
    )
    lastIndex = regex.lastIndex
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }
  return parts.length === 1 && typeof parts[0] === 'string' ? parts[0] : <>{parts}</>
}

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
  const navigate = useNavigate()
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
  const [panelDragging, setPanelDragging] = useState(false)
  const [panelPosition, setPanelPosition] = useState<Pos | null>(null)

  const dragRef = useRef({ offsetX: 0, offsetY: 0, started: false, pressing: false, liveX: 0, liveY: 0, rafId: 0 })
  const spriteRef = useRef<HTMLButtonElement>(null)
  const panelDragRef = useRef({ offsetX: 0, offsetY: 0 })
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
      setPanelPosition((p) => {
        if (!p) return p
        const width = 360
        const height = 510
        return {
          x: clamp(p.x, 10, window.innerWidth - width - 10),
          y: clamp(p.y, 10, window.innerHeight - height - 10),
        }
      })
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const panelStyle = useMemo(() => {
    const width = 360
    const height = 510
    if (panelPosition) {
      return {
        left: clamp(panelPosition.x, 10, window.innerWidth - width - 10),
        top: clamp(panelPosition.y, 10, window.innerHeight - height - 10),
      }
    }
    const left = position.x + 88 > window.innerWidth - width - 12 ? position.x - width - 12 : position.x + 82
    const top = position.y > window.innerHeight - height - 20 ? window.innerHeight - height - 20 : position.y - 18
    return { left: clamp(left, 10, window.innerWidth - width - 10), top: clamp(top, 10, window.innerHeight - height - 10) }
  }, [position.x, position.y, panelPosition])

  const DRAG_THRESHOLD = 3

  const beginDrag = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return
    setShowMenu(false)
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    dragRef.current = {
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
      started: false,
      pressing: true,
      liveX: position.x,
      liveY: position.y,
      rafId: 0,
    }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  const onDrag = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragRef.current.pressing) return

    const newX = clamp(e.clientX - dragRef.current.offsetX, 0, window.innerWidth - 72)
    const newY = clamp(e.clientY - dragRef.current.offsetY, 0, window.innerHeight - 72)

    if (!dragRef.current.started) {
      const dx = newX - dragRef.current.liveX
      const dy = newY - dragRef.current.liveY
      if (Math.abs(dx) + Math.abs(dy) < DRAG_THRESHOLD) return
      dragRef.current.started = true
      setDragging(true)
    }

    // Bypass React — write directly to DOM for zero-lag dragging
    dragRef.current.liveX = newX
    dragRef.current.liveY = newY
    if (dragRef.current.rafId) cancelAnimationFrame(dragRef.current.rafId)
    dragRef.current.rafId = requestAnimationFrame(() => {
      const el = spriteRef.current
      if (el) {
        el.style.left = `${newX}px`
        el.style.top = `${newY}px`
      }
    })
  }

  const endDrag = () => {
    const d = dragRef.current
    const wasDragging = d.started
    d.started = false
    d.pressing = false
    if (d.rafId) { cancelAnimationFrame(d.rafId); d.rafId = 0 }
    setDragging(false)

    if (wasDragging) {
      // Sync final position to React state + persist
      const finalPos = { x: d.liveX, y: d.liveY }
      setPosition(finalPos)
      localStorage.setItem(STORAGE_POS, JSON.stringify(finalPos))
    }
  }

  const beginPanelDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    if ((e.target as HTMLElement).closest('button')) return
    setPanelDragging(true)
    const rect = panelRef.current?.getBoundingClientRect()
    if (!rect) return
    panelDragRef.current = { offsetX: e.clientX - rect.left, offsetY: e.clientY - rect.top }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  const onPanelDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!panelDragging) return
    const width = 360
    const height = 510
    const x = clamp(e.clientX - panelDragRef.current.offsetX, 10, window.innerWidth - width - 10)
    const y = clamp(e.clientY - panelDragRef.current.offsetY, 10, window.innerHeight - height - 10)
    setPanelPosition({ x, y })
  }

  const endPanelDrag = () => {
    setPanelDragging(false)
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

  const deleteSession = async (sid: number) => {
    try {
      await assistantService.archiveSession(sid)
      const remaining = sessions.filter((s) => s.id !== sid)
      setSessions(remaining)
      if (sid === sessionId) {
        const next = remaining[0]?.id ?? null
        setSessionId(next)
        if (next) {
          const msgs = await assistantService.listMessages(next)
          setMessages(msgs)
        } else {
          setMessages([])
        }
      }
      toast('已删除该对话', 'success')
    } catch {
      toast('删除对话失败', 'error')
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
        ref={spriteRef}
        onPointerDown={beginDrag}
        onPointerMove={onDrag}
        onPointerUp={endDrag}
        onContextMenu={(e) => {
          e.preventDefault()
          setShowMenu((v) => !v)
        }}
        onClick={(e) => {
          if (dragRef.current.started) {
            e.preventDefault()
            e.stopPropagation()
            return
          }
          if (muted) {
            toggleMuted(false)
            return
          }
          setOpen((v) => !v)
        }}
        className={`fixed z-[9999] select-none overflow-hidden ${dragging ? 'scale-95 !transition-none' : 'transition-all duration-200 hover:scale-[1.03]'} ${
          muted
            ? 'w-12 h-12 rounded-full shadow-lg border border-white/70 bg-white/90 backdrop-blur-md'
            : 'w-[88px] h-[88px] bg-transparent border-none shadow-none rounded-none'
        }`}
        style={{ left: position.x, top: position.y, touchAction: 'none' }}
      >
        {muted ? (
          <span className="text-stone-600 text-xs font-semibold">AI</span>
        ) : (
          <>
            {/* 始终渲染静态图和视频，通过 opacity 切换避免闪烁 */}
            <img
              src="/Image 1.png"
              alt="映记精灵"
              draggable={false}
              onDragStart={(e) => e.preventDefault()}
              className={`absolute inset-0 w-full h-full object-contain bg-transparent pointer-events-none drop-shadow-[0_8px_18px_rgba(95,84,128,0.28)] transition-opacity duration-200 ${
                responding ? 'opacity-0' : 'opacity-100'
              }`}
            />
            <video
              src="/Video 1.webm"
              autoPlay
              loop
              muted
              playsInline
              preload="auto"
              draggable={false}
              onDragStart={(e) => e.preventDefault()}
              className={`absolute inset-0 w-full h-full object-contain pointer-events-none drop-shadow-[0_8px_18px_rgba(95,84,128,0.32)] transition-opacity duration-200 ${
                responding ? 'opacity-100' : 'opacity-0'
              }`}
              onError={(e) => {
                const v = e.currentTarget
                if (v.src.endsWith('.webm')) v.src = '/Video 1.mp4'
              }}
            />
          </>
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
          className="fixed z-[9998] w-[360px] h-[510px] rounded-3xl border border-[#e9ddd5] bg-[linear-gradient(160deg,#fffdfa_0%,#fbf6f2_40%,#f7f2f8_100%)] shadow-[0_22px_50px_rgba(136,116,121,0.28)] overflow-hidden flex flex-col"
          style={{ left: panelStyle.left, top: panelStyle.top }}
        >
          <div
            className={`shrink-0 h-12 px-4 border-b border-[#ede2dc] flex items-center justify-between bg-white/65 ${panelDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
            onPointerDown={beginPanelDrag}
            onPointerMove={onPanelDrag}
            onPointerUp={endPanelDrag}
          >
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

          <div className="shrink-0 border-b border-[#efe4de] px-3 py-2 bg-white/45">
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
                <div
                  key={s.id}
                  className={`shrink-0 inline-flex items-center gap-1 pl-2 pr-1 py-1 rounded-lg text-[11px] border ${
                    s.id === sessionId ? 'text-white border-transparent' : 'text-stone-600 border-stone-200 bg-white/70'
                  }`}
                  style={s.id === sessionId ? { background: 'linear-gradient(135deg,#de8f7b,#a29cb9)' } : undefined}
                >
                  <button onClick={() => openSession(s.id)} className="truncate max-w-[72px]">
                    {s.title || '新对话'}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteSession(s.id)
                    }}
                    className={`rounded-md p-0.5 ${s.id === sessionId ? 'hover:bg-white/20' : 'hover:bg-stone-100'}`}
                    title="删除对话"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-2.5">
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
                    {m.role === 'assistant' && m.content
                      ? renderMessageContent(m.content, (id) => { setOpen(false); navigate(`/diaries/${id}`) })
                      : m.content || (responding && m.role === 'assistant' ? '...' : '')}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="shrink-0 border-t border-[#efe4de] px-3 py-2 bg-white/60">
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
