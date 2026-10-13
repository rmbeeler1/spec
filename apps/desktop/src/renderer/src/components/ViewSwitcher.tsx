export type AppView = 'write' | 'corkboard' | 'pacing' | 'beatboard' | 'outline' | 'reports'

const VIEWS: Array<{ id: AppView; label: string }> = [
  { id: 'write', label: 'Write' },
  { id: 'corkboard', label: 'Corkboard' },
  { id: 'pacing', label: 'Pacing' },
  { id: 'beatboard', label: 'Beat Board' },
  { id: 'outline', label: 'Outline' },
  { id: 'reports', label: 'Reports' }
]

interface Props {
  view: AppView
  stashOpen: boolean
  stashCount: number
  onSetView(view: AppView): void
  onToggleStash(): void
}

export function ViewSwitcher({
  view,
  stashOpen,
  stashCount,
  onSetView,
  onToggleStash
}: Props): React.JSX.Element {
  // See docs/shortcut-audit.md: the digit family is Cmd+Ctrl on mac and
  // Ctrl+Shift elsewhere, keeping clear of Dock, screenshot and AltGr keys
  const numKey = (n: number): string =>
    window.spec.platform === 'darwin' ? `⌘⌃${n}` : `Ctrl+Shift+${n}`
  return (
    <div className="view-switcher" role="tablist" aria-label="View">
      {VIEWS.map((v, i) => (
        <button
          key={v.id}
          role="tab"
          aria-selected={view === v.id}
          className={view === v.id ? 'active' : ''}
          title={`${v.label} (${numKey(i + 1)})`}
          onClick={() => onSetView(v.id)}
        >
          {v.label}
        </button>
      ))}
      <button
        className={`stash-toggle${stashOpen ? ' active' : ''}`}
        title={`Show or hide the stash (${numKey(7)})`}
        onClick={onToggleStash}
      >
        Stash{stashCount > 0 ? ` (${stashCount})` : ''}
      </button>
    </div>
  )
}
