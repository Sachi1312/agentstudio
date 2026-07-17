// Hardcoding "http://localhost:8000" broke as soon as someone opened the
// app via http://127.0.0.1:8000 instead — browsers treat localhost and
// 127.0.0.1 as different origins, so requests became cross-origin, tripped
// a CORS preflight, and got rejected because only localhost:5173 was ever
// allowed. Deriving the backend origin from whatever hostname is actually
// in the address bar keeps API calls same-origin (in the one-command
// build, where the backend serves the frontend itself) or at least
// consistent with it (in Vite dev mode, where the backend is a separate
// process on port 8000).
const isViteDevServer = window.location.port === '5173'

export const API_BASE = isViteDevServer
  ? `${window.location.protocol}//${window.location.hostname}:8000`
  : ''

export const WS_BASE = isViteDevServer
  ? `ws://${window.location.hostname}:8000`
  : `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`
