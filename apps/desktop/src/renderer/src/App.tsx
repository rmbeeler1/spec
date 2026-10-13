import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import { UndoRedo } from '@tiptap/extensions'
import { undoDepth } from '@tiptap/pm/history'
import type { Editor } from '@tiptap/core'
import {
  attachSceneMeta,
  characterStats,
  emptyPlanning,
  exportPdf,
  isPlanningEmpty,
  paginate,
  parseFountain,
  parsePlanning,
  parseStashFile,
  serializeFountain,
  serializePlanning,
  serializeStashFile,
  sidecarPathFor,
  stashChunkFountain,
  stashChunkSummary,
  stashPathFor,
  writeFdx,
  type ElementType,
  type PlanningData,
  type Script,
  type TitlePageEntry
} from '@spec/core'
import type { MenuCommand, OrphanSidecarInfo } from '../../shared/ipc'
import {
  LineBreak,
  ScreenplayDocument,
  ScreenplayElement,
  ScreenplayText
} from './editor/schema'
import { ScreenplayKeymap } from './editor/keymap'
import { CurrentElement, PageBreaks, SceneDim, pageBreaksKey, sceneDimKey } from './editor/plugins'
import { computePageBreakMap } from './editor/pageMap'
import { scriptToDoc, docToScript, type PmDoc } from './editor/convert'
import {
  assignMissingSceneIds,
  jumpToScene,
  listScenes,
  listStructure,
  moveScene,
  moveSceneTo,
  setSceneSynopsis,
  type SceneInfo,
  type StructureInfo
} from './editor/scenes'
import { cutSelectionToStash, insertFountainAfterCaret } from './editor/stash'
import { autoNumberNewScenes, renumberScenes } from './editor/numbering'
import { findMatches, replaceAll, replaceSelection, selectNextMatch } from './editor/search'
import { pdfFonts } from './fonts'
import {
  TEMPLATE_BLANK,
  TEMPLATE_FEATURE,
  TEMPLATE_TV_HALF_HOUR,
  TEMPLATE_TV_HOUR
} from './templates'
import { buildSceneCards, pacingLanes, type SceneCard } from './planning/cards'
import {
  addStashEntry,
  localDay,
  orphanSceneEntries,
  recordWriting,
  setWritingGoal,
  patchSceneMeta,
  reattachSceneMeta,
  refreshHeadings,
  removeBeat,
  removeSceneMeta,
  removeStashEntry,
  sceneMetaMap,
  toggleBeatLink,
  upsertBeat
} from './planning/planningState'
import { UndoPairing } from './planning/undoPairing'
import { SceneNavigator, type SidebarTab } from './components/SceneNavigator'
import { StatusBar } from './components/StatusBar'
import { FindReplace } from './components/FindReplace'
import { TitlePageDialog } from './components/TitlePageDialog'
import { TitlePagePreview } from './components/TitlePagePreview'
import { SnapshotsDialog } from './components/SnapshotsDialog'
import { ElementToolbar } from './components/ElementToolbar'
import { ShortcutsDialog } from './components/ShortcutsDialog'
import { FirstLaunchHint } from './components/FirstLaunchHint'
import { ReviewPane } from './components/ReviewPane'
import { ViewSwitcher, type AppView } from './components/ViewSwitcher'
import { Corkboard } from './components/Corkboard'
import { PacingBoard } from './components/PacingBoard'
import { BeatBoard } from './components/BeatBoard'
import { OutlineView } from './components/OutlineView'
import { StashPane, type StashItemView } from './components/StashPane'
import { CharacterNavigator } from './components/CharacterNavigator'
import { RenameDialog } from './components/RenameDialog'
import { OrphanPrompt } from './components/OrphanPrompt'
import { OrphanMetaBanner } from './components/OrphanMetaBanner'
import { AboutDialog } from './components/AboutDialog'
import { ReportsView } from './components/ReportsView'
import { GoalDialog } from './components/GoalDialog'
import { routeImport, type PendingImport } from './import/route'

type SaveState = 'saved' | 'editing' | 'unsaved-no-file'

const AUTOSAVE_DELAY_MS = 1500
const PAGINATE_DELAY_MS = 400
const PLANNING_SAVE_DELAY_MS = 1000

function newStashId(): string {
  return `st-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`
}

export default function App(): React.JSX.Element {
  const [filePath, setFilePath] = useState<string | null>(null)
  const [titlePage, setTitlePage] = useState<TitlePageEntry[]>([])
  const [saveState, setSaveState] = useState<SaveState>('unsaved-no-file')
  const [dark, setDark] = useState(() => localStorage.getItem('spec:dark') === '1')
  const [focusMode, setFocusMode] = useState(false)
  const [showStructure, setShowStructure] = useState(
    () => localStorage.getItem('spec:structure') !== '0'
  )
  const [view, setView] = useState<AppView>('write')
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('scenes')
  const [scenes, setScenes] = useState<SceneInfo[]>([])
  const [structure, setStructure] = useState<StructureInfo[]>([])
  const [script, setScript] = useState<Script>({ titlePage: [], elements: [] })
  const [planning, setPlanning] = useState<PlanningData>(emptyPlanning())
  const [stashItems, setStashItems] = useState<StashItemView[]>([])
  const [stashOpen, setStashOpen] = useState(false)
  const [pageCount, setPageCount] = useState(1)
  const [currentType, setCurrentType] = useState<ElementType | null>('scene_heading')
  const [selectedCharacter, setSelectedCharacter] = useState<string | null>(null)
  const [filteredCharacter, setFilteredCharacter] = useState<string | null>(null)
  const [showFind, setShowFind] = useState(false)
  const [showTitlePage, setShowTitlePage] = useState(false)
  const [showSnapshots, setShowSnapshots] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [showAbout, setShowAbout] = useState(false)
  const [showGoal, setShowGoal] = useState(false)
  const [showRename, setShowRename] = useState(false)
  const [renameError, setRenameError] = useState<string | null>(null)
  const [orphan, setOrphan] = useState<OrphanSidecarInfo | null>(null)
  const [orphanBannerDismissed, setOrphanBannerDismissed] = useState(false)
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
  const planningTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pairing = useRef(new UndoPairing())
  /** Every chunk ever stashed this session, so undo/redo can resurrect them. */
  const chunkArchive = useRef(new Map<string, StashItemView>())
  const planningLoaded = useRef(false)
  const structureCount = useRef(0)
  /** Writing stats: word baseline, pending uncommitted words, page baseline.
   *  Imports and undo/redo reset the baseline instead of counting. */
  const wordBaseline = useRef<number | null>(null)
  const pendingWords = useRef(0)
  const pageBaseline = useRef<number | null>(null)
  const suppressStats = useRef(false)

  const editor = useEditor({
    extensions: [
      ScreenplayDocument,
      ScreenplayText,
      LineBreak,
      ScreenplayElement,
      ScreenplayKeymap,
      PageBreaks,
      SceneDim,
      CurrentElement,
      UndoRedo
    ],
    content: scriptToDoc(parseFountain(TEMPLATE_BLANK)),
    autofocus: 'end'
  })

  // Menu handlers read from here to avoid stale closures.
  const stateRef = useRef({ filePath, titlePage, editor, view, stashItems, planning, scenes })
  stateRef.current = { filePath, titlePage, editor, view, stashItems, planning, scenes }

  const currentScript = useCallback(() => {
    const { editor: ed, titlePage: tp } = stateRef.current
    if (!ed) return { titlePage: tp, elements: [] }
    return docToScript(ed.getJSON() as unknown as PmDoc, tp)
  }, [])

  const refreshDerived = useCallback(
    (ed: Editor) => {
      assignMissingSceneIds(ed)
      if (stateRef.current.planning.numberingLocked) autoNumberNewScenes(ed)
      setScenes(listScenes(ed))
      setStructure(listStructure(ed))
      if (paginateTimer.current) clearTimeout(paginateTimer.current)
      paginateTimer.current = setTimeout(() => {
        const snapshot = currentScript()
        setScript(snapshot)
        const pages = paginate(snapshot)
        setPageCount(Math.max(1, pages.length))
        const breaks = computePageBreakMap(pages)
        ed.view.dispatch(ed.state.tr.setMeta(pageBreaksKey, { breaks }))

        // Flush writing stats at most once per idle pause, never per keystroke
        if (planningLoaded.current) {
          const pagesDelta =
            pageBaseline.current === null ? 0 : pages.length - pageBaseline.current
          pageBaseline.current = pages.length
          const words = pendingWords.current
          pendingWords.current = 0
          if (words > 0 || pagesDelta > 0) {
            setPlanning((p) => recordWriting(p, localDay(), words, pagesDelta))
          }
        }
      }, PAGINATE_DELAY_MS)
    },
    [currentScript]
  )

  // ------------------------------------------------------------------
  // Derived planning views
  // ------------------------------------------------------------------
  const cards = useMemo(() => buildSceneCards(script, planning), [script, planning])
  const lanes = useMemo(() => pacingLanes(script), [script])
  const charStats = useMemo(() => characterStats(script), [script])
  const sceneHeadings = useMemo(
    () => new Map(scenes.filter((s) => s.id).map((s) => [s.id!, s.heading])),
    [scenes]
  )
  const orphanMeta = useMemo(() => {
    const ids = new Set(scenes.filter((s) => s.id).map((s) => s.id!))
    return orphanSceneEntries(planning, ids)
  }, [planning, scenes])
  const today = useMemo(() => {
    const entry = planning.writing?.history.find((h) => h.date === localDay())
    return { words: entry?.words ?? 0, pages: entry?.pages ?? 0 }
  }, [planning])
  const writingTable = useMemo(
    () => ({
      id: 'writing',
      title: 'Writing',
      columns: ['Date', 'Words', 'Pages'],
      rows: [...(planning.writing?.history ?? [])]
        .reverse()
        .map((h) => [h.date, String(h.words), String(h.pages)])
    }),
    [planning]
  )
  const sceneColors = useMemo(() => {
    const out = new Map<string, string>()
    for (const [id, meta] of sceneMetaMap(planning)) {
      if (meta.color) out.set(id, meta.color)
    }
    return out
  }, [planning])

  // ------------------------------------------------------------------
  // Saving
  // ------------------------------------------------------------------
  const doSave = useCallback(async (): Promise<void> => {
    const { filePath: path } = stateRef.current
    if (!path) return
    await window.spec.writeFile(path, serializeFountain(currentScript()))
    setSaveState('saved')
    window.spec.setDocumentState(path, false)
  }, [currentScript])

  const savePlanningNow = useCallback(async (): Promise<void> => {
    const { filePath: path, planning: data, scenes: sc, stashItems: items } = stateRef.current
    if (!path || !planningLoaded.current) return
    const refreshed = refreshHeadings(data, sc)
    await window.spec.writePlanningFile(
      sidecarPathFor(path),
      isPlanningEmpty(refreshed) ? '' : serializePlanning(refreshed)
    )
    await window.spec.writePlanningFile(
      stashPathFor(path),
      serializeStashFile(items.map((i) => i.chunk))
    )
  }, [])

  const saveAs = useCallback(async (): Promise<void> => {
    const title = stateRef.current.titlePage.find((e) => e.key.toLowerCase() === 'title')
    const defaultName = `${title?.values[0] ?? 'Untitled'}.fountain`
    const path = await window.spec.saveFileAs(defaultName, 'Fountain', ['fountain'])
    if (!path) return
    setFilePath(path)
    stateRef.current.filePath = path
    await doSave()
    await savePlanningNow()
  }, [doSave, savePlanningNow])

  const save = useCallback(async (): Promise<void> => {
    if (stateRef.current.filePath) await doSave()
    else await saveAs()
  }, [doSave, saveAs])

  // Debounced sidecar + stash persistence
  useEffect(() => {
    if (!planningLoaded.current || !filePath) return
    if (planningTimer.current) clearTimeout(planningTimer.current)
    planningTimer.current = setTimeout(() => void savePlanningNow(), PLANNING_SAVE_DELAY_MS)
  }, [planning, stashItems, filePath, savePlanningNow])

  // ------------------------------------------------------------------
  // Loading
  // ------------------------------------------------------------------
  const loadPlanningFor = useCallback(async (path: string | null, loaded: Script) => {
    planningLoaded.current = false
    pairing.current.clear()
    chunkArchive.current.clear()
    setFilteredCharacter(null)
    setSelectedCharacter(null)
    setOrphanBannerDismissed(false)

    let data = emptyPlanning()
    let foundSidecar = false
    if (path) {
      const text = await window.spec.readTextFile(sidecarPathFor(path))
      if (text !== null) {
        foundSidecar = true
        data = parsePlanning(text).data
      }
    }
    // Re-key scene entries to the freshly parsed scene IDs; keep orphans
    const sceneRefs = loaded.elements
      .filter((e) => e.type === 'scene_heading')
      .map((e) => ({ id: e.id, heading: e.text }))
    const { attached, orphans } = attachSceneMeta(sceneRefs, data.scenes)
    data = { ...data, scenes: [...attached, ...orphans] }
    setPlanning(data)

    let items: StashItemView[] = []
    if (path) {
      const stashText = await window.spec.readTextFile(stashPathFor(path))
      if (stashText !== null) {
        const metaById = new Map(data.stash.map((s) => [s.id, s]))
        items = parseStashFile(stashText).map((chunk) => ({
          chunk,
          cutAt: chunk.cutAt || (metaById.get(chunk.id)?.cutAt ?? ''),
          fromScene: metaById.get(chunk.id)?.fromScene ?? null
        }))
      }
    }
    setStashItems(items)
    for (const item of items) chunkArchive.current.set(item.chunk.id, item)
    planningLoaded.current = true

    // No sidecar of our own: maybe one is sitting here orphaned by a rename
    if (path && !foundSidecar) {
      const found = await window.spec.findOrphanSidecar(path)
      if (found) setOrphan(found)
    }
  }, [])

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
      ed.view.dispatch(ed.state.tr.setMeta(sceneDimKey, { keepSceneIds: null }))
      structureCount.current = script.elements.filter(
        (e) => e.type === 'section' || e.type === 'synopsis'
      ).length
      // Opened or imported text is a new baseline, never "written today"
      const doc = ed.state.doc
      wordBaseline.current = doc
        .textBetween(0, doc.content.size, '\n')
        .split(/\s+/)
        .filter((w) => w.length > 0).length
      pendingWords.current = 0
      pageBaseline.current = null
      refreshDerived(ed)
      void loadPlanningFor(path, script)
    },
    [refreshDerived, loadPlanningFor]
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

  // ------------------------------------------------------------------
  // Planning actions
  // ------------------------------------------------------------------
  const openScene = useCallback((sceneId: string): void => {
    setView('write')
    requestAnimationFrame(() => {
      const ed = stateRef.current.editor
      if (!ed) return
      const scene = listScenes(ed).find((s) => s.id === sceneId)
      if (scene) jumpToScene(ed, scene.pos)
    })
  }, [])

  const patchScene = useCallback(
    (card: SceneCard, patch: Parameters<typeof patchSceneMeta>[3]): void => {
      setPlanning((p) => patchSceneMeta(p, card.id, card.heading, patch))
    },
    []
  )

  const stashSelection = useCallback((): void => {
    const ed = stateRef.current.editor
    if (!ed || stateRef.current.view !== 'write') return
    const cut = cutSelectionToStash(ed)
    if (!cut) return
    const id = newStashId()
    const cutAt = new Date().toISOString()
    const item: StashItemView = {
      chunk: { id, cutAt, elements: cut.elements },
      cutAt,
      fromScene: cut.fromScene
    }
    chunkArchive.current.set(id, item)
    setStashItems((items) => [item, ...items])
    setPlanning((p) =>
      addStashEntry(p, {
        id,
        cutAt,
        summary: stashChunkSummary(item.chunk),
        ...(cut.fromScene ? { fromScene: cut.fromScene } : {})
      })
    )
    setStashOpen(true)
    pairing.current.record('stash', id, undoDepth(ed.state))
    refreshDerived(ed)
  }, [refreshDerived])

  const restoreChunk = useCallback(
    (chunkId: string): void => {
      const ed = stateRef.current.editor
      const item = stateRef.current.stashItems.find((i) => i.chunk.id === chunkId)
      if (!ed || !item) return
      suppressStats.current = true // restored text is not "written today"
      if (!insertFountainAfterCaret(ed, stashChunkFountain(item.chunk))) {
        suppressStats.current = false
        return
      }
      setStashItems((items) => items.filter((i) => i.chunk.id !== chunkId))
      setPlanning((p) => removeStashEntry(p, chunkId))
      setView('write')
      pairing.current.record('restore', chunkId, undoDepth(ed.state))
      refreshDerived(ed)
    },
    [refreshDerived]
  )

  /** Reverse the stash-side effect of an op (or re-apply it, for redo). */
  const applyStashSide = useCallback((kind: 'stash' | 'restore', entryId: string, undoing: boolean) => {
    const archived = chunkArchive.current.get(entryId)
    // kind=stash undone -> entry leaves the stash; redone -> comes back.
    // kind=restore undone -> entry returns to the stash; redone -> leaves.
    const present = kind === 'stash' ? !undoing : undoing
    if (present && archived) {
      setStashItems((items) =>
        items.some((i) => i.chunk.id === entryId) ? items : [archived, ...items]
      )
      setPlanning((p) =>
        addStashEntry(p, {
          id: entryId,
          cutAt: archived.cutAt,
          summary: stashChunkSummary(archived.chunk),
          ...(archived.fromScene ? { fromScene: archived.fromScene } : {})
        })
      )
    } else {
      setStashItems((items) => items.filter((i) => i.chunk.id !== entryId))
      setPlanning((p) => removeStashEntry(p, entryId))
    }
  }, [])

  // Global undo/redo: route to the editor from any view, and pair stash moves
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      const mod = window.spec.platform === 'darwin' ? e.metaKey : e.ctrlKey
      if (!mod || (e.key !== 'z' && e.key !== 'Z' && e.key !== 'y')) return
      const ed = stateRef.current.editor
      if (!ed) return
      const target = e.target as HTMLElement
      const inForeignInput =
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') &&
        !target.closest('.tiptap')
      if (inForeignInput) return
      const isRedo = e.key === 'y' || e.shiftKey

      if (isRedo) {
        const match = pairing.current.matchRedo(undoDepth(ed.state))
        e.preventDefault()
        e.stopPropagation()
        suppressStats.current = true
        ed.commands.redo()
        if (match) applyStashSide(match.kind, match.entryId, false)
        refreshDerived(ed)
      } else {
        const match = pairing.current.matchUndo(undoDepth(ed.state))
        e.preventDefault()
        e.stopPropagation()
        suppressStats.current = true
        ed.commands.undo()
        if (match) applyStashSide(match.kind, match.entryId, true)
        refreshDerived(ed)
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [applyStashSide, refreshDerived])

  const filterCharacter = useCallback(
    (name: string | null): void => {
      const ed = stateRef.current.editor
      if (!ed) return
      setFilteredCharacter(name)
      if (!name) {
        ed.view.dispatch(ed.state.tr.setMeta(sceneDimKey, { keepSceneIds: null }))
        return
      }
      const stat = characterStats(currentScript()).find((s) => s.name === name)
      ed.view.dispatch(
        ed.state.tr.setMeta(sceneDimKey, { keepSceneIds: new Set(stat?.sceneIds ?? []) })
      )
    },
    [currentScript]
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

      // Words written: positive deltas only, batched until the next idle
      // flush. Undo/redo realigns the baseline without counting.
      const doc = editor.state.doc
      const words = doc
        .textBetween(0, doc.content.size, '\n')
        .split(/\s+/)
        .filter((w) => w.length > 0).length
      if (suppressStats.current || wordBaseline.current === null) {
        suppressStats.current = false
      } else if (words > wordBaseline.current) {
        pendingWords.current += words - wordBaseline.current
      }
      wordBaseline.current = words

      // Typing a # or = line while structure is hidden would make it vanish;
      // auto-show structure instead (owner decision, Oct 2026).
      let count = 0
      editor.state.doc.descendants((node) => {
        const t = node.attrs['type']
        if (t === 'section' || t === 'synopsis') count++
        return false
      })
      if (count > structureCount.current) setShowStructure(true)
      structureCount.current = count

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
    planningLoaded.current = true // the initial blank template needs no load
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
      const views: Partial<Record<MenuCommand, AppView>> = {
        'view:write': 'write',
        'view:corkboard': 'corkboard',
        'view:pacing': 'pacing',
        'view:beatboard': 'beatboard',
        'view:outline': 'outline',
        'view:reports': 'reports'
      }
      const nextView = views[command]
      if (nextView) {
        setView(nextView)
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
        case 'file:rename':
          if (stateRef.current.filePath) {
            setRenameError(null)
            setShowRename(true)
          } else {
            void saveAs()
          }
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
        case 'edit:stash-selection':
          stashSelection()
          break
        case 'view:toggle-dark':
          setDark((d) => !d)
          break
        case 'view:toggle-focus':
          setFocusMode((f) => !f)
          break
        case 'view:toggle-structure':
          setShowStructure((s) => !s)
          break
        case 'view:toggle-stash':
          setStashOpen((s) => !s)
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
        case 'help:about':
          setShowAbout(true)
          break
        case 'production:renumber': {
          const ed = stateRef.current.editor
          if (ed && renumberScenes(ed)) refreshDerived(ed)
          break
        }
        case 'production:writing-goal':
          setShowGoal(true)
          break
        case 'production:toggle-number-lock':
          setPlanning((p) => {
            const next = { ...p }
            if (next.numberingLocked) delete next.numberingLocked
            else next.numberingLocked = true
            return next
          })
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

  useEffect(() => {
    localStorage.setItem('spec:structure', showStructure ? '1' : '0')
  }, [showStructure])

  const renameTo = useCallback(async (newName: string): Promise<void> => {
    const old = stateRef.current.filePath
    if (!old) return
    const result = await window.spec.renameScript(old, newName)
    if ('error' in result) {
      setRenameError(result.error)
      return
    }
    setFilePath(result.newPath)
    stateRef.current.filePath = result.newPath
    window.spec.setDocumentState(result.newPath, false)
    setShowRename(false)
    setRenameError(null)
  }, [])

  const attachFoundOrphan = useCallback(async (): Promise<void> => {
    const path = stateRef.current.filePath
    if (!orphan || !path) return
    const error = await window.spec.attachOrphanSidecar(orphan, path)
    setOrphan(null)
    if (error) {
      setImportError(`Could not attach planning data: ${error}`)
      return
    }
    void loadPlanningFor(path, currentScript())
  }, [orphan, loadPlanningFor, currentScript])

  const fileName = filePath ? (filePath.split(/[/\\]/).pop() ?? 'Untitled') : 'Untitled'

  return (
    <div
      className={`app view-${view}${focusMode ? ' focus-mode' : ''}${showStructure ? '' : ' structure-hidden'}`}
    >
      {view === 'write' && (
        <SceneNavigator
          scenes={scenes}
          sceneColors={sceneColors}
          tab={sidebarTab}
          onTabChange={setSidebarTab}
          charactersPane={
            <CharacterNavigator
              stats={charStats}
              sceneHeadings={sceneHeadings}
              filteredCharacter={filteredCharacter}
              onFilter={filterCharacter}
              onJumpToScene={openScene}
              selected={selectedCharacter}
              onSelect={setSelectedCharacter}
            />
          }
          onJump={(pos) => editor && jumpToScene(editor, pos)}
          onMove={(i, dir) => {
            if (editor && moveScene(editor, i, dir)) refreshDerived(editor)
          }}
        />
      )}
      <main className="editor-pane">
        <ViewSwitcher
          view={view}
          stashOpen={stashOpen}
          stashCount={stashItems.length}
          modKey={modKey}
          onSetView={setView}
          onToggleStash={() => setStashOpen((s) => !s)}
        />
        {view === 'write' && (
          <ElementToolbar
            currentType={currentType}
            modKey={modKey}
            onSetType={(type) =>
              editor && editor.chain().focus().updateAttributes('element', { type }).run()
            }
            onTitlePage={() => setShowTitlePage(true)}
            onHelp={() => setShowShortcuts(true)}
          />
        )}
        {orphanMeta.length > 0 && !orphanBannerDismissed && (
          <OrphanMetaBanner
            orphans={orphanMeta}
            scenes={scenes.filter((s) => s.id).map((s) => ({ id: s.id!, heading: s.heading }))}
            onAttach={(orphanId, sceneId) => {
              const scene = scenes.find((s) => s.id === sceneId)
              if (scene) {
                setPlanning((p) => reattachSceneMeta(p, orphanId, { id: sceneId, heading: scene.heading }))
              }
            }}
            onRemove={(orphanId) => setPlanning((p) => removeSceneMeta(p, orphanId))}
            onDismiss={() => setOrphanBannerDismissed(true)}
          />
        )}
        {view === 'write' && showFind && editor && (
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
        <div className="work-area">
          <div className="page-surface" hidden={view !== 'write'}>
            <TitlePagePreview titlePage={titlePage} onEdit={() => setShowTitlePage(true)} />
            <EditorContent editor={editor} />
          </div>
          {view === 'corkboard' && (
            <Corkboard
              cards={cards}
              storylines={planning.storylines}
              onReorder={(from, to) => {
                if (editor && moveSceneTo(editor, from, to)) refreshDerived(editor)
              }}
              onOpenScene={openScene}
              onEditSynopsis={(sceneId, text) => {
                if (editor && setSceneSynopsis(editor, sceneId, text)) refreshDerived(editor)
              }}
              onSetColor={(card, color) => patchScene(card, { color })}
              onSetTags={(card, tags) => patchScene(card, { tags: tags.length ? tags : undefined })}
              onToggleStoryline={(card, id) => {
                const next = card.storylines.includes(id)
                  ? card.storylines.filter((s) => s !== id)
                  : [...card.storylines, id]
                patchScene(card, { storylines: next.length ? next : undefined })
              }}
              onCreateStoryline={(name, color) =>
                setPlanning((p) => ({
                  ...p,
                  storylines: [
                    ...p.storylines,
                    { id: `sl-${Date.now().toString(36)}`, name, color }
                  ]
                }))
              }
            />
          )}
          {view === 'pacing' && (
            <PacingBoard
              cards={cards}
              lanes={lanes}
              storylines={planning.storylines}
              onSetTension={(card, tension) =>
                patchScene(card, { tension: tension ?? undefined })
              }
              onOpenScene={openScene}
            />
          )}
          {view === 'beatboard' && (
            <BeatBoard
              beats={planning.beats}
              links={planning.beatLinks}
              onUpsert={(beat) => setPlanning((p) => upsertBeat(p, beat))}
              onRemove={(id) => setPlanning((p) => removeBeat(p, id))}
              onToggleLink={(link) => setPlanning((p) => toggleBeatLink(p, link))}
            />
          )}
          {view === 'outline' && (
            <OutlineView
              structure={structure}
              cards={cards}
              onJump={(pos) => {
                setView('write')
                requestAnimationFrame(() => editor && jumpToScene(editor, pos))
              }}
            />
          )}
          {view === 'reports' && (
            <ReportsView
              script={script}
              extraTables={[writingTable]}
              baseName={
                titlePage.find((e) => e.key.toLowerCase() === 'title')?.values[0] ?? 'Untitled'
              }
            />
          )}
          {stashOpen && (
            <StashPane
              items={stashItems}
              canStash={view === 'write'}
              onStashSelection={stashSelection}
              onRestore={restoreChunk}
              onClose={() => setStashOpen(false)}
            />
          )}
        </div>
        <StatusBar
          currentType={currentType}
          pageCount={pageCount}
          sceneCount={scenes.length}
          filePath={filePath}
          saveState={saveState}
          today={today}
          goal={planning.writing?.goal}
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
      {showRename && filePath && (
        <RenameDialog
          currentName={fileName}
          error={renameError}
          onRename={(name) => void renameTo(name)}
          onClose={() => setShowRename(false)}
        />
      )}
      {orphan && filePath && (
        <OrphanPrompt
          orphan={orphan}
          scriptName={fileName}
          onAttach={() => void attachFoundOrphan()}
          onDecline={() => setOrphan(null)}
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
      {showAbout && <AboutDialog onClose={() => setShowAbout(false)} />}
      {showGoal && (
        <GoalDialog
          goal={planning.writing?.goal}
          onApply={(goal) => setPlanning((p) => setWritingGoal(p, goal))}
          onClose={() => setShowGoal(false)}
        />
      )}
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
