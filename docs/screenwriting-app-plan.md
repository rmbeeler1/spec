# Open-Source Screenwriting App: Scope and Plan

Status: Planning (Oct 12, 2026). No code written yet. This doc is the handoff to Claude Code.

---

## 1. Vision

A free, open-source, offline-first desktop screenwriting app for Windows, macOS and Linux that:

1. Formats scripts to industry standard automatically, with correct page breaks (dialogue continuity, MORE/CONT'D) as a non-negotiable fundamental.
2. Treats Fountain (plain text) as the native source of truth, so scripts are never locked in.
3. Imports messy scripts from Word (.docx), Markdown and plain text and infers the correct element types.
4. Ships the planning tools pros pay for: beats, acts, index cards / corkboard, outline lanes.
5. Grows into storyboards, revision mode and collaboration later.

Positioning: "Fade In's reliability and one-time ownership, Final Draft's Beat Board and outlining, Beat's Fountain-first design, on every platform, for free." Beat's own README states there is no good Fountain editor on Windows. That is the opening.

Primary use is personal for the foreseeable future. License: MIT (decided, no further discussion needed). Do not copy code from Beat or KIT Scenarist (GPL) so the MIT license stays clean.

---

## 2. Competitive landscape (research summary, Oct 2026)

| Tool | Model | Strengths | Weaknesses |
|---|---|---|---|
| Final Draft 13 | $249 one-time | Industry-standard .fdx, Beat Board, Outline Editor lanes, Revision Mode, page locking, Navigator | Windows crashes are a constant complaint, expensive, clunky |
| Fade In | ~$80 one-time | Fast, stable, cross-platform incl. Linux, FDX/Fountain/PDF, revision tracking | Dated UI, weak outlining, no beat board |
| Arc Studio Pro | $69-99/yr | Modern UI, outlining, "Stash" for cut material, storylines | Subscription, cloud-dependent (cannot create a script offline), Courier Prime controversy |
| WriterDuet | Free 3 scripts, then sub | Best real-time collaboration | Slow, paid tiers for the features people want |
| Highland | Sub (Mac/iOS only) | Fountain-native, minimal | Apple only |
| Beat (OSS, GPL) | Free, macOS only | Best open-source Fountain editor, outlining, scene coloring, FDX import/export | Objective C, Mac only |
| KIT Scenarist (OSS) | Free | Research, cards, script, stats modules; imports FDX/DOCX/Fountain/Trelby | Less polished, slow update cadence |
| Trelby (OSS) | Free, Win/Linux | Simple, exports FDX/Fountain/PDF | Old, minimal |
| Celtx / StudioBinder | Sub | Pre-production (breakdowns, scheduling) | Production tools first, writing second |

### What users complain about (Reddit r/Screenwriting, reviews)
- Crashes and lost work (Final Draft on PC above all).
- Subscriptions and "renting" software.
- Cloud tools that do not work offline.
- Slowness and lag in the editor.
- Font lock-in and formatting subtleties (Courier Final Draft vs Courier Prime vs Courier Screenplay).
- Import from Word is painful everywhere.

### What users praise / the current "wish list" features
- Beat Board (freeform cards with flow lines, colors, images).
- Outline Editor with multiple lanes (acts, sequences, scenes, storylines).
- Scene / character navigators with filtering.
- Stash / scrap area for cut material.
- Revision mode: revision sets with colors, page locking, A-pages, omitted scenes, asterisks.
- Typewriter / focus mode, dark mode.
- Writing stats and goals.
- Real-time collaboration.
- Templates: feature, TV hour, TV half-hour, stage play, audio drama, comic.
- Script reports: scene list, character dialogue counts, locations, day/night breakdown.
- Reliable PDF output and .fdx round-trip.

---

## 3. Target users

1. Primary: solo writers on Windows and Linux who want a free, stable, offline tool (underserved).
2. Secondary: Mac writers who want Beat-style Fountain editing with more planning tools.
3. Tertiary: writers migrating from Word / Google Docs / Markdown drafts.

Non-goals for v1: production scheduling, budgeting, breakdowns, mobile apps, AI writing features.

---

## 4. Recommended architecture

### Stack (decided: easiest lift, newcomer friendly, all TypeScript)
- **Shell: Electron** (via electron-vite or electron-forge scaffold). One language end to end, largest community, best tutorial coverage. Tauri was considered and rejected for now because it adds a Rust layer; the separate core library keeps that door open later.
- **Frontend: React + TypeScript.** Editor built on **Tiptap** (a friendly wrapper around ProseMirror) with custom node types for each screenplay element. Tiptap over raw ProseMirror because its docs and examples are far more approachable.
- **Core library (`packages/core`): framework-agnostic TypeScript.** Fountain parser/serializer, document model, pagination engine, FDX import/export, DOCX/MD/PDF importers. No Electron or React imports allowed in this package, so it can run in tests, a CLI, or a browser.
- **PDF export:** pdf-lib (pure JS). Bundle Courier Prime (open license) and allow user font choice.
- **Storage:** Project folder on disk. `script.fountain` as source of truth plus `project.json` for cards, beats, notes, stash, metadata. Autosave with versioned snapshots. Crash-safe writes (write temp, then rename).
- **Tooling:** pnpm workspaces, Vitest for tests, ESLint + Prettier, GitHub Actions matrix build (Windows, macOS, Linux).
- **License:** MIT.

### Core document model
- Elements: Scene Heading, Action, Character, Dialogue, Parenthetical, Transition, Shot, Dual Dialogue, Lyric, Centered, Page Break, Section (`#`), Synopsis (`=`), Notes (`[[ ]]`), Boneyard (`/* */`), Title Page keys.
- Fountain is the on-disk format. Anything Fountain cannot carry (card positions, colors, beat links, storyboard images) lives in the sidecar project file keyed by stable element IDs (Beat uses a similar approach with hidden metadata).

### Pagination rules (must be right)
- US Letter, Courier 12pt, 6 lines per inch, standard margins (1.5" left, 1" right, 1" top/bottom).
- Element indents and widths per industry standard.
- Dialogue breaks: (MORE) / (CONT'D), never orphan a character cue, keep parentheticals with dialogue, scene headings never at page bottom.
- 55-ish lines per page target. Test against Final Draft output on sample scripts.

---

## 5. Feature scope by release

### v0.1 "Write" (MVP, first usable release)
Goal: a writer can draft a full feature script and send a correct PDF or FDX to anyone.
- Editor with auto element detection (Tab/Enter cycling, smart capitalization, character name autocomplete, scene heading autocomplete for INT/EXT, locations, time of day).
- Fountain open/save, live round-trip.
- Accurate pagination with on-screen page view and page count.
- PDF export, FDX export, Fountain export.
- Title page editor.
- Scene navigator sidebar (jump, reorder).
- Dark mode, focus/typewriter mode.
- Find/replace, spellcheck (OS or Hunspell).
- Autosave and snapshot history.
- Templates: feature film, TV hour, TV half-hour.

### v0.2 "Import" (the niche)
- Import .fdx (XML, element types are explicit).
- Import .docx (via mammoth or docx parsing) with an **element classifier**: uses indentation, centered alignment, ALL CAPS, line length, "INT./EXT." patterns, parentheses, transitions ending in "TO:", and context (a caps line followed by a non-caps line is likely Character then Dialogue). Show an import review pane where the user can bulk-fix misclassified lines before committing.
- Import .md / .txt / plain Fountain with the same classifier for non-Fountain text.
- Import .pdf (text-layer only, best effort, same classifier; many users only have PDFs).
- Round-trip tests against sample scripts from each source.

### v0.3 "Plan"
- Beat Board: freeform canvas of cards (title, body, color, tags), drag, group, flow lines, optional image attachment.
- Index cards / corkboard view: one card per scene, auto-generated from scene headings, synopsis editable, drag to reorder scenes (reorders script).
- **Pacing storyboard (the "storyboard" feature, text cards not images):** the same scene cards laid out left to right as a timeline. Each card shows estimated page length (from pagination), running time (1 page ~ 1 minute), INT/EXT, DAY/NIGHT, storyline tag, and a user-set tension/energy value. A strip view shows the energy curve across the whole script so pacing problems are visible at a glance. Act dividers come from `#` sections.
- Outline view with lanes: Acts, Sequences, Scenes, Storylines. Section markers (`#`, `##`, `###`) in Fountain map to acts/sequences.
- Stash: a scrap pane for cut material, draggable back into the script.
- Character navigator: dialogue counts, scenes per character, filter the script by character.
- Scene coloring and tagging.

### v0.4 "Produce"
- Revision mode: revision sets with colors, revision marks (asterisks), locked pages, A-pages, omitted scenes.
- Scene numbering.
- Reports: scene list, characters, locations, INT/EXT, DAY/NIGHT, dialogue counts.
- Dual dialogue.
- Writing stats and goals.
- Stage play, audio drama and comic templates.

### v0.5 and beyond
- Optional image attachments on cards (deferred; text-first per decision).
- Plugin/extension API.
- Optional collaboration via CRDT (Yjs / Automerge) over a sync service. This is the natural paid layer if it becomes a product.
- Localization.

---

## 6. Work plan to hand to Claude Code

### Phase 0: Repo and decisions (week 1)
- Scaffold Electron + React + TypeScript (electron-vite). Verify current library versions.
- Pick name. Repo structure: pnpm monorepo with `packages/core` and `apps/desktop`. Add MIT LICENSE file.
- Collect a test corpus: 10+ public-domain or self-written scripts in Fountain, FDX, DOCX, PDF. Include the Fountain spec sample files.
- Write `CLAUDE.md` with conventions, commands, and these scope boundaries.

### Phase 1: Core library (weeks 2-4)
- Fountain parser + serializer with full spec coverage and snapshot tests.
- Document model with stable element IDs.
- Pagination engine with unit tests against known page counts.
- FDX reader/writer.
- CLI: `fountain -> pdf`, `fountain -> fdx`, `fdx -> fountain` (useful on its own and for testing).

### Phase 2: Editor shell (weeks 5-8)
- Electron app skeleton, file open/save, recent projects, autosave, snapshots.
- ProseMirror schema for screenplay elements, keyboard model, autocomplete.
- Page view rendering, PDF export.
- Scene navigator, dark mode, focus mode, find/replace.
- Ship v0.1 as a GitHub release for all three OSes.

### Phase 3: Importers (weeks 9-11)
- DOCX importer + classifier + review pane.
- MD/TXT/PDF importers reusing the classifier.
- Corpus-driven accuracy tests; target 95%+ element accuracy on clean Word scripts, 85%+ on messy ones before manual review.
- Ship v0.2.

### Phase 4: Planning tools (weeks 12-16)
- Corkboard, Beat Board, outline lanes, stash, character navigator.
- Ship v0.3.

### Phase 5+: Revision mode, reports, collaboration.

### Definition of done for each phase
- Tests green, cross-platform build passes in CI (GitHub Actions matrix: Windows, macOS, Linux).
- A sample script round-trips (open, edit, save, export) without data loss.
- Changelog and docs updated.

---

## 7. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Pagination mismatch with Final Draft | Build the test corpus early; compare page counts and break points; treat parity as a release gate |
| Editor performance on 120-page scripts | Virtualize page rendering; measure keystroke latency; avoid full re-pagination on every keypress (incremental) |
| DOCX classifier accuracy | Review pane so users fix mistakes in bulk; collect anonymized misclassification examples with consent |
| GPL contamination | Do not read or copy Beat/KIT Scenarist source; use spec docs and clean-room implementation |
| Scope creep | Each release has a single verb (Write, Import, Plan, Produce) and ships before the next starts |
| Data loss / crashes (the #1 user complaint) | Atomic writes, autosave, snapshot history, crash reporter opt-in; plain-text format means nothing is ever truly lost |

---

## 8. Decisions log (Oct 12, 2026)

1. Stack: Electron + React + TypeScript + Tiptap. Chosen for easiest lift and newcomer friendliness.
2. Repo: personal GitHub account. Name: **Spec** (decided Oct 12, 2026).
3. Storyboards: text-based scene-by-scene pacing cards, not images. Folded into v0.3.
4. License: MIT. Personal use first; release optional.
5. Fonts (decided Oct 12, 2026): bundle Courier Prime only for v0.1. One font keeps pagination identical on every machine, which the Final Draft parity gate depends on. Detecting user-installed Courier variants is deferred.
6. Toolchain pins (Oct 12, 2026): TypeScript 5.9 (typescript-eslint does not support TS 6/7 yet) and Vite 7 (electron-vite 5 does not support Vite 8 yet). Revisit when those catch up.

---

## 9. Reference material to pull into Claude Code
- Fountain syntax spec (fountain.io).
- Final Draft FDX format (XML, paragraph Type attributes).
- Existing open-source parsers for reference (not copying): fountain-js, afterwriting, screenplain (Python), betterfountain (VS Code extension, TypeScript).
- Industry format references: Hollywood standard margins and element specs.
- Sample scripts: public-domain screenplays and the Fountain sample files.
