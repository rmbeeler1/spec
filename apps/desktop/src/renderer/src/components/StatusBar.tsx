import type { ElementType } from '@spec/core'

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
}

export function StatusBar({
  currentType,
  pageCount,
  sceneCount,
  filePath,
  saveState
}: Props): React.JSX.Element {
  const save =
    saveState === 'saved' ? 'Saved' : saveState === 'editing' ? 'Editing…' : 'Not saved to a file yet'
  return (
    <footer className="status-bar">
      <span className="status-type">{currentType ? TYPE_LABELS[currentType] : ''}</span>
      <span>
        {pageCount} {pageCount === 1 ? 'page' : 'pages'} · {sceneCount}{' '}
        {sceneCount === 1 ? 'scene' : 'scenes'}
      </span>
      <span className="status-file" title={filePath ?? undefined}>
        {filePath ?? 'Untitled'} — {save}
      </span>
    </footer>
  )
}
