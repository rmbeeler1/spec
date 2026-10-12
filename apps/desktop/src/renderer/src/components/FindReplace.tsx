import { useState } from 'react'

interface Props {
  onFindNext(query: string): number // returns match count
  onReplace(query: string, replacement: string): void
  onReplaceAll(query: string, replacement: string): number
  onClose(): void
}

export function FindReplace({ onFindNext, onReplace, onReplaceAll, onClose }: Props): React.JSX.Element {
  const [query, setQuery] = useState('')
  const [replacement, setReplacement] = useState('')
  const [status, setStatus] = useState('')

  return (
    <div className="find-bar" role="search">
      <input
        autoFocus
        placeholder="Find"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') setStatus(`${onFindNext(query)} found`)
          if (e.key === 'Escape') onClose()
        }}
      />
      <input
        placeholder="Replace with"
        value={replacement}
        onChange={(e) => setReplacement(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose()
        }}
      />
      <button onClick={() => setStatus(`${onFindNext(query)} found`)}>Find</button>
      <button onClick={() => onReplace(query, replacement)}>Replace</button>
      <button
        onClick={() => {
          const n = onReplaceAll(query, replacement)
          setStatus(`Replaced ${n}`)
        }}
      >
        Replace All
      </button>
      <span className="find-status">{status}</span>
      <button className="close" aria-label="Close find" onClick={onClose}>
        ✕
      </button>
    </div>
  )
}
