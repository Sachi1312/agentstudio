import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import axios from 'axios'
import { API_BASE } from '../lib/api'

function relativeDay(iso) {
  const diffDays = Math.floor((new Date() - new Date(iso)) / 86400000)
  if (diffDays <= 0) return 'today'
  if (diffDays === 1) return 'yesterday'
  return `${diffDays} days ago`
}

export default function Home() {
  const [topic, setTopic] = useState('')
  const [language, setLanguage] = useState('English')
  const [loading, setLoading] = useState(false)
  const [runs, setRuns] = useState([])
  const [error, setError] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    loadRuns()
  }, [])

  const loadRuns = () => {
    axios.get(`${API_BASE}/runs`)
      .then(res => setRuns(res.data))
      .catch(() => setRuns([]))
  }

  const totalRuns = runs.length
  const scored = runs.filter(r => r.score !== null && r.score !== undefined)
  const avgScore = scored.length
    ? (scored.reduce((sum, r) => sum + r.score, 0) / scored.length).toFixed(1)
    : '—'

  const handleStart = async () => {
    if (!topic.trim()) return
    setLoading(true)
    setError('')
    try {
      const res = await axios.post(`${API_BASE}/start`, {
        topic,
        language
      })
      navigate(`/run/${res.data.thread_id}`, { state: { topic: res.data.topic } })
    } catch (err) {
      console.error(err)
      if (err.code === 'ERR_NETWORK') {
        setError("Can't reach the backend — make sure it's running.")
      } else if (err.response?.status === 429) {
        setError(err.response.data?.detail || 'Too many runs in progress. Try again shortly.')
      } else {
        setError('Failed to start research. Please try again.')
      }
      setLoading(false)
    }
  }

  const handleDelete = async (e, threadId) => {
    e.preventDefault()
    e.stopPropagation()
    setRuns(prev => prev.filter(r => r.thread_id !== threadId))
    try {
      await axios.delete(`${API_BASE}/runs/${threadId}`)
    } catch {
      loadRuns()
    }
  }

  return (
    <div className="min-h-screen bg-beige-50 font-dm">

      {/* Nav */}
      <nav className="border-b border-beige-300 px-4 sm:px-8 h-14 flex items-center justify-between">
        <span className="font-playfair text-lg text-beige-900">
          agent<em className="text-beige-500">studio</em>
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-beige-500 bg-beige-200 px-3 py-1 rounded-full">
            v1.0
          </span>
        </div>
      </nav>

      {/* Hero */}
      <div className="border-b border-beige-300 px-4 sm:px-12 py-8 sm:py-12">
        <p className="text-xs font-mono text-beige-500 tracking-widest uppercase mb-4">
          Multi-agent research system
        </p>
        <h1 className="font-playfair text-3xl sm:text-4xl text-beige-900 font-normal leading-tight mb-8 max-w-xl">
          What do you want to <em className="text-beige-600">research</em> today?
        </h1>
        <div className="flex flex-col sm:flex-row gap-3 max-w-2xl">
          <input
            type="text"
            value={topic}
            onChange={e => setTopic(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleStart()}
            placeholder="e.g. Impact of AI on jobs, Climate policy in 2025..."
            className="flex-1 bg-beige-50 border border-beige-400 rounded-xl px-4 py-3 text-sm text-beige-900 outline-none focus:border-beige-600 placeholder:text-beige-500"
          />
          <div className="flex gap-3">
            <select
              value={language}
              onChange={e => setLanguage(e.target.value)}
              className="flex-1 sm:flex-none bg-beige-50 border border-beige-400 rounded-xl px-4 py-3 text-sm text-beige-800 outline-none"
            >
              <option>English</option>
              <option>Hindi</option>
              <option>French</option>
              <option>Spanish</option>
              <option>Japanese</option>
            </select>
            <button
              onClick={handleStart}
              disabled={loading}
              className="bg-beige-900 text-beige-50 text-sm px-6 py-3 rounded-xl hover:bg-beige-800 transition-colors disabled:opacity-50 flex-shrink-0"
            >
              {loading ? 'Starting...' : 'Start research'}
            </button>
          </div>
        </div>
        {error && <p className="text-xs text-red-600 mt-3">{error}</p>}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-beige-300">

        {/* Recent runs */}
        <div className="p-4 sm:p-8">
          <p className="text-xs font-mono text-beige-500 tracking-widest uppercase mb-5">Recent runs</p>
          <div className="flex flex-col gap-3">
            {runs.length === 0 && (
              <p className="text-xs text-beige-500">No runs yet — start your first one above.</p>
            )}
            {runs.slice(0, 5).map((run) => (
              <Link
                key={run.thread_id}
                to={`/output/${run.thread_id}`}
                className="group relative border border-beige-300 rounded-xl p-4 bg-beige-50 cursor-pointer hover:border-beige-500 transition-colors"
              >
                <button
                  onClick={(e) => handleDelete(e, run.thread_id)}
                  aria-label="Delete run"
                  className="absolute top-3 right-3 w-5 h-5 rounded-full flex items-center justify-center text-beige-400 hover:bg-beige-200 hover:text-beige-700 opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                >
                  ✕
                </button>
                <p className="text-sm text-beige-900 mb-1 pr-6">{run.topic}</p>
                <p className="text-xs font-mono text-beige-500">
                  {relativeDay(run.created_at)} · {run.score}/10 · {run.sources_count} sources
                </p>
              </Link>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 mt-6">
            <div className="bg-beige-200 rounded-xl p-4">
              <p className="font-playfair text-2xl text-beige-900">{totalRuns}</p>
              <p className="text-xs font-mono text-beige-600 mt-1">total runs</p>
            </div>
            <div className="bg-beige-200 rounded-xl p-4">
              <p className="font-playfair text-2xl text-beige-900">{avgScore}</p>
              <p className="text-xs font-mono text-beige-600 mt-1">avg score</p>
            </div>
          </div>
        </div>

        {/* How it works */}
        <div className="p-4 sm:p-8">
          <p className="text-xs font-mono text-beige-500 tracking-widest uppercase mb-5">How it works</p>
          <div className="flex flex-col gap-5">
            {[
              { n: '01', title: 'Enter your topic', desc: 'anything you want researched' },
              { n: '02', title: 'Agents run in sequence', desc: 'research → summarize → write → verify' },
              { n: '03', title: 'Review the draft', desc: 'approve, edit, or reject with feedback' },
              { n: '04', title: 'Get final output', desc: 'cited, fact-checked, translated' },
            ].map((step, i) => (
              <div key={i} className="flex gap-4">
                <span className="font-mono text-xs text-beige-400 mt-0.5">{step.n}</span>
                <div>
                  <p className="text-sm text-beige-800 mb-0.5">{step.title}</p>
                  <p className="text-xs font-mono text-beige-500">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
