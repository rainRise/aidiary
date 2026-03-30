// 富文本编辑器 - 基于 Lexical，支持 Markdown、图片上传、Slash 命令
import { useEffect, useRef, useCallback, useState } from 'react'
import { LexicalComposer } from '@lexical/react/LexicalComposer'
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin'
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { MarkdownShortcutPlugin } from '@lexical/react/LexicalMarkdownShortcutPlugin'
import {
  $getRoot, $createParagraphNode, $getSelection, $isRangeSelection,
  FORMAT_TEXT_COMMAND, SELECTION_CHANGE_COMMAND,
  COMMAND_PRIORITY_LOW, EditorState, LexicalEditor
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
import { Bold, Italic, Image as ImageIcon, Loader2 } from 'lucide-react'
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

// ---- Toolbar button ----
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

// ---- Toolbar ----
function ToolbarPlugin({
  onRequestImage,
  uploading,
}: {
  onRequestImage: () => void
  uploading: boolean
}) {
  const [editor] = useLexicalComposerContext()
  const [activeFormats, setActiveFormats] = useState({ bold: false, italic: false })

  useEffect(() => {
    const updateToolbar = (editorState: EditorState) => {
      editorState.read(() => {
        const selection = $getSelection()
        if ($isRangeSelection(selection)) {
          setActiveFormats({
            bold: selection.hasFormat('bold'),
            italic: selection.hasFormat('italic'),
          })
          return
        }
        setActiveFormats({ bold: false, italic: false })
      })
    }

    updateToolbar(editor.getEditorState())

    const unregisterUpdate = editor.registerUpdateListener(({ editorState }) => {
      updateToolbar(editorState)
    })

    const unregisterSelection = editor.registerCommand(
      SELECTION_CHANGE_COMMAND,
      () => {
        updateToolbar(editor.getEditorState())
        return false
      },
      COMMAND_PRIORITY_LOW
    )

    return () => {
      unregisterUpdate()
      unregisterSelection()
    }
  }, [editor])

  return (
    <div className="flex items-center gap-1 px-3 py-2 border-b border-rose-50 bg-rose-50/30">
      <ToolbarBtn
        title="加粗"
        active={activeFormats.bold}
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold')}
      >
        <Bold className="w-3.5 h-3.5" />
      </ToolbarBtn>
      <ToolbarBtn
        title="斜体"
        active={activeFormats.italic}
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic')}
      >
        <Italic className="w-3.5 h-3.5" />
      </ToolbarBtn>
      <div className="w-px h-4 bg-stone-200 mx-1" />
      <ToolbarBtn title="插入图片" onClick={onRequestImage} disabled={uploading}>
        {uploading
          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
          : <ImageIcon className="w-3.5 h-3.5" />}
      </ToolbarBtn>
      <span className="ml-2 text-[11px] text-stone-300 select-none">输入 / 可插入图片</span>
    </div>
  )
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
        <ToolbarPlugin onRequestImage={() => fileInputRef.current?.click()} uploading={uploading} />
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
