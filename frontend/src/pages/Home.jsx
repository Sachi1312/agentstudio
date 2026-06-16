import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'

export default function Home() {
  const [topic, setTopic] = useState('')
  const [language, setLanguage] = useState('English')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleStart = async () => {
    if (!topic.trim()) return
    setLoading(true)
    try {
      const res = await axios.post('http://localhost:8000/start', {
        topic,
        language
      })
      navigate(`/run/${res.data.thread_id}`)
    } catch (err) {
      console.error(err)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-beige-50 font-dm">

      {/* Nav */}
      <nav className="border-b border-beige-300 px-8 h-14 flex items-center justify-between">
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
      <div className="border-b border-beige-300 px-12 py-12">
        <p className="text-xs font-mono text-beige-500 tracking-widest uppercase mb-4">
          Multi-agent research system
        </p>
        <h1 className="font-playfair text-4xl text-beige-900 font-normal leading-tight mb-8 max-w-xl">
          What do you want to <em className="text-beige-600">research</em> today?
        </h1>
        <div className="flex gap-3 max-w-2xl">
          <input
            type="text"
            value={topic}
            onChange={e => setTopic(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleStart()}
            placeholder="e.g. Impact of AI on jobs, Climate policy in 2025..."
            className="flex-1 bg-beige-50 border border-beige-400 rounded-xl px-4 py-3 text-sm text-beige-900 outline-none focus:border-beige-600 placeholder:text-beige-500"
          />
          <select
            value={language}
            onChange={e => setLanguage(e.target.value)}
            className="bg-beige-50 border border-beige-400 rounded-xl px-4 py-3 text-sm text-beige-800 outline-none"
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
            className="bg-beige-900 text-beige-50 text-sm px-6 py-3 rounded-xl hover:bg-beige-800 transition-colors disabled:opacity-50"
          >
            {loading ? 'Starting...' : 'Start research'}
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-3 divide-x divide-beige-300">

        {/* Recent runs */}
        <div className="p-8">
          <p className="text-xs font-mono text-beige-500 tracking-widest uppercase mb-5">Recent runs</p>
          <div className="flex flex-col gap-3">
            {[
              { title: 'Impact of AI on jobs', meta: 'today · 8/10 · 4 sources' },
              { title: 'Climate change 2025', meta: 'yesterday · 9/10 · 6 sources' },
              { title: 'Remote work trends', meta: '2 days ago · 7/10 · 3 sources' },
            ].map((item, i) => (
              <div key={i} className="border border-beige-300 rounded-xl p-4 bg-beige-50 cursor-pointer hover:border-beige-500 transition-colors">
                <p className="text-sm text-beige-900 mb-1">{item.title}</p>
                <p className="text-xs font-mono text-beige-500">{item.meta}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 mt-6">
            <div className="bg-beige-200 rounded-xl p-4">
              <p className="font-playfair text-2xl text-beige-900">12</p>
              <p className="text-xs font-mono text-beige-600 mt-1">total runs</p>
            </div>
            <div className="bg-beige-200 rounded-xl p-4">
              <p className="font-playfair text-2xl text-beige-900">8.1</p>
              <p className="text-xs font-mono text-beige-600 mt-1">avg score</p>
            </div>
          </div>
        </div>

        {/* Agents */}
        <div className="p-8">
          <p className="text-xs font-mono text-beige-500 tracking-widest uppercase mb-5">Your agents</p>
          <div className="flex flex-col gap-2">
            {[
              { name: 'Researcher', desc: 'DuckDuckGo search', color: 'bg-emerald-50 text-emerald-700', icon: '🔍' },
              { name: 'Summarizer', desc: 'condenses raw data', color: 'bg-blue-50 text-blue-700', icon: '📄' },
              { name: 'Writer', desc: 'drafts the article', color: 'bg-amber-50 text-amber-700', icon: '✍️' },
              { name: 'Critic', desc: 'scores + feedback', color: 'bg-purple-50 text-purple-700', icon: '⭐' },
              { name: 'Fact checker', desc: 'Wikipedia verify', color: 'bg-emerald-50 text-emerald-700', icon: '✅' },
              { name: 'Bias detector', desc: 'flags one-sidedness', color: 'bg-red-50 text-red-700', icon: '👁️' },
              { name: 'Citation builder', desc: 'formats sources', color: 'bg-beige-200 text-beige-700', icon: '📚' },
              { name: 'Translator', desc: 'multilingual output', color: 'bg-pink-50 text-pink-700', icon: '🌐' },
            ].map((agent, i) => (
              <div key={i} className="flex items-center gap-3 px-2 py-2 rounded-xl">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm ${agent.color}`}>
                  {agent.icon}
                </div>
                <div>
                  <p className="text-xs text-beige-800">{agent.name}</p>
                  <p className="text-xs font-mono text-beige-500">{agent.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* How it works */}
        <div className="p-8">
          <p className="text-xs font-mono text-beige-500 tracking-widest uppercase mb-5">How it works</p>
          <div className="flex flex-col gap-5">
            {[
              { n: '01', title: 'Enter your topic', desc: 'anything you want researched' },
              { n: '02', title: 'Agents run in sequence', desc: 'research → summarize → write → verify' },
              { n: '03', title: 'Review the draft', desc: 'approve or reject with feedback' },
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