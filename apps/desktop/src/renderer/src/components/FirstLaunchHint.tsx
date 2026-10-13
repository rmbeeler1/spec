import logo from '@branding/spec-logo-web.png'

interface Props {
  modKey: string
  onShowShortcuts(): void
  onDismiss(): void
}

export function FirstLaunchHint({ modKey, onShowShortcuts, onDismiss }: Props): React.JSX.Element {
  return (
    <div className="first-hint" role="note">
      <img className="hint-logo" src={logo} alt="Spec: screenwriting software" />
      <strong>Welcome to Spec.</strong>
      <p>
        Just start typing. A line beginning with <code>int.</code> or <code>ext.</code> becomes a
        scene heading, Enter moves to the next element, Tab changes what a line is, and the toolbar
        above the page does the same with a click.
      </p>
      <p>
        Your script lives in a plain Fountain file and is autosaved with snapshots once you save it
        the first time ({modKey}S).
      </p>
      <div className="hint-buttons">
        <button onClick={onShowShortcuts}>Show all shortcuts</button>
        <button className="primary" onClick={onDismiss}>
          Got it
        </button>
      </div>
    </div>
  )
}
