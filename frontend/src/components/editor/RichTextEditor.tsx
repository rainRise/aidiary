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
  EditorState, LexicalEditor, $createTextNode, $isTextNode
} from 'lexical'
import { $setBlocksType } from '@lexical/selection'
import { $createHeadingNode, $createQuoteNode, HeadingNode, QuoteNode, type HeadingTagType } from '@lexical/rich-text'
import { $createCodeNode, CodeNode } from '@lexical/code'
import { INSERT_ORDERED_LIST_COMMAND, INSERT_UNORDERED_LIST_COMMAND, ListNode, ListItemNode } from '@lexical/list'
import { LinkNode } from '@lexical/link'
import { $generateHtmlFromNodes } from '@lexical/html'
import {
  $convertFromMarkdownString, $convertToMarkdownString,
  TRANSFORMERS, type ElementTransformer,
} from '@lexical/markdown'
import {
  Bold, Italic, Underline, Strikethrough, Code, Type, Image as ImageIcon, Loader2, ChevronDown, Mic, Square,
  Pilcrow, Heading1, Heading2, Heading3, Heading4, List as ListIcon, ListOrdered, Quote, Code2,
} from 'lucide-react'
import { diaryService } from '@/services/diary.service'
import { toast } from '@/components/ui/toast'
import { ImageNode, $createImageNode, $isImageNode } from './ImageNode'

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

type SlashCommandKind = 'paragraph' | 'heading' | 'bullet' | 'numbered' | 'quote' | 'code' | 'image'

type SlashCommandItem = {
  id: string
  title: string
  description: string
  shortcut: string
  keywords: string
  kind: SlashCommandKind
  headingTag?: HeadingTagType
  icon: React.ComponentType<{ className?: string }>
}

const SLASH_COMMANDS: SlashCommandItem[] = [
  {
    id: 'text',
    title: '文本',
    description: '普通段落，用来记录想法',
    shortcut: 'text',
    keywords: 'text wenben duanluo paragraph',
    kind: 'paragraph',
    icon: Pilcrow,
  },
  {
    id: 'h1',
    title: '一级标题',
    description: '大标题，适合章节开头',
    shortcut: '#',
    keywords: 'h1 heading title biaoti yiji',
    kind: 'heading',
    headingTag: 'h1',
    icon: Heading1,
  },
  {
    id: 'h2',
    title: '二级标题',
    description: '分段标题，适合整理结构',
    shortcut: '##',
    keywords: 'h2 heading title biaoti erji',
    kind: 'heading',
    headingTag: 'h2',
    icon: Heading2,
  },
  {
    id: 'h3',
    title: '三级标题',
    description: '小节标题，适合轻量分组',
    shortcut: '###',
    keywords: 'h3 heading title biaoti sanji',
    kind: 'heading',
    headingTag: 'h3',
    icon: Heading3,
  },
  {
    id: 'h4',
    title: '四级标题',
    description: '更轻的段内标题',
    shortcut: '####',
    keywords: 'h4 heading title biaoti siji',
    kind: 'heading',
    headingTag: 'h4',
    icon: Heading4,
  },
  {
    id: 'bullet',
    title: '项目符号列表',
    description: '把零散想法列出来',
    shortcut: '-',
    keywords: 'bullet list liebiao xiangmu',
    kind: 'bullet',
    icon: ListIcon,
  },
  {
    id: 'numbered',
    title: '编号列表',
    description: '适合记录步骤和顺序',
    shortcut: '1.',
    keywords: 'number ordered list bianhao shunxu',
    kind: 'numbered',
    icon: ListOrdered,
  },
  {
    id: 'quote',
    title: '引用',
    description: '突出一句重要的话',
    shortcut: '>',
    keywords: 'quote yinyong',
    kind: 'quote',
    icon: Quote,
  },
  {
    id: 'code',
    title: '代码块',
    description: '记录代码、命令或原始文本',
    shortcut: '```',
    keywords: 'code daima mingling',
    kind: 'code',
    icon: Code2,
  },
  {
    id: 'image',
    title: '图片',
    description: '上传并插入一张图片',
    shortcut: 'image',
    keywords: 'image picture tupian charu upload',
    kind: 'image',
    icon: ImageIcon,
  },
]

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

function downsampleBuffer(buffer: Float32Array, inputSampleRate: number, outputSampleRate: number) {
  if (outputSampleRate >= inputSampleRate) return buffer
  const sampleRateRatio = inputSampleRate / outputSampleRate
  const newLength = Math.round(buffer.length / sampleRateRatio)
  const result = new Float32Array(newLength)
  let offsetResult = 0
  let offsetBuffer = 0
  while (offsetResult < result.length) {
    const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio)
    let accum = 0
    let count = 0
    for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
      accum += buffer[i]
      count++
    }
    result[offsetResult] = count > 0 ? accum / count : 0
    offsetResult++
    offsetBuffer = nextOffsetBuffer
  }
  return result
}

function encodePcm16(samples: Float32Array) {
  const buffer = new ArrayBuffer(samples.length * 2)
  const view = new DataView(buffer)

  let offset = 0
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }

  return buffer
}

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
  onToggleRecording,
  isRecording,
  isTranscribing,
  liveTranscript,
}: {
  onRequestImage: () => void
  uploading: boolean
  onToggleRecording: () => void
  isRecording: boolean
  isTranscribing: boolean
  liveTranscript: string
}) {
  const speechHint = isTranscribing
    ? '正在整理识别结果...'
    : isRecording
      ? liveTranscript || '正在听写，点击方块结束'
      : '选中文字可弹出格式工具栏 · 输入 / 打开模块菜单 · Ctrl+V 可粘贴图片'

  return (
    <div className="flex items-center gap-1 px-3 py-2 border-b border-rose-50 bg-rose-50/30">
      <ToolbarBtn title="插入图片" onClick={onRequestImage} disabled={uploading}>
        {uploading
          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
          : <ImageIcon className="w-3.5 h-3.5" />}
      </ToolbarBtn>
      <ToolbarBtn
        title={isRecording ? '结束录音' : '语音输入'}
        onClick={onToggleRecording}
        disabled={isTranscribing}
        active={isRecording}
      >
        {isTranscribing
          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
          : isRecording
            ? <Square className="w-3.5 h-3.5" />
          : <Mic className="w-3.5 h-3.5" />}
      </ToolbarBtn>
      <span className={`ml-2 text-[11px] select-none truncate ${
        isRecording || isTranscribing ? 'text-rose-400' : 'text-stone-300'
      }`}>
        {speechHint}
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
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 })

  const filteredCommands = SLASH_COMMANDS.filter((item) => {
    const needle = query.trim().toLowerCase()
    if (!needle) return true
    return `${item.title} ${item.description} ${item.shortcut} ${item.keywords}`
      .toLowerCase()
      .includes(needle)
  })

  const closeMenu = useCallback(() => {
    setOpen(false)
    setQuery('')
    setSelectedIndex(0)
    onVisibilityChange(false)
  }, [onVisibilityChange])

  const removeSlashQuery = useCallback(() => {
    editor.update(() => {
      const selection = $getSelection()
      if (!$isRangeSelection(selection) || !selection.isCollapsed()) return

      const anchor = selection.anchor
      const anchorNode = anchor.getNode()
      if (!$isTextNode(anchorNode)) return

      const textBeforeCursor = anchorNode.getTextContent().slice(0, anchor.offset)
      const slashIndex = textBeforeCursor.lastIndexOf('/')
      if (slashIndex < 0) return

      anchorNode.spliceText(slashIndex, anchor.offset - slashIndex, '', true)
    })
  }, [editor])

  const runCommand = useCallback((item: SlashCommandItem) => {
    removeSlashQuery()

    if (item.kind === 'image') {
      closeMenu()
      onOpenImagePicker()
      return
    }

    if (item.kind === 'bullet') {
      editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined)
      closeMenu()
      return
    }

    if (item.kind === 'numbered') {
      editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined)
      closeMenu()
      return
    }

    editor.update(() => {
      const selection = $getSelection()
      if (!$isRangeSelection(selection)) return

      if (item.kind === 'paragraph') {
        $setBlocksType(selection, () => $createParagraphNode())
      }

      if (item.kind === 'heading' && item.headingTag) {
        $setBlocksType(selection, () => $createHeadingNode(item.headingTag!))
      }

      if (item.kind === 'quote') {
        $setBlocksType(selection, () => $createQuoteNode())
      }

      if (item.kind === 'code') {
        $setBlocksType(selection, () => $createCodeNode())
      }
    })

    closeMenu()
  }, [closeMenu, editor, onOpenImagePicker, removeSlashQuery])

  useEffect(() => {
    const detectSlash = (editorState: EditorState) => {
      editorState.read(() => {
        const selection = $getSelection()
        if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
          if (open) closeMenu()
          return
        }

        const anchorNode = selection.anchor.getNode()
        if (!$isTextNode(anchorNode)) {
          if (open) closeMenu()
          return
        }

        const textBeforeCursor = anchorNode.getTextContent().slice(0, selection.anchor.offset)
        const match = textBeforeCursor.match(/(?:^|\s)\/([^\s/]*)$/)
        const shouldOpen = Boolean(match)

        if (shouldOpen !== open) {
          setOpen(shouldOpen)
          onVisibilityChange(shouldOpen)
        }
        if (shouldOpen) {
          const nextQuery = match?.[1] || ''
          setQuery(nextQuery)
          setSelectedIndex(0)

          const nativeSelection = window.getSelection()
          const range = nativeSelection?.rangeCount ? nativeSelection.getRangeAt(0) : null
          const rect = range?.getBoundingClientRect()
          const rootRect = editor.getRootElement()?.getBoundingClientRect()
          const left = rect && rect.left > 0
            ? rect.left + window.scrollX
            : (rootRect?.left || 0) + window.scrollX + 24
          const top = rect && rect.bottom > 0
            ? rect.bottom + window.scrollY + 10
            : (rootRect?.top || 0) + window.scrollY + 36
          setMenuPos({ top, left })
        }
      })
    }

    detectSlash(editor.getEditorState())
    const unregister = editor.registerUpdateListener(({ editorState }) => detectSlash(editorState))
    return () => unregister()
  }, [closeMenu, editor, onVisibilityChange, open])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!open) return

      if (e.key === 'Escape') {
        e.preventDefault()
        closeMenu()
        return
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((index) => Math.min(index + 1, Math.max(filteredCommands.length - 1, 0)))
        return
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((index) => Math.max(index - 1, 0))
        return
      }

      if (e.key === 'Enter') {
        e.preventDefault()
        const command = filteredCommands[selectedIndex]
        if (command) runCommand(command)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [closeMenu, filteredCommands, open, runCommand, selectedIndex])

  if (!open) return null

  const menuLeft = Math.max(16, Math.min(menuPos.left, window.innerWidth - 376))

  const menu = (
    <div
      className="fixed z-[9998] w-[360px] max-w-[calc(100vw-32px)] overflow-hidden rounded-2xl border border-stone-200/80 bg-white/95 shadow-[0_18px_60px_rgba(82,64,54,0.16)] backdrop-blur-xl"
      style={{ top: menuPos.top, left: menuLeft }}
    >
      <div className="px-4 pt-3 pb-2 border-b border-stone-100">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-stone-400">基础模块</p>
        <p className="mt-1 text-xs text-stone-400">输入关键词筛选，回车插入，Esc 关闭</p>
      </div>
      <div className="max-h-[320px] overflow-y-auto p-2">
        {filteredCommands.length > 0 ? (
          filteredCommands.map((item, index) => {
            const Icon = item.icon
            const active = index === selectedIndex
            return (
              <button
                key={item.id}
                type="button"
                onMouseEnter={() => setSelectedIndex(index)}
                onMouseDown={(event) => {
                  event.preventDefault()
                  runCommand(item)
                }}
                className={`w-full min-h-[54px] rounded-xl px-3 py-2 flex items-center gap-3 text-left transition-colors ${
                  active ? 'bg-stone-100/90' : 'hover:bg-stone-50'
                }`}
              >
                <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  active ? 'bg-white text-stone-700 shadow-sm' : 'bg-stone-50 text-stone-500'
                }`}>
                  <Icon className="w-4 h-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-stone-700">{item.title}</span>
                  <span className="block text-xs text-stone-400 truncate">{item.description}</span>
                </span>
                <span className="text-xs text-stone-300 shrink-0">{item.shortcut}</span>
              </button>
            )
          })
        ) : (
          <div className="px-3 py-8 text-center text-sm text-stone-400">
            没有找到相关模块
          </div>
        )}
      </div>
      <button
        type="button"
        onMouseDown={(event) => {
          event.preventDefault()
          closeMenu()
        }}
        className="w-full px-4 py-3 border-t border-stone-100 text-left text-sm text-stone-500 hover:bg-stone-50 transition-colors"
      >
        关闭菜单 <span className="float-right text-xs text-stone-300">esc</span>
      </button>
    </div>
  )

  return createPortal(menu, document.body)
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

function TextInsertPlugin({
  pendingText,
  onInserted,
}: {
  pendingText: string | null
  onInserted: () => void
}) {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    if (!pendingText) return
    editor.update(() => {
      const selection = $getSelection()
      if ($isRangeSelection(selection)) {
        selection.insertText(pendingText)
        return
      }
      const root = $getRoot()
      const paragraph = $createParagraphNode()
      paragraph.append($createTextNode(pendingText))
      root.append(paragraph)
    })
    onInserted()
  }, [pendingText, editor, onInserted])

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
    code: 'rounded-md bg-stone-100 px-1.5 py-0.5 font-mono text-[0.92em] text-rose-600',
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
  list: {
    ul: 'my-2 ml-5 list-disc space-y-1 marker:text-rose-300',
    ol: 'my-2 ml-5 list-decimal space-y-1 marker:text-stone-400',
    listitem: 'pl-1 leading-7 text-stone-600',
    nested: {
      listitem: 'list-none',
    },
  },
  code: 'my-3 block rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 font-mono text-[13px] leading-6 text-stone-700 whitespace-pre-wrap',
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
  const [pendingInsertText, setPendingInsertText] = useState<string | null>(null)
  const [, setShowSlashMenu] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [liveTranscript, setLiveTranscript] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const recordingActiveRef = useRef(false)
  const streamFinishedRef = useRef(false)
  const finalTranscriptRef = useRef('')

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

  const cleanupRecordingResources = useCallback(async () => {
    const processor = processorRef.current
    if (processor) {
      processor.onaudioprocess = null
      processor.disconnect()
      processorRef.current = null
    }

    const source = sourceRef.current
    if (source) {
      source.disconnect()
      sourceRef.current = null
    }

    const stream = streamRef.current
    if (stream) {
      stream.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }

    const audioContext = audioContextRef.current
    if (audioContext && audioContext.state !== 'closed') {
      await audioContext.close().catch(() => undefined)
      audioContextRef.current = null
    }
  }, [])

  const finishTranscription = useCallback((text: string, options?: { silent?: boolean }) => {
    if (streamFinishedRef.current) return
    streamFinishedRef.current = true
    recordingActiveRef.current = false

    const ws = wsRef.current
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.close(1000)
    }
    wsRef.current = null

    const finalText = text.trim()
    setIsRecording(false)
    setIsTranscribing(false)
    setLiveTranscript('')

    if (!finalText) {
      if (!options?.silent) toast('未识别到有效语音，请重试', 'error')
      return
    }

    setPendingInsertText(`${finalText}\n`)
    toast('语音识别成功', 'success')
  }, [])

  const failTranscription = useCallback((message: string) => {
    if (streamFinishedRef.current) return
    streamFinishedRef.current = true
    recordingActiveRef.current = false
    setIsRecording(false)
    setIsTranscribing(false)
    setLiveTranscript('')
    toast(message, 'error')
  }, [])

  const stopRecording = useCallback(() => {
    if (!recordingActiveRef.current) return
    recordingActiveRef.current = false
    setIsRecording(false)
    setIsTranscribing(true)
    void cleanupRecordingResources()

    const ws = wsRef.current
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'end' }))
      return
    }

    failTranscription('语音通道已断开，请重试')
  }, [cleanupRecordingResources, failTranscription])

  const handleToggleRecording = useCallback(async () => {
    if (isTranscribing) return
    if (isRecording || recordingActiveRef.current) {
      stopRecording()
      return
    }

    if (!window.isSecureContext && window.location.hostname !== 'localhost') {
      toast('语音输入需要 HTTPS 安全环境，请使用 https://yingjiapp.com 访问', 'error')
      return
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      toast('当前浏览器不支持录音', 'error')
      return
    }

    const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioContextCtor) {
      toast('当前浏览器不支持 Web Audio 录音处理', 'error')
      return
    }

    try {
      streamFinishedRef.current = false
      finalTranscriptRef.current = ''
      setLiveTranscript('')

      const ws = new WebSocket(diaryService.getSpeechStreamUrl())
      ws.binaryType = 'arraybuffer'
      wsRef.current = ws

      await new Promise<void>((resolve, reject) => {
        const timer = window.setTimeout(() => reject(new Error('语音服务连接超时')), 8000)
        ws.onopen = () => {
          window.clearTimeout(timer)
          resolve()
        }
        ws.onerror = () => {
          window.clearTimeout(timer)
          reject(new Error('语音服务连接失败'))
        }
      })

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data.type === 'ready') return
          if (data.type === 'error') {
            void cleanupRecordingResources()
            failTranscription(data.message || '语音识别失败')
            return
          }
          if (data.type === 'partial' || data.type === 'final') {
            const text = String(data.text || '')
            finalTranscriptRef.current = text
            setLiveTranscript(text)
            if (data.type === 'final' && !recordingActiveRef.current) {
              finishTranscription(text)
            }
          }
        } catch {
          // 忽略非 JSON 控制帧
        }
      }
      ws.onclose = () => {
        if (!streamFinishedRef.current && !recordingActiveRef.current) {
          finishTranscription(finalTranscriptRef.current)
        }
      }
      ws.onerror = () => {
        if (!streamFinishedRef.current) {
          void cleanupRecordingResources()
          failTranscription('语音服务连接异常，请稍后重试')
        }
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      })
      streamRef.current = stream

      const audioContext = new AudioContextCtor()
      audioContextRef.current = audioContext
      const source = audioContext.createMediaStreamSource(stream)
      const processor = audioContext.createScriptProcessor(4096, 1, 1)
      sourceRef.current = source
      processorRef.current = processor

      processor.onaudioprocess = (event) => {
        event.outputBuffer.getChannelData(0).fill(0)
        if (!recordingActiveRef.current || ws.readyState !== WebSocket.OPEN) return
        const input = event.inputBuffer.getChannelData(0)
        const downsampled = downsampleBuffer(input, audioContext.sampleRate, 16000)
        const pcm = encodePcm16(downsampled)
        if (pcm.byteLength > 0) {
          ws.send(pcm)
        }
      }

      source.connect(processor)
      processor.connect(audioContext.destination)

      recordingActiveRef.current = true
      setIsRecording(true)
      toast('开始实时听写，再次点击可结束', 'info')
    } catch (e: any) {
      recordingActiveRef.current = false
      streamFinishedRef.current = true
      await cleanupRecordingResources()
      const ws = wsRef.current
      if (ws && ws.readyState === WebSocket.OPEN) ws.close(1011)
      wsRef.current = null
      toast(e?.message || '无法访问麦克风，请检查浏览器权限', 'error')
    }
  }, [
    cleanupRecordingResources,
    failTranscription,
    finishTranscription,
    isRecording,
    isTranscribing,
    stopRecording,
  ])

  useEffect(() => {
    return () => {
      recordingActiveRef.current = false
      const ws = wsRef.current
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close(1000)
      }
      void cleanupRecordingResources()
    }
  }, [cleanupRecordingResources])

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div className="flex flex-col">
        <TopToolbarPlugin
          onRequestImage={() => fileInputRef.current?.click()}
          uploading={uploading}
          onToggleRecording={handleToggleRecording}
          isRecording={isRecording}
          isTranscribing={isTranscribing}
          liveTranscript={liveTranscript}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          className="hidden"
          onChange={handleImageUpload}
        />
        <div className="relative" style={{ minHeight }}>
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
          <TextInsertPlugin
            pendingText={pendingInsertText}
            onInserted={() => setPendingInsertText(null)}
          />
        </div>
      </div>
    </LexicalComposer>
  )
}
