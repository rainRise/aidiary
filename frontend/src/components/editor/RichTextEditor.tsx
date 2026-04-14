// 富文本编辑器 - 基于 Lexical，支持 Markdown、图片上传、Slash 命令、Notion 风格浮动工具栏
import { useEffect, useRef, useCallback, useState } from 'react'
import { createPortal } from 'react-dom'
import { LexicalComposer } from '@lexical/react/LexicalComposer'
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin'
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { MarkdownShortcutPlugin } from '@lexical/react/LexicalMarkdownShortcutPlugin'
import {
  $getRoot, $createParagraphNode, $getSelection, $isRangeSelection,
  FORMAT_TEXT_COMMAND, SELECTION_CHANGE_COMMAND, PASTE_COMMAND,
  COMMAND_PRIORITY_LOW, COMMAND_PRIORITY_HIGH,
  EditorState, LexicalEditor, $createTextNode
} from 'lexical'
import { HeadingNode, QuoteNode } from '@lexical/rich-text'
import { CodeNode } from '@lexical/code'
import { ListNode, ListItemNode } from '@lexical/list'
import { LinkNode } from '@lexical/link'
import { $generateHtmlFromNodes } from '@lexical/html'
import {
  $convertFromMarkdownString, $convertToMarkdownString,
  TRANSFORMERS, type ElementTransformer,
} from '@lexical/markdown'
import { Bold, Italic, Underline, Strikethrough, Code, Type, Image as ImageIcon, Loader2, ChevronDown, Mic, MicOff } from 'lucide-react'
import { diaryService } from '@/services/diary.service'
import { toast } from '@/components/ui/toast'
import { ImageNode, $createImageNode, $isImageNode } from './ImageNode'

declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition
    webkitSpeechRecognition: typeof SpeechRecognition
  }
}

const IMAGE_TRANSFORMER: ElementTransformer = {
  type: 'element',
  dependencies: [ImageNode],
  regExp: /^!\[(.*?)\]\((.+?)\)$/,
  replace: (parentNode, _children, match) => {
    const altText = (match[1] || '图片').trim()
    const src = (match[2] || '').trim()
    if (!src) return
    parentNode.replace($createImageNode(src, altText))
  },
  export: (node) => {
    if (!$isImageNode(node)) return null
    return `![${node.getAltText() || '图片'}](${node.getSrc()})`
  },
}

const STORAGE_TRANSFORMERS = [IMAGE_TRANSFORMER, ...TRANSFORMERS]

// ---- 颜色/字号常量 ----
const TEXT_COLORS = [
  { label: '默认', value: '', css: 'inherit' },
  { label: '灰', value: 'color-gray', css: '#787774' },
  { label: '棕', value: 'color-brown', css: '#9F6B53' },
  { label: '橙', value: 'color-orange', css: '#D9730D' },
  { label: '黄', value: 'color-yellow', css: '#CB912F' },
  { label: '绿', value: 'color-green', css: '#448361' },
  { label: '蓝', value: 'color-blue', css: '#337EA9' },
  { label: '紫', value: 'color-purple', css: '#9065B0' },
  { label: '粉', value: 'color-pink', css: '#C14C8A' },
  { label: '红', value: 'color-red', css: '#D44C47' },
]

const BG_COLORS = [
  { label: '无', value: '', css: 'transparent' },
  { label: '灰', value: 'bg-gray', css: '#F1F1EF' },
  { label: '棕', value: 'bg-brown', css: '#F4EEEE' },
  { label: '橙', value: 'bg-orange', css: '#FBECDD' },
  { label: '黄', value: 'bg-yellow', css: '#FBF3DB' },
  { label: '绿', value: 'bg-green', css: '#EDF3EC' },
  { label: '蓝', value: 'bg-blue', css: '#E7F3F8' },
  { label: '紫', value: 'bg-purple', css: '#F6F3F9' },
  { label: '粉', value: 'bg-pink', css: '#FAF1F5' },
  { label: '红', value: 'bg-red', css: '#FDEBEC' },
]

const FONT_SIZES = [
  { label: '小', value: 'fs-sm', css: '13px' },
  { label: '正常', value: '', css: '15px' },
  { label: '大', value: 'fs-lg', css: '18px' },
  { label: '特大', value: 'fs-xl', css: '22px' },
]

// ---- Toolbar button (顶部栏用) ----
function ToolbarBtn({
  children, onClick, title, disabled, active,
}: {
  children: React.ReactNode
  onClick: () => void
  title: string
  disabled?: boolean
  active?: boolean
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors disabled:opacity-40 ${
        active
          ? 'bg-rose-100 text-rose-500'
          : 'text-stone-500 hover:bg-rose-100 hover:text-rose-500'
      }`}
    >
      {children}
    </button>
  )
}

// ---- 顶部简版工具栏 ----
function TopToolbarPlugin({
  onRequestImage,
  uploading,
}: {
  onRequestImage: () => void
  uploading: boolean
}) {
  const [editor] = useLexicalComposerContext()
  const [isListening, setIsListening] = useState(false)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const isSupported = typeof window !== 'undefined' && 
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

  const handleVoiceInput = () => {
    if (!isSupported) {
      toast('您的浏览器不支持语音识别功能', 'error')
      return
    }

    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
      setIsListening(false)
      return
    }

    const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SpeechRecognitionClass()
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = 'zh-CN'

    recognition.onstart = () => {
      setIsListening(true)
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error)
      setIsListening(false)
      if (event.error === 'not-allowed') {
        toast('请允许麦克风权限', 'error')
      } else if (event.error !== 'aborted') {
        toast(`语音识别错误: ${event.error}`, 'error')
      }
    }

    recognition.onresult = (event) => {
      let finalTranscript = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript
        }
      }

      if (finalTranscript) {
        editor.update(() => {
          const root = $getRoot()
          const selection = $getSelection()
          
          const paragraph = $createParagraphNode()
          const textNode = $createTextNode(finalTranscript)
          paragraph.append(textNode)
          
          if ($isRangeSelection(selection)) {
            selection.insertNodes([paragraph])
          } else {
            root.append(paragraph)
          }
        })
      }
    }

    recognitionRef.current = recognition
    recognition.start()
    setIsListening(true)
  }

  return (
    <div className="flex items-center gap-1 px-3 py-2 border-b border-rose-50 bg-rose-50/30">
      <ToolbarBtn title="语音输入" onClick={handleVoiceInput} disabled={!isSupported}>
        {isListening
          ? <Mic className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
          : <MicOff className="w-3.5 h-3.5" />}
      </ToolbarBtn>
      <ToolbarBtn title="插入图片" onClick={onRequestImage} disabled={uploading}>
        {uploading
          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
          : <ImageIcon className="w-3.5 h-3.5" />}
      </ToolbarBtn>
      <span className="ml-2 text-[11px] text-stone-300 select-none">
        {isListening ? (
          <span className="text-rose-400 animate-pulse">正在录音...</span>
        ) : (
          <>选中文字可弹出格式工具栏 · 输入 / 可插入图片 · Ctrl+V 可粘贴图片</>
        )}
      </span>
    </div>
  )
}

// ---- Notion 风格浮动工具栏 ----
function FloatingToolbarPlugin() {
  const [editor] = useLexicalComposerContext()
  const toolbarRef = useRef<HTMLDivElement>(null)
  const [show, setShow] = useState(false)
  const [anchorPos, setAnchorPos] = useState({ top: 0, left: 0 })
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const isDragging = useRef(false)
  const dragStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 })
  const [formats, setFormats] = useState({
    bold: false, italic: false, underline: false, strikethrough: false, code: false,
  })
  const [colorPanel, setColorPanel] = useState<'text' | 'bg' | 'size' | null>(null)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const updateToolbar = useCallback(() => {
    const editorState = editor.getEditorState()
    editorState.read(() => {
      const selection = $getSelection()
      if (!$isRangeSelection(selection) || selection.isCollapsed()) {
        setShow(false)
        setColorPanel(null)
        return
      }
      setFormats({
        bold: selection.hasFormat('bold'),
        italic: selection.hasFormat('italic'),
        underline: selection.hasFormat('underline'),
        strikethrough: selection.hasFormat('strikethrough'),
        code: selection.hasFormat('code'),
      })

      const nativeSel = window.getSelection()
      if (!nativeSel || nativeSel.rangeCount === 0) return
      const range = nativeSel.getRangeAt(0)
      const rect = range.getBoundingClientRect()
      if (rect.width === 0) { setShow(false); return }

      // 显示在选区正下方 8px
      setAnchorPos({
        top: rect.bottom + window.scrollY + 8,
        left: rect.left + window.scrollX + rect.width / 2,
      })
      setDragOffset({ x: 0, y: 0 })
      setShow(true)
    })
  }, [editor])

  useEffect(() => {
    const unsub1 = editor.registerUpdateListener(() => updateToolbar())
    const unsub2 = editor.registerCommand(
      SELECTION_CHANGE_COMMAND,
      () => { updateToolbar(); return false },
      COMMAND_PRIORITY_LOW,
    )
    return () => { unsub1(); unsub2() }
  }, [editor, updateToolbar])

  // ---- 拖拽逻辑 ----
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    isDragging.current = true
    dragStart.current = { x: e.clientX, y: e.clientY, ox: dragOffset.x, oy: dragOffset.y }
    e.preventDefault()
  }, [dragOffset])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return
      setDragOffset({
        x: dragStart.current.ox + (e.clientX - dragStart.current.x),
        y: dragStart.current.oy + (e.clientY - dragStart.current.y),
      })
    }
    const handleMouseUp = () => { isDragging.current = false }
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  // 鼠标离开工具栏时延迟隐藏（给面板留时间）
  const handleMouseLeave = () => {
    hideTimer.current = setTimeout(() => setColorPanel(null), 300)
  }
  const handleMouseEnter = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current)
  }

  const applyFormat = (format: 'bold' | 'italic' | 'underline' | 'strikethrough' | 'code') => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, format)
  }

  // 应用文字颜色/背景色/字号 — 通过 style 属性
  const applyStyle = (property: string, value: string) => {
    editor.update(() => {
      const selection = $getSelection()
      if (!$isRangeSelection(selection)) return
      const nodes = selection.getNodes()
      nodes.forEach((node) => {
        // 文本节点设置 style
        if (node.getType() === 'text') {
          const current = (node as any).getStyle() || ''
          // 移除同类属性
          const cleaned = current.replace(new RegExp(property + String.raw`:\s*[^;]+;?`, 'g'), '').trim()
          const newStyle = value ? `${cleaned}${cleaned && !cleaned.endsWith(';') ? ';' : ''}${property}: ${value};` : cleaned
          ;(node as any).setStyle(newStyle)
        }
      })
    })
    setColorPanel(null)
  }

  if (!show) return null

  const FmtBtn = ({ active, onClick, children, title }: { active?: boolean; onClick: () => void; children: React.ReactNode; title: string }) => (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => { e.preventDefault(); onClick() }}
      className={`w-8 h-8 flex items-center justify-center rounded-md transition-all ${
        active ? 'bg-stone-700 text-white' : 'text-stone-300 hover:text-white hover:bg-stone-600'
      }`}
    >
      {children}
    </button>
  )

  const toolbar = (
    <div
      ref={toolbarRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="fixed z-[9999]"
      style={{
        top: anchorPos.top + dragOffset.y,
        left: anchorPos.left + dragOffset.x,
        transform: 'translateX(-50%)',
      }}
    >
      {/* 主工具栏 */}
      <div className="flex items-center gap-0.5 px-1.5 py-1 rounded-xl bg-stone-800/95 backdrop-blur-sm shadow-xl border border-stone-700/50">
        {/* 拖拽手柄 */}
        <div
          onMouseDown={handleDragStart}
          className="w-6 h-8 flex items-center justify-center cursor-grab active:cursor-grabbing text-stone-500 hover:text-stone-300 shrink-0"
          title="拖拽移动"
        >
          <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor">
            <circle cx="3" cy="2" r="1.2"/><circle cx="7" cy="2" r="1.2"/>
            <circle cx="3" cy="7" r="1.2"/><circle cx="7" cy="7" r="1.2"/>
            <circle cx="3" cy="12" r="1.2"/><circle cx="7" cy="12" r="1.2"/>
          </svg>
        </div>
        <div className="w-px h-5 bg-stone-600 mx-0.5" />
        {/* 字号 */}
        <div className="relative">
          <button
            type="button"
            title="字号"
            onMouseDown={(e) => { e.preventDefault(); setColorPanel(colorPanel === 'size' ? null : 'size') }}
            className="h-8 px-2 flex items-center gap-0.5 rounded-md text-stone-300 hover:text-white hover:bg-stone-600 transition-all"
          >
            <Type className="w-3.5 h-3.5" />
            <ChevronDown className="w-2.5 h-2.5" />
          </button>
          {colorPanel === 'size' && (
            <div className="absolute top-full left-0 mt-2 p-2 rounded-xl bg-white shadow-2xl border border-stone-100 min-w-[120px] z-10">
              <p className="text-[10px] text-stone-400 px-2 mb-1.5 font-medium">字号</p>
              {FONT_SIZES.map((s) => (
                <button
                  key={s.value || 'default'}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); applyStyle('font-size', s.css === '15px' ? '' : s.css) }}
                  className="w-full text-left px-2 py-1.5 rounded-lg text-sm text-stone-600 hover:bg-stone-50 transition-colors flex items-center gap-2"
                >
                  <span style={{ fontSize: s.css }}>{s.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 文字颜色 */}
        <div className="relative">
          <button
            type="button"
            title="文字颜色"
            onMouseDown={(e) => { e.preventDefault(); setColorPanel(colorPanel === 'text' ? null : 'text') }}
            className="h-8 px-2 flex items-center gap-0.5 rounded-md text-stone-300 hover:text-white hover:bg-stone-600 transition-all"
          >
            <span className="text-xs font-bold border-b-2 border-rose-400">A</span>
            <ChevronDown className="w-2.5 h-2.5" />
          </button>
          {colorPanel === 'text' && (
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 p-3 rounded-xl bg-white shadow-2xl border border-stone-100 z-10 w-[220px]">
              <p className="text-[10px] text-stone-400 mb-2 font-medium">文字颜色</p>
              <div className="grid grid-cols-5 gap-1.5">
                {TEXT_COLORS.map((c) => (
                  <button
                    key={c.value || 'default'}
                    type="button"
                    title={c.label}
                    onMouseDown={(e) => { e.preventDefault(); applyStyle('color', c.value ? c.css : '') }}
                    className="w-9 h-9 rounded-lg border border-stone-100 hover:border-stone-300 flex items-center justify-center transition-all hover:scale-110"
                    style={{ backgroundColor: c.value ? undefined : '#fff' }}
                  >
                    <span className="text-sm font-bold" style={{ color: c.css === 'inherit' ? '#37352F' : c.css }}>A</span>
                  </button>
                ))}
              </div>
              <div className="border-t border-stone-100 mt-3 pt-3">
                <p className="text-[10px] text-stone-400 mb-2 font-medium">背景颜色</p>
                <div className="grid grid-cols-5 gap-1.5">
                  {BG_COLORS.map((c) => (
                    <button
                      key={c.value || 'default-bg'}
                      type="button"
                      title={c.label}
                      onMouseDown={(e) => { e.preventDefault(); applyStyle('background-color', c.value ? c.css : '') }}
                      className="w-9 h-9 rounded-lg border border-stone-100 hover:border-stone-300 transition-all hover:scale-110"
                      style={{ backgroundColor: c.css === 'transparent' ? '#fff' : c.css }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="w-px h-5 bg-stone-600 mx-0.5" />

        {/* 格式按钮 */}
        <FmtBtn active={formats.bold} onClick={() => applyFormat('bold')} title="加粗">
          <Bold className="w-3.5 h-3.5" />
        </FmtBtn>
        <FmtBtn active={formats.italic} onClick={() => applyFormat('italic')} title="斜体">
          <Italic className="w-3.5 h-3.5" />
        </FmtBtn>
        <FmtBtn active={formats.underline} onClick={() => applyFormat('underline')} title="下划线">
          <Underline className="w-3.5 h-3.5" />
        </FmtBtn>
        <FmtBtn active={formats.strikethrough} onClick={() => applyFormat('strikethrough')} title="删除线">
          <Strikethrough className="w-3.5 h-3.5" />
        </FmtBtn>
        <FmtBtn active={formats.code} onClick={() => applyFormat('code')} title="行内代码">
          <Code className="w-3.5 h-3.5" />
        </FmtBtn>
      </div>
    </div>
  )

  return createPortal(toolbar, document.body)
}

// ---- Ctrl+V 粘贴图片插件 ----
function PasteImagePlugin() {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    const unregister = editor.registerCommand(
      PASTE_COMMAND,
      (event: ClipboardEvent) => {
        const clipboardData = event.clipboardData || (event as any).originalEvent?.clipboardData
        if (!clipboardData) return false

        const items = Array.from(clipboardData.items) as DataTransferItem[]
        const imageItem = items.find((item: DataTransferItem) => item.type.startsWith('image/'))
        if (!imageItem) return false

        event.preventDefault()
        const file = imageItem.getAsFile()
        if (!file) return false

        // 上传图片
        const upload = async () => {
          try {
            toast('正在上传图片...', 'info')
            const url = await diaryService.uploadImage(file)
            editor.update(() => {
              const imageNode = $createImageNode(url, '图片')
              const trailingParagraph = $createParagraphNode()
              const selection = $getSelection()
              if ($isRangeSelection(selection)) {
                selection.insertNodes([imageNode, trailingParagraph])
              } else {
                const root = $getRoot()
                root.append(imageNode)
                root.append(trailingParagraph)
              }
            })
            toast('图片已插入', 'success')
          } catch {
            toast('图片上传失败', 'error')
          }
        }
        upload()
        return true
      },
      COMMAND_PRIORITY_HIGH,
    )
    return () => unregister()
  }, [editor])

  return null
}

// ---- Slash command ----
function SlashCommandPlugin({
  onOpenImagePicker,
  onVisibilityChange,
}: {
  onOpenImagePicker: () => void
  onVisibilityChange: (visible: boolean) => void
}) {
  const [editor] = useLexicalComposerContext()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const detectSlash = (editorState: EditorState) => {
      editorState.read(() => {
        const selection = $getSelection()
        if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
          if (open) {
            setOpen(false)
            onVisibilityChange(false)
          }
          return
        }

        const anchorNode = selection.anchor.getNode()
        const textBeforeCursor = anchorNode.getTextContent().slice(0, selection.anchor.offset)
        const shouldOpen = /(^|\s)\/$/.test(textBeforeCursor)

        if (shouldOpen !== open) {
          setOpen(shouldOpen)
          onVisibilityChange(shouldOpen)
        }
      })
    }

    detectSlash(editor.getEditorState())
    const unregister = editor.registerUpdateListener(({ editorState }) => detectSlash(editorState))
    return () => unregister()
  }, [editor, onVisibilityChange, open])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!open) return
      if (e.key === 'Escape') {
        setOpen(false)
        onVisibilityChange(false)
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        setOpen(false)
        onVisibilityChange(false)
        onOpenImagePicker()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onOpenImagePicker, onVisibilityChange, open])

  return null
}

// ---- Image insertion plugin ----
function ImageInsertPlugin({
  pendingUrl, onInserted,
}: { pendingUrl: string | null; onInserted: () => void }) {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    if (!pendingUrl) return
    editor.update(() => {
      const imageNode = $createImageNode(pendingUrl, '图片')
      const trailingParagraph = $createParagraphNode()
      const selection = $getSelection()
      if ($isRangeSelection(selection)) {
        selection.insertNodes([imageNode, trailingParagraph])
      } else {
        const root = $getRoot()
        root.append(imageNode)
        root.append(trailingParagraph)
      }
    })
    onInserted()
  }, [pendingUrl, editor, onInserted])

  return null
}

// ---- Initial value plugin ----
function InitialValuePlugin({ value }: { value: string }) {
  const [editor] = useLexicalComposerContext()
  const initialized = useRef(false)

  useEffect(() => {
    if (initialized.current || !value) return
    initialized.current = true
    editor.update(() => {
      $convertFromMarkdownString(value, STORAGE_TRANSFORMERS)
    })
  }, [editor, value])

  return null
}

// ---- Main Editor ----
interface RichTextEditorProps {
  value: string
  onChange: (text: string, html: string) => void
  placeholder?: string
  minHeight?: number
}

const theme = {
  text: {
    bold: 'font-bold',
    italic: 'italic',
    underline: 'underline',
    strikethrough: 'line-through',
  },
  paragraph: 'mb-1',
  heading: {
    h1: 'text-2xl font-bold text-stone-700 mt-3 mb-2',
    h2: 'text-xl font-bold text-stone-700 mt-3 mb-2',
    h3: 'text-lg font-semibold text-stone-700 mt-2 mb-1.5',
    h4: 'text-base font-semibold text-stone-700 mt-2 mb-1.5',
    h5: 'text-sm font-semibold text-stone-700 mt-1.5 mb-1',
    h6: 'text-sm font-medium text-stone-600 mt-1.5 mb-1',
  },
  quote: 'border-l-4 border-rose-200 pl-3 text-stone-500 italic my-2',
}

function ErrorBoundary({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder = '今天发生了什么？\n\n你有什么感受？\n\n在这里自由书写，这是只属于你的空间...',
  minHeight = 320,
}: RichTextEditorProps) {
  const [pendingImageUrl, setPendingImageUrl] = useState<string | null>(null)
  const [showSlashMenu, setShowSlashMenu] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const initialConfig = {
    namespace: 'DiaryEditor',
    theme,
    nodes: [HeadingNode, QuoteNode, CodeNode, ListNode, ListItemNode, LinkNode, ImageNode],
    onError: (error: Error) => console.error(error),
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const url = await diaryService.uploadImage(file)
      setPendingImageUrl(url)
    } catch {
      toast('图片上传失败', 'error')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleChange = useCallback(
    (editorState: EditorState, editor: LexicalEditor) => {
      editorState.read(() => {
        const root = $getRoot()
        const markdown = $convertToMarkdownString(STORAGE_TRANSFORMERS)
        const html = $generateHtmlFromNodes(editor)
        const plainText = root.getTextContent()
        onChange(markdown || plainText, html)
      })
    },
    [onChange]
  )

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div className="flex flex-col">
        <TopToolbarPlugin onRequestImage={() => fileInputRef.current?.click()} uploading={uploading} />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          className="hidden"
          onChange={handleImageUpload}
        />
        <div className="relative" style={{ minHeight }}>
          {showSlashMenu && (
            <button
              type="button"
              onClick={() => {
                setShowSlashMenu(false)
                fileInputRef.current?.click()
              }}
              className="absolute z-20 left-6 top-3 px-3 py-2 rounded-xl border border-rose-100 bg-white text-xs text-stone-600 shadow-sm hover:bg-rose-50 transition-colors"
            >
              插入图片
            </button>
          )}
          <RichTextPlugin
            contentEditable={
              <ContentEditable
                className="w-full p-6 bg-transparent text-stone-600 text-sm leading-7 outline-none"
                style={{ minHeight }}
              />
            }
            placeholder={
              <div className="absolute top-6 left-6 text-stone-200 text-sm leading-7 pointer-events-none whitespace-pre-line select-none">
                {placeholder}
              </div>
            }
            ErrorBoundary={ErrorBoundary}
          />
          <HistoryPlugin />
          <MarkdownShortcutPlugin transformers={TRANSFORMERS} />
          <OnChangePlugin onChange={handleChange} />
          <InitialValuePlugin value={value} />
          <FloatingToolbarPlugin />
          <PasteImagePlugin />
          <SlashCommandPlugin
            onOpenImagePicker={() => fileInputRef.current?.click()}
            onVisibilityChange={setShowSlashMenu}
          />
          <ImageInsertPlugin
            pendingUrl={pendingImageUrl}
            onInserted={() => setPendingImageUrl(null)}
          />
        </div>
      </div>
    </LexicalComposer>
  )
}
