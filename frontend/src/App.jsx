import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Run from './pages/Run'
import Output from './pages/Output'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/run/:threadId" element={<Run />} />
        <Route path="/output/:threadId" element={<Output />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App