import { DecoratorNode, type LexicalNode, type NodeKey, type SerializedLexicalNode, $applyNodeReplacement } from 'lexical'

export type SerializedImageNode = SerializedLexicalNode & {
  type: 'image'
  version: 1
  src: string
  altText: string
}

export class ImageNode extends DecoratorNode<JSX.Element> {
  __src: string
  __altText: string

  static getType(): string {
    return 'image'
  }

  static clone(node: ImageNode): ImageNode {
    return new ImageNode(node.__src, node.__altText, node.__key)
  }

  static importJSON(serializedNode: SerializedImageNode): ImageNode {
    return $createImageNode(serializedNode.src, serializedNode.altText)
  }

  exportJSON(): SerializedImageNode {
    return {
      ...super.exportJSON(),
      type: 'image',
      version: 1,
      src: this.__src,
      altText: this.__altText,
    }
  }

  constructor(src: string, altText: string, key?: NodeKey) {
    super(key)
    this.__src = src
    this.__altText = altText
  }

  createDOM(): HTMLElement {
    const div = document.createElement('div')
    div.className = 'my-3'
    return div
  }

  updateDOM(): boolean {
    return false
  }

  getTextContent(): string {
    return `![${this.__altText}](${this.__src})`
  }

  getSrc(): string {
    return this.getLatest().__src
  }

  getAltText(): string {
    return this.getLatest().__altText
  }

  decorate(): JSX.Element {
    return (
      <img
        src={this.__src}
        alt={this.__altText || '日记图片'}
        className="w-full max-h-[420px] object-contain rounded-xl border border-rose-100 bg-white"
        loading="lazy"
      />
    )
  }

  isInline(): boolean {
    return false
  }
}

export function $createImageNode(src: string, altText: string = '图片'): ImageNode {
  return $applyNodeReplacement(new ImageNode(src, altText))
}

export function $isImageNode(node: LexicalNode | null | undefined): node is ImageNode {
  return node instanceof ImageNode
}
