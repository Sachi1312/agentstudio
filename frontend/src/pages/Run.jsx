import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'

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
  const wsRef = useRef(null)

  const [currentAgent, setCurrentAgent] = useState('researcher')
  const [doneAgents, setDoneAgents] = useState([])
  const [draft, setDraft] = useState('')
  const [score, setScore] = useState(null)
  const [critique, setCritique] = useState('')
  const [revisionCount, setRevisionCount] = useState(0)
  const [biasReport, setBiasReport] = useState('')
  const [sources, setSources] = useState([])
  const [humanReview, setHumanReview] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [wordCount, setWordCount] = useState(0)

  useEffect(() => {
    const ws = new WebSocket(`ws://localhost:8000/ws/${threadId}`)
    wsRef.current = ws

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)

      if (data.event === 'agent_done') {
        setDoneAgents(prev => [...prev, data.agent])
        setCurrentAgent(data.agent)

        if (data.agent === 'writer' && data.data?.draft) {
          setDraft(data.data.draft)
          setWordCount(data.data.draft.split(' ').length)
          setRevisionCount(prev => prev + 1)
        }

        if (data.agent === 'critic' && data.data?.score) {
          setScore(data.data.score)
          setCritique(data.data.critique)
        }

        if (data.agent === 'bias_detector' && data.data?.bias_report) {
          setBiasReport(data.data.bias_report)
        }

        if (data.agent === 'researcher' && data.data?.search_results) {
          const lines = data.data.search_results.split('\n')
          const urls = lines
            .filter(l => l.startsWith('URL:'))
            .map(l => l.replace('URL:', '').trim())
          setSources(urls)
        }
      }

      if (data.event === 'human_review') {
        setDraft(data.draft)
        setWordCount(data.draft.split(' ').length)
        setHumanReview(true)
        setCurrentAgent('waiting')
      }

      if (data.event === 'completed') {
        navigate(`/output/${threadId}`, {
          state: {
            final_output: data.final_output,
            citations: data.citations,
            bias_report: data.bias_report,
            fact_check: data.fact_check,
            score: data.score
          }
        })
      }
    }

    return () => ws.close()
  }, [threadId])

  const handleApprove = async () => {
    setHumanReview(false)
    setCurrentAgent('critic')
    await axios.post(`http://localhost:8000/approve?thread_id=${threadId}`)
  }

  const handleReject = async () => {
    if (!feedback.trim()) return
    setHumanReview(false)
    setCurrentAgent('writer')
    setDoneAgents(prev => prev.filter(a => a !== 'writer' && a !== 'critic'))
    await axios.post('http://localhost:8000/reject', {
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
      <nav className="border-b border-beige-300 px-8 h-14 flex items-center justify-between flex-shrink-0">
        <span className="font-playfair text-lg text-beige-900">
          agent<em className="text-beige-500">studio</em>
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-beige-500">
            {threadId.replace(/_/g, ' ')}
          </span>
        </div>
        {humanReview && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-full px-3 py-1">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-400"></div>
            <span className="text-xs font-mono text-amber-700">awaiting review</span>
          </div>
        )}
      </nav>

      {/* Agent bar */}
      <div className="border-b border-beige-300 px-8 h-14 flex items-center gap-0 flex-shrink-0">
        {AGENTS.map((agent, i) => {
          const status = getAgentStatus(agent)
          return (
            <div key={agent} className="flex items-center">
              <div className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs transition-all
                  ${status === 'done' ? 'bg-emerald-50 text-emerald-700' : ''}
                  ${status === 'now' ? 'bg-amber-50 text-amber-700 ring-2 ring-amber-300 ring-offset-1' : ''}
                  ${status === 'idle' ? 'bg-beige-200 text-beige-400' : ''}
                `}>
                  {status === 'done' ? '✓' : i + 1}
                </div>
                <span className={`text-xs font-mono
                  ${status === 'done' ? 'text-beige-500' : ''}
                  ${status === 'now' ? 'text-amber-700' : ''}
                  ${status === 'idle' ? 'text-beige-300' : ''}
                `}>
                  {AGENT_LABELS[agent]}
                </span>
              </div>
              {i < AGENTS.length - 1 && (
                <div className={`w-6 h-px mx-2 ${doneAgents.includes(agent) ? 'bg-emerald-300' : 'bg-beige-300'}`}></div>
              )}
            </div>
          )
        })}
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">

        {/* Article */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-14 py-10">
            <p className="text-xs font-mono text-beige-500 tracking-widest uppercase mb-5">
              Live output — writer agent
            </p>
            {draft ? (
              <>
                <h1 className="font-playfair text-3xl text-beige-900 font-normal leading-tight mb-8 max-w-xl">
                  {draft.split('\n')[0].replace(/^#+\s*/, '')}
                </h1>
                <div className="w-full h-px bg-beige-300 mb-8"></div>
                <div className="text-sm text-beige-800 leading-relaxed max-w-2xl space-y-5">
                  {draft.split('\n').slice(1).filter(p => p.trim()).map((para, i) => (
                    <p key={i}>{para.replace(/^#+\s*/, '')}</p>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex items-center gap-3 text-beige-400">
                <div className="w-2 h-2 rounded-full bg-amber-300 animate-pulse"></div>
                <span className="text-sm font-mono">agents working...</span>
              </div>
            )}
          </div>

          {/* Bottom bar */}
          <div className="border-t border-beige-300 px-14 py-4 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              {wordCount > 0 && <span className="text-xs font-mono bg-beige-200 text-beige-600 px-3 py-1 rounded-full">{wordCount} words</span>}
              {sources.length > 0 && <span className="text-xs font-mono bg-beige-200 text-beige-600 px-3 py-1 rounded-full">{sources.length} sources</span>}
              {revisionCount > 0 && <span className="text-xs font-mono bg-beige-200 text-beige-600 px-3 py-1 rounded-full">pass {revisionCount}</span>}
            </div>
            {humanReview && (
              <div className="flex items-center gap-3">
                <span className="text-xs text-beige-500">your review is needed</span>
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
        <div className="w-60 border-l border-beige-300 flex flex-col overflow-y-auto">

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
            <div className="p-5 mt-auto">
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