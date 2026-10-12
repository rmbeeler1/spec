# CLAUDE.md

Open-source, offline-first desktop screenwriting app. Personal project, MIT licensed. Full scope lives in `docs/screenwriting-app-plan.md`; read it before any non-trivial change.

## Owner context
- Owner is not a professional developer. Explain decisions in plain language, avoid jargon without a one-line definition, and prefer the simplest approach that works over the cleverest.
- Voice-to-text is common in prompts; interpret intent, do not nitpick wording.
- No em-dashes in docs, comments, or UI copy.

## Stack (decided, do not relitigate)
- Electron + React + TypeScript, scaffolded with electron-vite.
- Editor: Tiptap (ProseMirror) with custom nodes for each screenplay element.
- pnpm workspaces monorepo: `packages/core` (pure TypeScript, no Electron/React imports) and `apps/desktop`.
- Tests: Vitest. Lint: ESLint + Prettier. CI: GitHub Actions matrix (Windows, macOS, Linux).
- PDF: pdf-lib. Font: bundled Courier Prime.

## Non-negotiables
- Fountain (`.fountain`) is the source of truth on disk. Planning data (cards, beats, stash, colors) lives in `project.json` keyed by stable element IDs. Never store script text anywhere except the Fountain file.
- Pagination must match industry standard: Courier 12pt, 6 lines/inch, standard margins and indents, (MORE)/(CONT'D) on dialogue breaks, never orphan a character cue, never leave a scene heading at page bottom. Treat parity with Final Draft page counts on the test corpus as a release gate.
- Data safety first: atomic writes (temp file then rename), autosave, snapshot history. Crashes and lost work are the number one complaint about commercial tools; we do not repeat that.
- Clean room: do not read or copy code from GPL projects (Beat, KIT Scenarist, Trelby). Spec docs and MIT/BSD libraries only.

## Release ladder (one verb per release, ship before starting the next)
- v0.1 Write: editor, auto element detection, pagination, PDF/FDX/Fountain export, title page, scene navigator, dark/focus mode, autosave.
- v0.2 Import: FDX, DOCX, MD/TXT, PDF text layer, with an element classifier and a review pane to bulk-fix misclassified lines.
- v0.3 Plan: corkboard scene cards, pacing storyboard (text cards on a timeline with page length, runtime, tension), Beat Board, outline lanes (acts/sequences/scenes/storylines), stash, character navigator.
- v0.4 Produce: revision mode, scene numbering, reports, dual dialogue, writing stats, more templates.

## Working agreements
- Before coding a feature, state the plan in 3-5 bullets and wait for a go.
- Every parser/pagination change ships with a test against the corpus in `test-corpus/`.
- Keep `docs/CHANGELOG.md` current. Keep `docs/screenwriting-app-plan.md` current when scope changes.
- Commands: `pnpm install`, `pnpm dev`, `pnpm test`, `pnpm build`. Update this list if they change.

## Current phase
Phase 0 complete (Oct 12, 2026): name is Spec, monorepo scaffolded and verified (install, lint, test, build, app launches), CI matrix added, Courier Prime bundled, test corpus collected (see `test-corpus/SOURCES.md`, including its follow-ups list). Next: Phase 1, core library (Fountain parser/serializer, document model, pagination, FDX, CLI).
