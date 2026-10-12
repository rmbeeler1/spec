# Changelog

All notable changes to Spec are recorded here.

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
