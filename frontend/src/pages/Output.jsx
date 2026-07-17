import { useState, useEffect } from 'react'
import { useLocation, useParams, Link } from 'react-router-dom'
import axios from 'axios'
import { Article, Markdown } from '../lib/Article'
import { API_BASE } from '../lib/api'
import { downloadArticlePdf } from '../lib/pdf'

function parseCitations(raw) {
  if (!raw) return []
  const blocks = raw.split(/SOURCE \d+:/).map(b => b.trim()).filter(Boolean)
  return blocks.map(block => {
    const get = (label) => {
      const match = block.match(new RegExp(`${label}:\\s*(.+)`))
      return match ? match[1].trim() : ''
    }
    return {
      title: get('TITLE'),
      publisher: get('PUBLISHER'),
      type: get('TYPE'),
      url: get('URL')
    }
  }).filter(c => c.title)
}

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'article'
}

export default function Output() {
  const { threadId } = useParams()
  const location = useLocation()
  const [fetched, setFetched] = useState(null)
  const [notFound, setNotFound] = useState(false)
  const [copied, setCopied] = useState(false)
  const [copyFailed, setCopyFailed] = useState(false)
  const [generatingPdf, setGeneratingPdf] = useState(false)
  const [pdfFailed, setPdfFailed] = useState(false)

  useEffect(() => {
    if (location.state) return
    axios.get(`${API_BASE}/runs/${threadId}`)
      .then(res => setFetched(res.data))
      .catch(() => setNotFound(true))
  }, [threadId, location.state])

  const state = location.state || fetched

  if (!state) {
    if (notFound) {
      return (
        <div className="min-h-screen bg-beige-50 font-dm flex flex-col items-center justify-center gap-4">
          <p className="text-sm text-beige-600">No saved output found for this run.</p>
          <Link to="/" className="text-xs px-5 py-2 rounded-full bg-beige-900 text-beige-50">
            Start a new run
          </Link>
        </div>
      )
    }
    return (
      <div className="min-h-screen bg-beige-50 font-dm flex items-center justify-center">
        <span className="text-xs font-mono text-beige-400">loading...</span>
      </div>
    )
  }

  const { final_output = '', citations = '', bias_report = '', fact_check = '', score = 0, tokens_used = 0, topic = '' } = state
  // thread_id is capped at 20 characters (it's also the routing key), so
  // it can't stand in for the real topic once that's longer — prefer the
  // full topic (from navigation state or the DB-backed fetch), falling
  // back to the deslugified thread_id only if neither has it.
  const displayTopic = topic || threadId.replace(/_/g, ' ')
  const wordCount = final_output.split(/\s+/).filter(Boolean).length
  const sources = parseCitations(citations)
  const headline = (final_output.split('\n').find(l => l.trim()) || threadId).replace(/^#+\s*/, '').trim()

  const handleCopy = async () => {
    setCopyFailed(false)
    try {
      await navigator.clipboard.writeText(final_output)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
      return
    } catch {
      // Clipboard API can reject (permission denied, unfocused document,
      // restricted embed/iframe context) even in normal browser use, not
      // just automation — fall back to the older selection-based copy
      // instead of the button just silently doing nothing.
    }
    try {
      const textarea = document.createElement('textarea')
      textarea.value = final_output
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.focus()
      textarea.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(textarea)
      if (ok) {
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
        return
      }
    } catch {
      // fall through to failure state below
    }
    setCopyFailed(true)
    setTimeout(() => setCopyFailed(false), 2500)
  }

  const handleDownload = () => {
    const blob = new Blob([final_output], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${slugify(headline)}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleDownloadPdf = async () => {
    setGeneratingPdf(true)
    setPdfFailed(false)
    try {
      await downloadArticlePdf(final_output, `${slugify(headline)}.pdf`)
    } catch (e) {
      console.error(e)
      setPdfFailed(true)
      setTimeout(() => setPdfFailed(false), 2500)
    } finally {
      setGeneratingPdf(false)
    }
  }

  return (
    <div className="min-h-screen bg-beige-50 font-dm flex flex-col">

      <nav className="border-b border-beige-300 px-4 sm:px-8 h-14 flex items-center justify-between flex-shrink-0 gap-2">
        <span className="font-playfair text-lg text-beige-900 flex-shrink-0">
          agent<em className="text-beige-500">studio</em>
        </span>
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <span className="text-xs font-mono text-beige-500 truncate hidden sm:inline" title={displayTopic}>
            {displayTopic}
          </span>
          <Link
            to="/"
            className="text-xs px-4 py-1.5 rounded-full border border-beige-300 text-beige-700 hover:border-beige-500 transition-colors flex-shrink-0"
          >
            New research
          </Link>
        </div>
      </nav>

      <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">

        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <div className="flex-1 overflow-y-auto px-5 sm:px-14 py-6 sm:py-10">
            <div className="flex items-center justify-between mb-5 gap-3">
              <p className="text-xs font-mono text-beige-500 tracking-widest uppercase">
                Final article
              </p>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={handleCopy}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    copyFailed
                      ? 'border-red-300 text-red-600'
                      : 'border-beige-300 text-beige-700 hover:border-beige-500'
                  }`}
                >
                  {copyFailed ? 'Copy failed' : copied ? 'Copied' : 'Copy'}
                </button>
                <button
                  onClick={handleDownload}
                  className="text-xs px-3 py-1.5 rounded-full border border-beige-300 text-beige-700 hover:border-beige-500 transition-colors"
                >
                  Download .md
                </button>
                <button
                  onClick={handleDownloadPdf}
                  disabled={generatingPdf}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors disabled:opacity-60 ${
                    pdfFailed
                      ? 'border-red-300 text-red-600'
                      : 'border-beige-300 text-beige-700 hover:border-beige-500'
                  }`}
                >
                  {pdfFailed ? 'PDF failed' : generatingPdf ? 'Generating...' : 'Download .pdf'}
                </button>
              </div>
            </div>
            <Article
              text={final_output}
              headlineClassName="font-playfair text-2xl sm:text-3xl text-beige-900 font-normal leading-tight mb-8 max-w-xl"
            />

            {fact_check && (
              <div className="max-w-2xl mb-10">
                <p className="text-xs font-mono text-beige-500 tracking-widest uppercase mb-3">Fact check</p>
                <div className="bg-white border border-beige-300 rounded-xl p-4">
                  <Markdown text={fact_check} />
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-beige-300 px-5 sm:px-14 py-4 flex items-center gap-2 flex-wrap flex-shrink-0">
            {wordCount > 0 && <span className="text-xs font-mono bg-beige-200 text-beige-600 px-3 py-1 rounded-full">{wordCount} words</span>}
            {sources.length > 0 && <span className="text-xs font-mono bg-beige-200 text-beige-600 px-3 py-1 rounded-full">{sources.length} sources</span>}
            {tokens_used > 0 && <span className="text-xs font-mono bg-beige-200 text-beige-600 px-3 py-1 rounded-full">{tokens_used.toLocaleString()} tokens</span>}
          </div>
        </div>

        <div className="w-full lg:w-60 border-t lg:border-t-0 lg:border-l border-beige-300 flex flex-col overflow-y-auto flex-shrink-0">

          <div className="p-5 border-b border-beige-300">
            <p className="text-xs font-mono text-beige-500 tracking-widest uppercase mb-4">Final score</p>
            <div className="flex items-baseline justify-between mb-2">
              <span className="font-playfair text-4xl text-beige-900">{score}</span>
              <span className="text-xs font-mono text-beige-400">/10</span>
            </div>
            <div className="h-0.5 bg-beige-300 rounded">
              <div
                className={`h-0.5 rounded ${score >= 7 ? 'bg-emerald-400' : 'bg-amber-400'}`}
                style={{ width: `${score * 10}%` }}
              ></div>
            </div>
          </div>

          {bias_report && (
            <div className="p-5 border-b border-beige-300">
              <p className="text-xs font-mono text-beige-500 tracking-widest uppercase mb-3">Bias check</p>
              <Markdown text={bias_report} />
            </div>
          )}

          {sources.length > 0 && (
            <div className="p-5">
              <p className="text-xs font-mono text-beige-500 tracking-widest uppercase mb-3">Sources</p>
              <div className="flex flex-col gap-3">
                {sources.map((src, i) => (
                  <div key={i} className="flex gap-2">
                    <div className="w-1 h-1 rounded-full bg-beige-400 mt-1.5 flex-shrink-0"></div>
                    <div className="text-xs leading-relaxed">
                      <p className="text-beige-800">{src.title}</p>
                      <p className="text-beige-500">{src.publisher} · {src.type}</p>
                      {src.url && src.url !== 'N/A' && (
                        <a href={src.url} target="_blank" rel="noreferrer" className="text-beige-600 underline break-all">
                          {src.url}
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
