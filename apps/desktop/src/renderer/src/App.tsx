import { useCallback, useEffect, useRef, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import { UndoRedo } from '@tiptap/extensions'
import type { Editor } from '@tiptap/core'
import {
  exportPdf,
  paginate,
  parseFountain,
  serializeFountain,
  writeFdx,
  type ElementType,
  type TitlePageEntry
} from '@spec/core'
import type { MenuCommand } from '../../shared/ipc'
import {
  LineBreak,
  ScreenplayDocument,
  ScreenplayElement,
  ScreenplayText
} from './editor/schema'
import { ScreenplayKeymap } from './editor/keymap'
import { CurrentElement, PageBreaks, pageBreaksKey } from './editor/plugins'
import { computePageBreakMap } from './editor/pageMap'
import { scriptToDoc, docToScript, type PmDoc } from './editor/convert'
import { jumpToScene, listScenes, moveScene, type SceneInfo } from './editor/scenes'
import { findMatches, replaceAll, replaceSelection, selectNextMatch } from './editor/search'
import { pdfFonts } from './fonts'
import {
  TEMPLATE_BLANK,
  TEMPLATE_FEATURE,
  TEMPLATE_TV_HALF_HOUR,
  TEMPLATE_TV_HOUR
} from './templates'
import { SceneNavigator } from './components/SceneNavigator'
import { StatusBar } from './components/StatusBar'
import { FindReplace } from './components/FindReplace'
import { TitlePageDialog } from './components/TitlePageDialog'
import { SnapshotsDialog } from './components/SnapshotsDialog'
import { ElementToolbar } from './components/ElementToolbar'
import { ShortcutsDialog } from './components/ShortcutsDialog'
import { FirstLaunchHint } from './components/FirstLaunchHint'
import { ReviewPane } from './components/ReviewPane'
import { routeImport, type PendingImport } from './import/route'

type SaveState = 'saved' | 'editing' | 'unsaved-no-file'

const AUTOSAVE_DELAY_MS = 1500
const PAGINATE_DELAY_MS = 400

export default function App(): React.JSX.Element {
  const [filePath, setFilePath] = useState<string | null>(null)
  const [titlePage, setTitlePage] = useState<TitlePageEntry[]>([])
  const [saveState, setSaveState] = useState<SaveState>('unsaved-no-file')
  const [dark, setDark] = useState(() => localStorage.getItem('spec:dark') === '1')
  const [focusMode, setFocusMode] = useState(false)
  const [scenes, setScenes] = useState<SceneInfo[]>([])
  const [pageCount, setPageCount] = useState(1)
  const [currentType, setCurrentType] = useState<ElementType | null>('scene_heading')
  const [showFind, setShowFind] = useState(false)
  const [showTitlePage, setShowTitlePage] = useState(false)
  const [showSnapshots, setShowSnapshots] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [showHint, setShowHint] = useState(() => localStorage.getItem('spec:hint-seen') !== '1')
  const modKey = window.spec.platform === 'darwin' ? '⌘' : 'Ctrl+'

  const dismissHint = (): void => {
    localStorage.setItem('spec:hint-seen', '1')
    setShowHint(false)
  }

  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const paginateTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const editor = useEditor({
    extensions: [
      ScreenplayDocument,
      ScreenplayText,
      LineBreak,
      ScreenplayElement,
      ScreenplayKeymap,
      PageBreaks,
      CurrentElement,
      UndoRedo
    ],
    content: scriptToDoc(parseFountain(TEMPLATE_BLANK)),
    autofocus: 'end'
  })

  // Menu handlers read from here to avoid stale closures.
  const stateRef = useRef({ filePath, titlePage, editor })
  stateRef.current = { filePath, titlePage, editor }

  const currentScript = useCallback(() => {
    const { editor: ed, titlePage: tp } = stateRef.current
    if (!ed) return { titlePage: tp, elements: [] }
    return docToScript(ed.getJSON() as unknown as PmDoc, tp)
  }, [])

  const refreshDerived = useCallback((ed: Editor) => {
    setScenes(listScenes(ed))
    if (paginateTimer.current) clearTimeout(paginateTimer.current)
    paginateTimer.current = setTimeout(() => {
      const pages = paginate(currentScript())
      setPageCount(Math.max(1, pages.length))
      const breaks = computePageBreakMap(pages)
      ed.view.dispatch(ed.state.tr.setMeta(pageBreaksKey, { breaks }))
    }, PAGINATE_DELAY_MS)
  }, [currentScript])

  const doSave = useCallback(async (): Promise<void> => {
    const { filePath: path } = stateRef.current
    if (!path) return
    await window.spec.writeFile(path, serializeFountain(currentScript()))
    setSaveState('saved')
    window.spec.setDocumentState(path, false)
  }, [currentScript])

  const saveAs = useCallback(async (): Promise<void> => {
    const title = stateRef.current.titlePage.find((e) => e.key.toLowerCase() === 'title')
    const defaultName = `${title?.values[0] ?? 'Untitled'}.fountain`
    const path = await window.spec.saveFileAs(defaultName, 'Fountain', ['fountain'])
    if (!path) return
    setFilePath(path)
    stateRef.current.filePath = path
    await doSave()
  }, [doSave])

  const save = useCallback(async (): Promise<void> => {
    if (stateRef.current.filePath) await doSave()
    else await saveAs()
  }, [doSave, saveAs])

  const loadContent = useCallback(
    (content: string, path: string | null): void => {
      const ed = stateRef.current.editor
      if (!ed) return
      const script = parseFountain(content)
      setTitlePage(script.titlePage)
      stateRef.current.titlePage = script.titlePage
      ed.commands.setContent(scriptToDoc(script))
      setFilePath(path)
      stateRef.current.filePath = path
      setSaveState(path ? 'saved' : 'unsaved-no-file')
      window.spec.setDocumentState(path, false)
      refreshDerived(ed)
    },
    [refreshDerived]
  )

  const exportAs = useCallback(
    async (kind: 'pdf' | 'fdx' | 'fountain'): Promise<void> => {
      const script = currentScript()
      const title = script.titlePage.find((e) => e.key.toLowerCase() === 'title')
      const base = title?.values[0] ?? 'Untitled'
      if (kind === 'pdf') {
        const path = await window.spec.saveFileAs(`${base}.pdf`, 'PDF', ['pdf'])
        if (!path) return
        const bytes = await exportPdf(script, { fonts: pdfFonts() })
        await window.spec.writeBinaryFile(path, bytes)
      } else if (kind === 'fdx') {
        const path = await window.spec.saveFileAs(`${base}.fdx`, 'Final Draft', ['fdx'])
        if (!path) return
        await window.spec.writeBinaryFile(path, new TextEncoder().encode(writeFdx(script)))
      } else {
        const path = await window.spec.saveFileAs(`${base}.fountain`, 'Fountain', ['fountain'])
        if (!path) return
        await window.spec.writeBinaryFile(
          path,
          new TextEncoder().encode(serializeFountain(script))
        )
      }
    },
    [currentScript]
  )

  const handleImport = useCallback(
    async (path: string, data: Uint8Array): Promise<void> => {
      setImportError(null)
      try {
        const routed = await routeImport(path, data)
        if (routed.kind === 'direct') {
          loadContent(routed.content, path.toLowerCase().endsWith('.fountain') ? path : null)
        } else {
          setPendingImport(routed.pending)
        }
      } catch (err) {
        setImportError(err instanceof Error ? err.message : String(err))
      }
    },
    [loadContent]
  )

  // Dropping a script file anywhere on the window imports it.
  useEffect(() => {
    const onDrop = (e: DragEvent): void => {
      e.preventDefault()
      const file = e.dataTransfer?.files[0]
      if (!file) return
      void file.arrayBuffer().then((buf) => handleImport(file.name, new Uint8Array(buf)))
    }
    const onDragOver = (e: DragEvent): void => e.preventDefault()
    window.addEventListener('drop', onDrop)
    window.addEventListener('dragover', onDragOver)
    return () => {
      window.removeEventListener('drop', onDrop)
      window.removeEventListener('dragover', onDragOver)
    }
  }, [handleImport])

  // Editor change tracking: dirty state, autosave, derived data.
  useEffect(() => {
    if (!editor) return
    const onUpdate = (): void => {
      const path = stateRef.current.filePath
      setSaveState(path ? 'editing' : 'unsaved-no-file')
      window.spec.setDocumentState(path, true)
      refreshDerived(editor)
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
      if (path) autosaveTimer.current = setTimeout(() => void doSave(), AUTOSAVE_DELAY_MS)
    }
    const onSelection = (): void => {
      const node = editor.state.selection.$from.node(1)
      setCurrentType(
        node && node.type.name === 'element' ? (node.attrs['type'] as ElementType) : null
      )
    }
    editor.on('update', onUpdate)
    editor.on('selectionUpdate', onSelection)
    refreshDerived(editor)
    return () => {
      editor.off('update', onUpdate)
      editor.off('selectionUpdate', onSelection)
    }
  }, [editor, doSave, refreshDerived])

  // Native menu commands.
  useEffect(() => {
    window.spec.onMenuCommand((command: MenuCommand) => {
      const templates: Partial<Record<MenuCommand, string>> = {
        'file:new': TEMPLATE_BLANK,
        'file:new-feature': TEMPLATE_FEATURE,
        'file:new-tv-hour': TEMPLATE_TV_HOUR,
        'file:new-tv-half-hour': TEMPLATE_TV_HALF_HOUR
      }
      const template = templates[command]
      if (template !== undefined) {
        loadContent(template, null)
        return
      }
      switch (command) {
        case 'file:open':
          void window.spec.openFile().then((f) => f && loadContent(f.content, f.path))
          break
        case 'file:import':
          void window.spec.importFile().then((f) => f && handleImport(f.path, f.data))
          break
        case 'file:save':
          void save()
          break
        case 'file:save-as':
          void saveAs()
          break
        case 'file:export-pdf':
          void exportAs('pdf')
          break
        case 'file:export-fdx':
          void exportAs('fdx')
          break
        case 'file:export-fountain':
          void exportAs('fountain')
          break
        case 'file:restore-snapshot':
          setShowSnapshots(true)
          break
        case 'edit:find':
          setShowFind(true)
          break
        case 'view:toggle-dark':
          setDark((d) => !d)
          break
        case 'view:toggle-focus':
          setFocusMode((f) => !f)
          break
        case 'view:title-page':
          setShowTitlePage(true)
          break
        case 'help:shortcuts':
          setShowShortcuts(true)
          break
        case 'help:welcome':
          setShowHint(true)
          break
      }
    })
    window.spec.onFileOpened((f) => loadContent(f.content, f.path))
    // Registered once for the app lifetime; handlers read fresh state from
    // stateRef, so an empty dependency list is safe here.
  }, [])

  useEffect(() => {
    document.body.classList.toggle('dark', dark)
    localStorage.setItem('spec:dark', dark ? '1' : '0')
  }, [dark])

  return (
    <div className={`app${focusMode ? ' focus-mode' : ''}`}>
      <SceneNavigator
        scenes={scenes}
        onJump={(pos) => editor && jumpToScene(editor, pos)}
        onMove={(i, dir) => {
          if (editor && moveScene(editor, i, dir)) refreshDerived(editor)
        }}
      />
      <main className="editor-pane">
        <ElementToolbar
          currentType={currentType}
          modKey={modKey}
          onSetType={(type) =>
            editor && editor.chain().focus().updateAttributes('element', { type }).run()
          }
          onHelp={() => setShowShortcuts(true)}
        />
        {showFind && editor && (
          <FindReplace
            onFindNext={(q) => {
              const matches = findMatches(editor, q)
              selectNextMatch(editor, matches)
              return matches.length
            }}
            onReplace={(q, r) => {
              const matches = findMatches(editor, q)
              const sel = editor.state.selection
              const selected = matches.find((m) => m.from === sel.from && m.to === sel.to)
              if (selected) replaceSelection(editor, r)
              else selectNextMatch(editor, matches)
            }}
            onReplaceAll={(q, r) => replaceAll(editor, q, r)}
            onClose={() => setShowFind(false)}
          />
        )}
        <div className="page-surface">
          <EditorContent editor={editor} />
        </div>
        <StatusBar
          currentType={currentType}
          pageCount={pageCount}
          sceneCount={scenes.length}
          filePath={filePath}
          saveState={saveState}
        />
      </main>
      {showTitlePage && (
        <TitlePageDialog
          titlePage={titlePage}
          onApply={(entries) => {
            setTitlePage(entries)
            stateRef.current.titlePage = entries
            setSaveState(stateRef.current.filePath ? 'editing' : 'unsaved-no-file')
            if (stateRef.current.filePath) void doSave()
          }}
          onClose={() => setShowTitlePage(false)}
        />
      )}
      {showSnapshots && filePath && (
        <SnapshotsDialog
          filePath={filePath}
          onRestore={(content) => loadContent(content, filePath)}
          onClose={() => setShowSnapshots(false)}
        />
      )}
      {pendingImport && (
        <ReviewPane
          fileName={pendingImport.fileName}
          lines={pendingImport.lines}
          titlePage={pendingImport.titlePage}
          onCommit={(script) => {
            setPendingImport(null)
            // Imported scripts start as untitled: nothing touches disk until
            // the writer saves.
            loadContent(serializeFountain(script), null)
          }}
          onCancel={() => setPendingImport(null)}
        />
      )}
      {importError && (
        <div className="import-error" role="alert">
          <span>{importError}</span>
          <button onClick={() => setImportError(null)}>Dismiss</button>
        </div>
      )}
      {showShortcuts && <ShortcutsDialog modKey={modKey} onClose={() => setShowShortcuts(false)} />}
      {showHint && !showShortcuts && (
        <FirstLaunchHint
          modKey={modKey}
          onShowShortcuts={() => {
            dismissHint()
            setShowShortcuts(true)
          }}
          onDismiss={dismissHint}
        />
      )}
    </div>
  )
}
