import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowseAiCore } from 'browse-ai-core/react'

const config = { palette: 'forest' as const, features: { bookmarks: false } }

function App() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <h1>My app</h1>
      <button onClick={() => setOpen(true)}>Ask AI</button>

      <BrowseAiCore
        config={config}
        theme="system"
        open={open}
        onOpenChange={setOpen}
        onResponseReceived={(event) => console.log('Answer:', event.text)}
      >
        <p slot="empty-state">Ask me about this page.</p>
      </BrowseAiCore>
    </>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
