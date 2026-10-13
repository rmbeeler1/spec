import type { ElementType, WritingGoal } from '@spec/core'

const TYPE_LABELS: Record<string, string> = {
  scene_heading: 'Scene Heading',
  action: 'Action',
  character: 'Character',
  dialogue: 'Dialogue',
  parenthetical: 'Parenthetical',
  transition: 'Transition',
  centered: 'Centered',
  lyric: 'Lyric',
  section: 'Section',
  synopsis: 'Synopsis',
  note: 'Note',
  boneyard: 'Boneyard',
  page_break: 'Page Break',
  shot: 'Shot'
}

interface Props {
  currentType: ElementType | null
  pageCount: number
  sceneCount: number
  filePath: string | null
  saveState: 'saved' | 'editing' | 'unsaved-no-file'
  /** Words and pages written today, for the goal readout. */
  today: { words: number; pages: number }
  goal: WritingGoal | undefined
  /** Active revision set, shown as a colored chip. */
  revision: { name: string; color: string } | null
  pagesLocked: boolean
}

export function StatusBar({
  currentType,
  pageCount,
  sceneCount,
  filePath,
  saveState,
  today,
  goal,
  revision,
  pagesLocked
}: Props): React.JSX.Element {
  const save =
    saveState === 'saved' ? 'Saved' : saveState === 'editing' ? 'Editing…' : 'Not saved to a file yet'
  const done = goal ? (goal.kind === 'words' ? today.words : today.pages) : 0
  const goalText = goal
    ? `${done} / ${goal.perDay} ${goal.kind} today${done >= goal.perDay ? ' ✓' : ''}`
    : today.words > 0
      ? `${today.words} words today`
      : null
  return (
    <footer className="status-bar">
      <span className="status-type">{currentType ? TYPE_LABELS[currentType] : ''}</span>
      <span>
        {pageCount} {pageCount === 1 ? 'page' : 'pages'}
        {pagesLocked ? ' (locked)' : ''} · {sceneCount}{' '}
        {sceneCount === 1 ? 'scene' : 'scenes'}
      </span>
      {revision && (
        <span className="status-revision" style={{ color: revision.color }}>
          * {revision.name}
        </span>
      )}
      {goalText && (
        <span className={`status-goal${goal && done >= goal.perDay ? ' met' : ''}`}>
          ✎ {goalText}
        </span>
      )}
      <span className="status-file" title={filePath ?? undefined}>
        {filePath ?? 'Untitled'} — {save}
      </span>
    </footer>
  )
}
