# Spec

A free, open-source, offline-first desktop screenwriting app for Windows, macOS and Linux.

**Status: pre-alpha.** Phase 0 (project scaffold and test corpus). Nothing usable yet.

## Why

- Scripts live in plain-text [Fountain](https://fountain.io) files on your disk. No lock-in, no cloud requirement, no subscription.
- Industry-standard formatting and pagination (Courier 12pt, correct margins, MORE/CONT'D on dialogue breaks) as a non-negotiable fundamental.
- Planning tools the paid apps charge for: corkboard, beat board, outline lanes, pacing storyboard.
- Data safety first: atomic writes, autosave, snapshot history.

The full scope and release plan live in [docs/screenwriting-app-plan.md](docs/screenwriting-app-plan.md).

## Repo layout

- `packages/core`: pure TypeScript library (Fountain parser, document model, pagination, import/export). No Electron or React imports.
- `apps/desktop`: the Electron + React app.
- `test-corpus/`: sample scripts used as test fixtures (see `test-corpus/SOURCES.md`).
- `assets/fonts/`: bundled Courier Prime (SIL Open Font License).

## Development

Requires Node 22+ and pnpm 12+.

```sh
pnpm install   # install dependencies
pnpm dev       # run the desktop app with hot reload
pnpm test      # run tests
pnpm lint      # lint
pnpm build     # typecheck and build
```

## License

MIT. See [LICENSE](LICENSE).
