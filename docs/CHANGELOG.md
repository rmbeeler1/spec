# Changelog

All notable changes to Spec are recorded here.

## v0.3.0 "Plan" (October 12, 2026)

- New views, switchable from a tab bar above the page and the View menu (Cmd/Ctrl+Alt+1 to 5): Write, Corkboard, Pacing, Beat Board, Outline.
- Planning sidecar: cards, colors, tags, storylines, tension and beat boards live in `MyScript.spec.json` next to the script, keyed by stable element IDs with heading snapshots so everything re-attaches after a reload. Written atomically, removed when empty, and a corrupt sidecar never blocks the script from opening. Script text never goes in it.
- Corkboard: one index card per scene with its synopsis as the body; scenes without a synopsis show their first action line, greyed. Click the body to edit the synopsis (writes a real `=` line into the Fountain). Drag a card onto another to reorder the actual scenes; Cmd/Ctrl+Z undoes it from any view. Double-click opens the scene in the editor. Color, tags and storylines per scene.
- Pacing storyboard: the same scenes left to right in act lanes split by `#` sections. Each card shows INT/EXT, time of day, page length in eighths from the real paginator, runtime at a page a minute, and a 1 to 5 tension setter that defaults to unset. The strip above draws the tension curve across the whole script; unset scenes are gaps in the line, never zeros.
- Beat Board: freeform planning cards (title, notes, color, tags) you drag around a large canvas, with flow lines between them (click a line, then its x, to remove it). Planning-only; nothing on the board touches the script.
- Outline: acts, sequences and scenes in three lanes with page lengths and start pages; click anything to jump there in the editor.
- Stash: select lines and send them to the stash (button, or Cmd/Ctrl+Alt+X) instead of deleting. Cut material lives in `MyScript.stash.fountain`, plain Fountain with marker notes, and restores at the cursor. Cmd/Ctrl+Z after a stash move reverses both sides: the text returns and the entry leaves the pane, no duplicates; redo re-stashes it.
- Characters tab in the sidebar: cue and scene counts per character ((V.O.), (CONT'D) and dual-dialogue carets merged), their scene list for jumping, and a filter that dims every scene they are not in.
- File > Rename renames the script, sidecar and stash together (all-or-nothing), and recents follow. Opening a script with no sidecar next to an orphaned one (its script gone, likely renamed outside the app) prompts to attach it.
- Typing `# Act One` or `= synopsis` on a line now creates a real section or synopsis on Enter (marker stripped), and doing so while structure is hidden auto-shows structure instead of letting the line vanish (fixes the v0.2 polish quirk).
- Scene list rows show their planning color as a dot.

## Unreleased: pre-v0.3 polish (October 12, 2026, owner feedback after v0.2)

- Title page now renders as page zero above the script, laid out from the same blocks the PDF exporter draws (shared `titlePageBlocks` in core, so preview and export cannot drift). Click it to edit. With no title page yet, a slim "+ Add a title page" placeholder sits above page one. Also reachable from a new Title Page toolbar button and the existing File > Title Page menu item. Hidden in focus mode.
- View > Show Structure (Cmd/Ctrl+Shift+T): toggles # section and = synopsis lines on and off in the editor. The setting persists across restarts. Note: while structure is hidden, typing a new # line makes it vanish until toggled back on.
- Scene sidebar is readable: headings wrap up to three lines instead of truncating on one, the full heading shows on hover, move buttons no longer shift the row when they appear, and the sidebar is resizable by dragging its right edge (width persists).
- Working agreement recorded: no standalone classifier tuning rounds; real imports that misread lines go into test-corpus and drive fixes from there.

## v0.2.0 "Import" (October 12, 2026)

- Element classifier in core: per-line element types with confidence values, using INT./EXT. patterns, caps cues, TO: transitions, parentheticals, blank-line context, and layout hints (centered, indent, bold) when the source has them.
- Accuracy gates as tests: at least 95% on clean plain text, at least 85% on messy plain text, measured against the Fountain ground truth of the same scripts. Downgrades that plain text makes unavoidable (forced headings, forced transitions, centered text) count as correct reads of the input.
- Importers in core: .txt and .md (headings become sections) through the classifier; .docx by reading the document XML directly (fflate + fast-xml-parser), with alignment/indent/bold feeding the classifier.
- CLI reads .docx, .txt and .md now: `spec convert script.docx script.fountain`.
- PDF text-layer import (pdfjs-dist): lines rebuilt from text positions, x offsets become indent hints for the classifier, vertical gaps become blank lines. Scanned PDFs without text raise a clear "run OCR first" error instead of importing garbage.
- File > Import… in the app (Cmd/Ctrl+Shift+I) and drag-and-drop onto the window, for .fountain, .fdx, .docx, .pdf, .txt, .md. Fountain and FDX load directly (their types are explicit); classifier formats open the review pane.
- Review pane: every line with its detected type and confidence, doubtful lines flagged and sortable to the top, click/shift-click selection, bulk type-setting, and a title page carried through. Committing creates an untitled document; nothing touches disk until the writer saves.
- Title page extraction on import now also accepts the "Key:" with indented values form.
- CLI reads .pdf as well: `spec convert script.pdf script.fountain`.
- Fixed: PDF import failed in the running app with "No GlobalWorkerOptions.workerSrc specified". pdf.js takes a different code path in a browser renderer than in Node, so unit tests never saw it; the importer now registers pdf.js's main-thread handler before first use, which works identically in Node, the dev server, and the packaged file:// app (no Web Worker, no CSP exceptions). A regression test runs importPdf with the `process` global hidden, forcing the same browser path the renderer uses; it reproduces the exact error without the fix.
- pdf.js is now lazy-loaded: it and its worker module split into separate chunks (~3.3 MB) that load on the first PDF import, shrinking the startup bundle back to its pre-PDF size. Verified live by dropping a corpus PDF on the built app: review pane opened with 110 lines classified, no errors (docs/evidence/v0.2-pdf-import.png).
- Markdown import rewritten after a real-world fixture (test-corpus/md/EL_AHOGADO_Screenplay.md) exposed it: inline **bold** and *italic* markers and --- rules are stripped before classification (previously **INT. ...** became 60% action and whole scripts imported as one block), bold survives as a confidence hint for cues, # headings map to sections with depth (unless the # line IS the title), and front matter ("Written by", "Based on…") routes to the title page. Verified live: 60 scenes in the sidebar and 84 pages where before there were none.
- Review pane guidance: a summary line with a sanity check ("Found 0 scene headings and 412 cues. That's unusual." style warnings), a short what-to-do explainer, Doubtful-first on by default, and a one-click "Looks right — import N lines" button for the common path.
- Acceptance file now distinguishes live-in-app verification from tests-only coverage per box.

## v0.1.1 discoverability pass (October 12, 2026, after hands-on feedback)

- Element toolbar above the page: the six element types with their shortcuts, click to set, current type highlighted.
- Help menu: Keyboard Shortcuts dialog (Cmd/Ctrl+/) and a reopenable Welcome Hint.
- First-launch hint card explaining the basics; shows once, dismissible.
- Scene heading normalization on Enter: "int house - day" becomes "INT. house - day" (prefix uppercased, period added); the scene sidebar displays headings in uppercase.
- Automatic (CONT'D): when the same character speaks again after action, the new cue gets (CONT'D). Never across a scene heading or transition, never doubled, dual-dialogue carets preserved.
- Final Draft parity gate is now an explicit test: Big Fish must paginate within 124 +/- 4 pages.
- Retroactive acceptance file with evidence (docs/acceptance/v0.1.md, docs/evidence/) and release report (docs/releases/v0.1-report.md).

## v0.1.0 "Write" (October 12, 2026)

First usable release: draft a script, get a correct PDF or FDX out.

### Phase 2: editor shell

- Screenplay editor built on Tiptap: every line is a typed element rendered with industry-standard indents in Courier Prime.
- Auto element detection while typing: INT./EXT. lines become scene headings, caps lines become character cues or transitions, parentheses inside dialogue become parentheticals. Detection only upgrades plain action lines, never overrides manual choices.
- Keyboard model: Enter follows the standard flow (character to dialogue, dialogue to character, and so on), Tab/Shift-Tab cycle the element type, Cmd/Ctrl+1 to 6 set it directly, Shift+Enter inserts a line break inside an element.
- Data safety: autosave 1.5 seconds after every change, atomic writes (temp file then rename), and a snapshot of the previous version on every save with a Restore from Snapshot dialog (last 25 kept per file).
- Live page count and page-break markers in the editor, computed by the same pagination engine that drives PDF export.
- Scene navigator: jump to any scene, move scenes up and down (reorders the script).
- Title page editor, find and replace, dark mode, focus mode (dims everything except the element being written).
- Export to PDF, FDX, and Fountain from the File menu. New-from-template: feature film, TV hour, TV half-hour.
- Native menus with recent files; window title tracks the file and unsaved state.
- Packaging with electron-builder (macOS dmg/zip, Windows nsis/zip, Linux AppImage/deb) and a tag-triggered GitHub release workflow.
- Known limitations: the editor shows the script as a continuous column with page markers rather than discrete page cards; spellcheck relies on the OS; scene reorder is button-based, not drag and drop.

## Unreleased

### Phase 1: core library (October 12, 2026)

- Document model: flat element list with stable IDs, all Fountain element types plus FDX Shot.
- Fountain parser and serializer with full element coverage (title page, scene numbers, dual dialogue, forced elements, sections, synopses, notes, boneyard, page breaks, lyrics, centered text). Semantic round-trip verified against the whole corpus with snapshot tests.
- Pagination engine: industry-standard metrics (Courier 12pt, 55 lines/page, standard indents and widths), dialogue breaks with (MORE)/(CONT'D), no orphaned character cues, no scene headings at page bottom, forced page breaks. Invariants tested on every corpus script. Big Fish paginates to 125 pages against roughly 124 in Final Draft.
- Inline emphasis parser (bold, italic, underline, notes stripped at render time).
- FDX reader and writer: element types, scene numbers, dual dialogue blocks, text styles mapped to Fountain emphasis in both directions. Verified round-trip plus a real-world read of the Big Fish FDX.
- PDF export with pdf-lib and embedded Courier Prime: styled text runs, underlines, title page, page numbers.
- CLI (`packages/cli`): `spec convert <in> <out>` routes by extension between .fountain/.txt/.fdx input and .fountain/.fdx/.pdf output. Bundled into a single self-contained file with the fonts baked in (`packages/cli/dist/spec.mjs`).
- Known limitations, deliberate for now: dual dialogue paginates sequentially rather than side by side; FDX title pages are not mapped back to Fountain keys; dialogue with no character cue (legal in FDX) downgrades to action when converted to Fountain.

### Phase 0 (October 12, 2026)

- Named the app Spec.
- Scaffolded the pnpm workspaces monorepo: `packages/core` (pure TypeScript library) and `apps/desktop` (Electron + React + TypeScript via electron-vite).
- Pinned the toolchain: TypeScript 5.9, Vite 7, electron-vite 5, Electron 44, React 19, Vitest 5, ESLint 10 with typescript-eslint, Prettier. TypeScript 6/7 and Vite 8 are out for now because typescript-eslint and electron-vite do not support them yet.
- Added GitHub Actions CI matrix (Windows, macOS, Linux): install, lint, test, build.
- First core utilities with tests: line-ending normalization and line splitting.
- Bundled Courier Prime (regular, bold, italic, bold italic) with its SIL Open Font License in `assets/fonts/courier-prime/`. Decision: bundle Courier Prime only, no detection of user-installed Courier variants for v0.1.
- Collected the test corpus in `test-corpus/`: the three official Fountain sample scripts, sixteen official per-element fixture files, four self-written pagination stress scripts, Big Fish in FDX, and generated DOCX/PDF variants. Provenance in `test-corpus/SOURCES.md`.
