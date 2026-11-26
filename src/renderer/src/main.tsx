import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { RootErrorBoundary } from './components/RootErrorBoundary'
import '@fontsource/nunito/400.css'
import '@fontsource/nunito/600.css'
import '@fontsource/nunito/700.css'
import '@fontsource/nunito/800.css'
import './styles.css'
// Keyframes for the expressive title-bar avatar; honours prefers-reduced-motion.
import 'blobatar/motion.css'
import '@xterm/xterm/css/xterm.css'

// Screenshot automation: only when main enabled screenshot mode, which needs
// `--shot` on an unpackaged build. Attaches the store bridge the harness drives.
if (window.api?.shotMode) {
  void import('./lib/shotBridge').then((m) => m.installShotBridge())
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </React.StrictMode>
)
