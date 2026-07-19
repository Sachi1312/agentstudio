import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import axios from 'axios'
import { Article } from '../lib/Article'
import { API_BASE, WS_BASE } from '../lib/api'

const AGENTS = [
  'researcher', 'summarizer', 'writer',
  'critic', 'fact_checker', 'bias_detector',
  'citation_builder', 'translator'
]

const AGENT_LABELS = {
  researcher: 'researcher',
  summarizer: 'summarizer',
  writer: 'writer',
  critic: 'critic',
  fact_checker: 'fact check',
  bias_detector: 'bias',
  citation_builder: 'citations',
  translator: 'translator'
}

export default function Run() {
  const { threadId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const wsRef = useRef(null)
  // thread_id is capped at 20 characters (it's also the routing key), so it
  // can't be relied on to show the real topic for anything longer than
  // that — display the full topic passed from Home, falling back to the
  // deslugified (truncated) thread_id only if this page was reached
  // without that navigation state (e.g. a direct link or a refresh).
  const displayTopic = location.state?.topic || threadId.replace(/_/g, ' ')

  const [currentAgent, setCurrentAgent] = useState('researcher')
  const [doneAgents, setDoneAgents] = useState([])
  const [draft, setDraft] = useState('')
  const [streamingDraft, setStreamingDraft] = useState('')
  const [score, setScore] = useState(null)
  const [critique, setCritique] = useState('')
  const [revisionCount, setRevisionCount] = useState(0)
  const [biasReport, setBiasReport] = useState('')
  const [sources, setSources] = useState([])
  const [humanReview, setHumanReview] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [editedDraft, setEditedDraft] = useState('')

  // While human review is open, editedDraft (seeded from draft, updated as
  // the user types) is the source of truth — rendering `draft` instead here
  // made the Preview toggle show the original text, so edits looked like
  // they'd been discarded even though they were still held in state and
  // would be sent on Approve.
  const displayText = humanReview ? editedDraft : (streamingDraft || draft)
  const wordCount = displayText ? displayText.split(/\s+/).filter(Boolean).length : 0

  useEffect(() => {
    const ws = new WebSocket(`${WS_BASE}/ws/${threadId}`)
    wsRef.current = ws

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)

      if (data.event === 'writer_token') {
        setStreamingDraft(prev => prev + data.text)
      }

      if (data.event === 'agent_done') {
        setDoneAgents(prev => [...prev, data.agent])
        setCurrentAgent(data.agent)

        if (data.agent === 'writer' && data.data?.draft) {
          setDraft(data.data.draft)
          setStreamingDraft('')
          setRevisionCount(prev => prev + 1)
        }

        if (data.agent === 'critic' && data.data?.score !== undefined && data.data?.score !== null) {
          setScore(data.data.score)
          setCritique(data.data.critique)
        }

        if (data.agent === 'bias_detector' && data.data?.bias_report) {
          setBiasReport(data.data.bias_report)
        }

        if (data.agent === 'citation_builder' && data.data?.citations) {
          // search_results (researcher's output) is LLM prose, not raw hits,
          // so it rarely contains literal "URL:" lines. citations is
          // generated in a fixed "URL: ..." per-source format instead.
          const lines = data.data.citations.split('\n')
          const urls = lines
            .filter(l => l.startsWith('URL:'))
            .map(l => l.replace('URL:', '').trim())
          setSources(urls)
        }
      }

      if (data.event === 'human_review') {
        setDraft(data.draft)
        setEditedDraft(data.draft)
        setIsEditing(false)
        setHumanReview(true)
        setCurrentAgent('waiting')
      }

      if (data.event === 'error') {
        setError(data.message || 'Something went wrong while running the agents.')
      }

      if (data.event === 'completed') {
        navigate(`/output/${threadId}`, {
          state: {
            topic: data.topic || displayTopic,
            final_output: data.final_output,
            citations: data.citations,
            bias_report: data.bias_report,
            fact_check: data.fact_check,
            score: data.score,
            tokens_used: data.tokens_used,
            cost_usd: data.cost_usd
          }
        })
      }
    }

    return () => ws.close()
  }, [threadId])

  const handleApprove = async () => {
    setHumanReview(false)
    setIsEditing(false)
    setCurrentAgent('critic')
    // editedDraft defaults to the untouched draft if the user never opened
    // the editor, so it's always safe to send.
    await axios.post(`${API_BASE}/approve`, {
      thread_id: threadId,
      draft: editedDraft
    })
  }

  const handleReject = async () => {
    if (!feedback.trim()) return
    setHumanReview(false)
    setIsEditing(false)
    setCurrentAgent('writer')
    setDoneAgents(prev => prev.filter(a => a !== 'writer' && a !== 'critic'))
    await axios.post(`${API_BASE}/reject`, {
      thread_id: threadId,
      feedback
    })
    setFeedback('')
  }

  const getAgentStatus = (agent) => {
    if (doneAgents.includes(agent)) return 'done'
    if (currentAgent === agent) return 'now'
    return 'idle'
  }

  return (
    <div className="min-h-screen bg-beige-50 font-dm flex flex-col">

      {/* Nav */}
      <nav className="border-b border-beige-300 px-4 sm:px-8 h-14 flex items-center justify-between flex-shrink-0 gap-2">
        <span className="font-playfair text-lg text-beige-900 flex-shrink-0">
          agent<em className="text-beige-500">studio</em>
        </span>
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-mono text-beige-500 truncate hidden sm:inline" title={displayTopic}>
            {displayTopic}
          </span>
        </div>
        {humanReview && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-full px-3 py-1 flex-shrink-0">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-400"></div>
            <span className="text-xs font-mono text-amber-700 hidden sm:inline">awaiting review</span>
          </div>
        )}
      </nav>

      {/* Agent bar */}
      <div className="border-b border-beige-300 px-4 sm:px-8 h-14 flex items-center gap-0 flex-shrink-0 overflow-x-auto">
        {AGENTS.map((agent, i) => {
          const status = getAgentStatus(agent)
          return (
            <div key={agent} className="flex items-center flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs transition-all flex-shrink-0
                  ${status === 'done' ? 'bg-emerald-50 text-emerald-700' : ''}
                  ${status === 'now' ? 'bg-amber-50 text-amber-700 ring-2 ring-amber-300 ring-offset-1' : ''}
                  ${status === 'idle' ? 'bg-beige-200 text-beige-400' : ''}
                `}>
                  {status === 'done' ? '✓' : i + 1}
                </div>
                <span className={`text-xs font-mono hidden md:inline
                  ${status === 'done' ? 'text-beige-500' : ''}
                  ${status === 'now' ? 'text-amber-700' : ''}
                  ${status === 'idle' ? 'text-beige-300' : ''}
                `}>
                  {AGENT_LABELS[agent]}
                </span>
              </div>
              {i < AGENTS.length - 1 && (
                <div className={`w-4 sm:w-6 h-px mx-2 flex-shrink-0 ${doneAgents.includes(agent) ? 'bg-emerald-300' : 'bg-beige-300'}`}></div>
              )}
            </div>
          )
        })}
      </div>

      {/* Body */}
      <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">

        {/* Article */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <div className="flex-1 overflow-y-auto px-5 sm:px-14 py-6 sm:py-10">
            <div className="flex items-center justify-between mb-5">
              <p className="text-xs font-mono text-beige-500 tracking-widest uppercase">
                Live output — writer agent
              </p>
              {humanReview && displayText && (
                <button
                  onClick={() => setIsEditing(v => !v)}
                  className="text-xs px-3 py-1 rounded-full border border-beige-300 text-beige-700 hover:border-beige-500 transition-colors flex-shrink-0"
                >
                  {isEditing ? 'Preview' : 'Edit draft'}
                </button>
              )}
            </div>
            {error ? (
              <div className="flex flex-col items-start gap-3 text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3 max-w-xl">
                <span className="text-sm font-mono">Run failed: {error}</span>
                <button
                  onClick={() => navigate('/')}
                  className="text-xs px-4 py-2 rounded-full bg-beige-900 text-beige-50 hover:bg-beige-800 transition-colors"
                >
                  Start a new run
                </button>
              </div>
            ) : isEditing ? (
              <textarea
                value={editedDraft}
                onChange={e => setEditedDraft(e.target.value)}
                className="w-full h-[60vh] text-sm text-beige-800 leading-relaxed bg-white border border-beige-300 rounded-xl p-4 outline-none focus:border-beige-500 resize-none font-dm"
              />
            ) : displayText ? (
              <Article
                text={displayText}
                headlineClassName="font-playfair text-2xl sm:text-3xl text-beige-900 font-normal leading-tight mb-8 max-w-xl"
              />
            ) : (
              <div className="flex items-center gap-3 text-beige-400">
                <div className="w-2 h-2 rounded-full bg-amber-300 animate-pulse"></div>
                <span className="text-sm font-mono">agents working...</span>
              </div>
            )}
          </div>

          {/* Bottom bar */}
          <div className="border-t border-beige-300 px-5 sm:px-14 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 flex-shrink-0">
            <div className="flex items-center gap-2 flex-wrap">
              {wordCount > 0 && <span className="text-xs font-mono bg-beige-200 text-beige-600 px-3 py-1 rounded-full">{wordCount} words</span>}
              {sources.length > 0 && <span className="text-xs font-mono bg-beige-200 text-beige-600 px-3 py-1 rounded-full">{sources.length} sources</span>}
              {revisionCount > 0 && <span className="text-xs font-mono bg-beige-200 text-beige-600 px-3 py-1 rounded-full">pass {revisionCount}</span>}
            </div>
            {humanReview && (
              <div className="flex items-center gap-3">
                <span className="text-xs text-beige-500 hidden sm:inline">your review is needed</span>
                <button
                  onClick={handleReject}
                  className="text-xs px-4 py-2 rounded-full border border-beige-300 text-beige-700 hover:border-beige-500 transition-colors"
                >
                  Reject
                </button>
                <button
                  onClick={handleApprove}
                  className="text-xs px-5 py-2 rounded-full bg-beige-900 text-beige-50 hover:bg-beige-800 transition-colors"
                >
                  Approve
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right panel */}
        <div className="w-full lg:w-60 border-t lg:border-t-0 lg:border-l border-beige-300 flex flex-col overflow-y-auto flex-shrink-0">

          {/* Score */}
          {score !== null && (
            <div className="p-5 border-b border-beige-300">
              <p className="text-xs font-mono text-beige-500 tracking-widest uppercase mb-4">Critic score</p>
              <div className="flex items-baseline justify-between mb-2">
                <span className="font-playfair text-4xl text-beige-900">{score}</span>
                <span className="text-xs font-mono text-beige-400">/10</span>
              </div>
              <div className="h-0.5 bg-beige-300 rounded mb-3">
                <div
                  className={`h-0.5 rounded transition-all ${score >= 7 ? 'bg-emerald-400' : 'bg-amber-400'}`}
                  style={{ width: `${score * 10}%` }}
                ></div>
              </div>
              {critique && <p className="text-xs text-beige-500 leading-relaxed">{critique}</p>}
            </div>
          )}

          {/* Bias */}
          {biasReport && (
            <div className="p-5 border-b border-beige-300">
              <p className="text-xs font-mono text-beige-500 tracking-widest uppercase mb-3">Bias check</p>
              <div className="flex flex-wrap gap-1.5">
                {biasReport.split('\n').filter(l => l.trim()).slice(0, 4).map((line, i) => (
                  <span key={i} className={`text-xs font-mono px-2 py-1 rounded-full
                    ${line.toLowerCase().includes('unbiased') || line.toLowerCase().includes('balanced')
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-amber-50 text-amber-700'}`}>
                    {line.replace(/^[A-Z]+:\s*/, '').slice(0, 20)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Sources */}
          {sources.length > 0 && (
            <div className="p-5 border-b border-beige-300">
              <p className="text-xs font-mono text-beige-500 tracking-widest uppercase mb-3">Sources</p>
              <div className="flex flex-col gap-2">
                {sources.slice(0, 3).map((src, i) => (
                  <div key={i} className="flex gap-2">
                    <div className="w-1 h-1 rounded-full bg-beige-400 mt-1.5 flex-shrink-0"></div>
                    <p className="text-xs text-beige-600 break-all leading-relaxed">{src}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Feedback box */}
          {humanReview && (
            <div className="p-5 lg:mt-auto">
              <p className="text-xs font-mono text-beige-500 tracking-widest uppercase mb-3">Reject with feedback</p>
              <div className="border border-beige-300 rounded-xl p-3 bg-white">
                <textarea
                  value={feedback}
                  onChange={e => setFeedback(e.target.value)}
                  placeholder="e.g. make it simpler..."
                  rows={3}
                  className="w-full text-xs font-dm bg-transparent border-none outline-none text-beige-800 resize-none leading-relaxed placeholder:text-beige-400"
                />
                <div className="flex justify-end pt-2 border-t border-beige-200">
                  <button
                    onClick={handleReject}
                    className="text-xs bg-beige-900 text-beige-50 px-3 py-1.5 rounded-full"
                  >
                    Send
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
