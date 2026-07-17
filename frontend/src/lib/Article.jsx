import { Children, isValidElement } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

// Native <ol>/<ul> markers (::marker, list-style) are CSS pseudo-elements —
// html2canvas (used for PDF export) doesn't reliably capture those, which
// is what caused numbered-list markers to render detached/misaligned in
// the PDF. Rendering the marker as a real DOM text node in a flex row next
// to the item content sidesteps that entirely, and looks identical on the
// live site too.
function buildList(ordered, compact = false) {
  return function List({ children }) {
    const items = Children.toArray(children).filter(isValidElement)
    return (
      <div className={compact ? 'mb-3 space-y-1.5' : 'mb-5 space-y-2'}>
        {items.map((item, i) => (
          <div key={i} className={`flex gap-2 ${compact ? 'text-xs text-beige-600' : 'text-sm text-beige-800'}`}>
            <span className="flex-shrink-0 text-beige-500 font-mono text-xs mt-0.5">
              {ordered ? `${i + 1}.` : '•'}
            </span>
            <span className="leading-relaxed">{item.props.children}</span>
          </div>
        ))}
      </div>
    )
  }
}

const components = {
  p: (props) => <p className="mb-5 text-sm text-beige-800 leading-relaxed" {...props} />,
  strong: (props) => <strong className="font-semibold text-beige-900" {...props} />,
  em: (props) => <em className="italic" {...props} />,
  h1: (props) => <h2 className="font-playfair font-bold text-xl text-beige-900 mt-8 mb-3" {...props} />,
  h2: (props) => <h2 className="font-playfair font-bold text-xl text-beige-900 mt-8 mb-3" {...props} />,
  h3: (props) => <h3 className="font-playfair font-bold text-lg text-beige-900 mt-6 mb-2" {...props} />,
  ul: buildList(false),
  ol: buildList(true),
  code: (props) => <code className="bg-beige-200 text-beige-800 px-1 py-0.5 rounded text-xs font-mono" {...props} />,
  blockquote: (props) => <blockquote className="border-l-2 border-beige-400 pl-4 italic text-beige-600 mb-5" {...props} />,
  table: (props) => (
    <div className="overflow-x-auto mb-5">
      <table className="w-full text-xs border-collapse" {...props} />
    </div>
  ),
  thead: (props) => <thead className="bg-beige-100" {...props} />,
  th: (props) => <th className="text-left px-3 py-2 font-mono uppercase tracking-wide text-beige-600 border-b border-beige-300" {...props} />,
  td: (props) => <td className="px-3 py-2 border-b border-beige-200 text-beige-800 align-top" {...props} />,
}

const compactComponents = {
  ...components,
  p: (props) => <p className="mb-3 text-xs text-beige-600 leading-relaxed" {...props} />,
  strong: (props) => <strong className="font-semibold text-beige-800" {...props} />,
  ul: buildList(false, true),
  ol: buildList(true, true),
  h1: (props) => <h2 className="font-playfair font-bold text-sm text-beige-900 mt-4 mb-2" {...props} />,
  h2: (props) => <h2 className="font-playfair font-bold text-sm text-beige-900 mt-4 mb-2" {...props} />,
  h3: (props) => <h3 className="font-playfair font-bold text-sm text-beige-900 mt-3 mb-1.5" {...props} />,
}

// fact_check/bias_report are also LLM-written Markdown (the fact checker's
// "**CLAIM 1:**" format especially) but were rendered as raw
// whitespace-pre-line text, so every ** showed up literally — same class of
// bug as the article body, just in the smaller side-panel/card styling
// instead of the main article's.
export function Markdown({ text }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={compactComponents}>
      {text}
    </ReactMarkdown>
  )
}

// draft/final_output are LLM-written Markdown (headings, bold/italic, tables,
// lists) but were previously dumped as raw text with no parsing, so
// formatting markers (**, |---|) showed up literally. Renders the body with
// real Markdown + GFM tables, and pulls the first line out separately for
// the large serif headline to match the existing hero-style layout.
export function Article({ text, headlineClassName }) {
  const lines = text.split('\n')
  const firstContentIndex = lines.findIndex(l => l.trim())
  const headline = (lines[firstContentIndex] || '')
    .replace(/^#+\s*/, '')
    .trim()
    // headline is rendered as plain text (not through ReactMarkdown), so a
    // fully-bolded/italicized line needs its wrapping markers stripped by
    // hand or they'd show up literally.
    .replace(/^\*\*(.+)\*\*$/, '$1')
    .replace(/^\*(.+)\*$/, '$1')
  const body = lines.slice(firstContentIndex + 1).join('\n')

  return (
    <>
      <h1 className={headlineClassName}>{headline}</h1>
      <div className="w-full h-px bg-beige-300 mb-8"></div>
      <div className="max-w-2xl">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
          {body}
        </ReactMarkdown>
      </div>
    </>
  )
}
