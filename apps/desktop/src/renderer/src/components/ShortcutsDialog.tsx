interface Props {
  modKey: string
  onClose(): void
}

export function ShortcutsDialog({ modKey, onClose }: Props): React.JSX.Element {
  const rows: Array<[string, string]> = [
    ['Enter', 'Finish this element and start the natural next one (Character then Dialogue, Dialogue then Character…)'],
    ['Tab / Shift+Tab', 'Cycle the current line through the element types'],
    [`${modKey}1 … ${modKey}6`, 'Set the element type directly: Scene, Action, Character, Dialogue, Parenthetical, Transition'],
    ['Shift+Enter', 'Line break inside the same element'],
    [`${modKey}S`, 'Save (autosave runs continuously once a file exists)'],
    [`${modKey}F`, 'Find and replace'],
    [`${modKey}E`, 'Export PDF'],
    [`${modKey}Shift+D`, 'Toggle dark mode'],
    [`${modKey}Shift+F`, 'Toggle focus mode (dims everything but the current line)'],
    [`${modKey}Shift+T`, 'Show or hide structure lines (# sections and = synopses)'],
    ...(window.spec.platform === 'darwin'
      ? ([
          ['⌘⌃1 … ⌘⌃6', 'Switch view: Write, Corkboard, Pacing, Beat Board, Outline, Reports'],
          ['⌘⌃7', 'Show or hide the stash']
        ] as Array<[string, string]>)
      : ([
          ['Ctrl+Shift+1 … 6', 'Switch view: Write, Corkboard, Pacing, Beat Board, Outline, Reports'],
          ['Ctrl+Shift+7', 'Show or hide the stash']
        ] as Array<[string, string]>)),
    [`${modKey}Shift+X`, 'Send the selected lines to the stash'],
    [`${modKey}Shift+B`, 'Pair the speech at the cursor with the one before it (dual dialogue)'],
    [`${modKey}Z / ${modKey}Shift+Z`, 'Undo / redo']
  ]
  const tips = [
    'Type "int." or "ext." at the start of a line and it becomes a scene heading on Enter, with the period added for you.',
    'A short ALL CAPS line becomes a character cue on Enter; caps ending in TO: becomes a transition.',
    "When the same character speaks again after action, (CONT'D) is added automatically.",
    'Inline Fountain markup is shown as you type it: *italics*, **bold**, _underline_, [[notes]]. PDF export renders it.'
  ]
  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog dialog-wide" onClick={(e) => e.stopPropagation()}>
        <h2>Keyboard Shortcuts</h2>
        <table className="shortcut-table">
          <tbody>
            {rows.map(([key, what]) => (
              <tr key={key}>
                <td className="key">{key}</td>
                <td>{what}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <h2>Good to know</h2>
        <ul className="tips">
          {tips.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
        <div className="dialog-buttons">
          <button className="primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
