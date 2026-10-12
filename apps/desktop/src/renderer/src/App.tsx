import { CORE_VERSION } from '@spec/core'

export default function App(): React.JSX.Element {
  return (
    <main className="splash">
      <h1>Spec</h1>
      <p>An open-source, offline-first screenwriting app.</p>
      <p className="meta">
        core v{CORE_VERSION} · {window.spec.platform}
      </p>
    </main>
  )
}
