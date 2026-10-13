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
- Pagination must match industry standard: Courier 12pt, 6 lines/inch, standard margins and indents, (MORE)/(CONT'D) on dialogue breaks, never orphan a character cue, never leave a scene heading at page bottom. Parity with Final Draft page counts on the test corpus is a release gate.
- Data safety first: atomic writes (temp file then rename), autosave, snapshot history. Crashes and lost work are the number one complaint about commercial tools; we do not repeat that.
- Clean room: do not read or copy code from GPL projects (Beat, KIT Scenarist, Trelby). Spec docs and MIT/BSD libraries only.

## Release ladder (one verb per release, ship before starting the next)
- v0.1 Write: editor, auto element detection, pagination, PDF/FDX/Fountain export, title page, scene navigator, dark/focus mode, autosave.
- v0.2 Import: FDX, DOCX, MD/TXT, PDF text layer, with an element classifier and a review pane to bulk-fix misclassified lines.
- v0.3 Plan: corkboard scene cards, pacing storyboard (text cards on a timeline with page length, runtime, tension), Beat Board, outline lanes, stash, character navigator.
- v0.4 Produce: revision mode, scene numbering, reports, dual dialogue, writing stats, more templates.

## Autonomous operation (the owner runs long unattended sessions)
- Each release has an acceptance file at `docs/acceptance/v0.X.md`: a checklist of user-visible behaviors plus the commands that prove them. Write the acceptance file BEFORE writing the code for that release, and ask the owner to confirm it. After that, work without asking.
- Definition of done for any task: `pnpm lint`, `pnpm test`, and `pnpm build` all pass, and every box in the acceptance file is checked with evidence (a test name, a screenshot in `docs/evidence/`, or a command output).
- Tests are the feedback loop. Build the test harness and corpus before features. Every parser, importer, or pagination change ships with a test against `test-corpus/`. If a feature cannot be tested automatically, write a manual check into the acceptance file for the owner.
- Commit after every green test run with a clear message. Never leave the working tree red for long.
- When stuck on the same failing test for more than three attempts, stop, write what you tried and what you think is wrong in `docs/BLOCKERS.md`, commit, and move to the next independent task. Do not loop.
- When a release's acceptance file is fully checked, write `docs/releases/v0.X-report.md`: what was built, what to click to try it, known gaps, and what you recommend next. That report is what the owner reads first.
- Release gate (owner rule, Oct 12, 2026): manual acceptance boxes must be checked by the owner before a release is tagged. The flow is: build, verify (tests plus live drive), write the report, then STOP and wait for the owner. Never tag or publish a release while manual boxes are unchecked, unless the owner explicitly says to tag in that message.
- Never run destructive git commands (force push, history rewrite, branch deletion). Never touch files outside this repository. Never install global packages.

## Working agreements
- Keep `docs/CHANGELOG.md` current. Keep `docs/screenwriting-app-plan.md` current when scope changes.
- Commands: `pnpm install`, `pnpm dev`, `pnpm test`, `pnpm lint`, `pnpm build`. Update this list if they change.
- Import classifier tuning (owner decision, Oct 12, 2026): no standalone classifier quality rounds. When a real import misreads lines, the owner adds that file to `test-corpus/`; treat each new corpus file as a bug report, add accuracy tests against it, and fix what it exposes.

## Current phase
v0.3 "Plan" shipped; v0.3.1 fixes shipped (Oct 12, 2026): PDF import repairs from the owner's first real corpus file (paragraph merging, page numbers, FD title pages, (MORE)/(CONT'D) re-join, Shot in review) plus the orphaned-planning-entries banner with re-attach. Reports: `docs/releases/v0.3-report.md`, `v0.3.1-report.md`. Releases v0.1.0 to v0.3.1 at https://github.com/rmbeeler1/spec/releases. Outstanding: three manual feel-check boxes in `docs/acceptance/v0.3.md` are the owner's. Next: v0.4 "Produce" (revision mode, scene numbering, reports, dual dialogue, writing stats); `docs/acceptance/v0.4.md` is drafted and awaits owner confirmation before any v0.4 code.
