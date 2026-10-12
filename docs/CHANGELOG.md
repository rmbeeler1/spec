# Changelog

All notable changes to Spec are recorded here.

## Unreleased

### Phase 0 (October 12, 2026)

- Named the app Spec.
- Scaffolded the pnpm workspaces monorepo: `packages/core` (pure TypeScript library) and `apps/desktop` (Electron + React + TypeScript via electron-vite).
- Pinned the toolchain: TypeScript 5.9, Vite 7, electron-vite 5, Electron 44, React 19, Vitest 5, ESLint 10 with typescript-eslint, Prettier. TypeScript 6/7 and Vite 8 are out for now because typescript-eslint and electron-vite do not support them yet.
- Added GitHub Actions CI matrix (Windows, macOS, Linux): install, lint, test, build.
- First core utilities with tests: line-ending normalization and line splitting.
- Bundled Courier Prime (regular, bold, italic, bold italic) with its SIL Open Font License in `assets/fonts/courier-prime/`. Decision: bundle Courier Prime only, no detection of user-installed Courier variants for v0.1.
- Collected the test corpus in `test-corpus/`: the three official Fountain sample scripts, sixteen official per-element fixture files, four self-written pagination stress scripts, Big Fish in FDX, and generated DOCX/PDF variants. Provenance in `test-corpus/SOURCES.md`.
