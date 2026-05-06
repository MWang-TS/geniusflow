import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { visit } from 'unist-util-visit'
import type { Plugin } from 'unified'
import type { Root, Text, Link } from 'mdast'

interface WikiPageRendererProps {
  content: string
  onLinkClick?: (slug: string) => void
}

/**
 * Custom remark plugin: converts [[Wiki Link]] syntax to standard markdown links.
 * [[Page Title]] → [Page Title](wiki:page-title)
 */
const remarkWikiLinks: Plugin<[], Root> = () => {
  return (tree) => {
    visit(tree, 'text', (node: Text, index, parent) => {
      if (!parent || index === undefined) return
      const WIKI_LINK = /\[\[([^\]]+)\]\]/g
      const text = node.value
      if (!WIKI_LINK.test(text)) return

      WIKI_LINK.lastIndex = 0
      const parts: Array<Text | Link> = []
      let lastIndex = 0
      let match

      while ((match = WIKI_LINK.exec(text)) !== null) {
        if (match.index > lastIndex) {
          parts.push({ type: 'text', value: text.slice(lastIndex, match.index) })
        }
        const label = match[1]
        const slug = label.toLowerCase().replace(/[^\w\s-]/g, '').replace(/[\s_]+/g, '-').replace(/-+/g, '-').slice(0, 80)
        parts.push({
          type: 'link',
          url: `wiki:${slug}`,
          title: label,
          children: [{ type: 'text', value: label }],
        })
        lastIndex = match.index + match[0].length
      }

      if (lastIndex < text.length) {
        parts.push({ type: 'text', value: text.slice(lastIndex) })
      }

      if (parts.length > 0) {
        parent.children.splice(index, 1, ...(parts as any[]))
      }
    })
  }
}

export default function WikiPageRenderer({ content, onLinkClick }: WikiPageRendererProps) {
  return (
    <div className="wiki-page-content" style={{ lineHeight: 1.7 }}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkWikiLinks]}
        components={{
          a: ({ href, children }) => {
            if (href?.startsWith('wiki:')) {
              const slug = href.slice(5)
              return (
                <a
                  href="#"
                  style={{ color: '#722ed1', textDecoration: 'underline dotted' }}
                  onClick={(e) => {
                    e.preventDefault()
                    onLinkClick?.(slug)
                  }}
                >
                  {children}
                </a>
              )
            }
            return (
              <a href={href} target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            )
          },
          h1: ({ children }) => <h1 style={{ fontSize: 22, marginTop: 16, marginBottom: 8 }}>{children}</h1>,
          h2: ({ children }) => <h2 style={{ fontSize: 18, marginTop: 14, marginBottom: 6 }}>{children}</h2>,
          h3: ({ children }) => <h3 style={{ fontSize: 15, marginTop: 12, marginBottom: 4 }}>{children}</h3>,
          code: ({ children, className }) => {
            const isBlock = className?.startsWith('language-')
            if (isBlock) {
              return (
                <pre style={{ background: '#f6f8fa', padding: '12px 16px', borderRadius: 6, overflow: 'auto', fontSize: 13 }}>
                  <code>{children}</code>
                </pre>
              )
            }
            return (
              <code style={{ background: '#f0f0f0', padding: '1px 6px', borderRadius: 3, fontSize: '0.9em' }}>{children}</code>
            )
          },
          blockquote: ({ children }) => (
            <blockquote style={{ borderLeft: '4px solid #722ed1', paddingLeft: 12, color: '#555', margin: '8px 0' }}>
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th style={{ border: '1px solid #ddd', padding: '6px 10px', background: '#fafafa', textAlign: 'left' }}>{children}</th>
          ),
          td: ({ children }) => (
            <td style={{ border: '1px solid #ddd', padding: '6px 10px' }}>{children}</td>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
