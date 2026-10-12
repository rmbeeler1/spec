# Test corpus sources

Every file in this folder is a test fixture. This doc records where each one came from and why it is safe to include in an MIT-licensed repo. All downloads fetched October 12, 2026.

## fountain/spec-samples/ (official Fountain sample scripts)

These are the sample scripts the Fountain community distributes for testing parsers. The screenplays themselves are by their credited authors and are shared by them as test material, not as public domain works. We use them as fixtures only and never ship them in the app.

| File | Source | Notes |
|---|---|---|
| Big Fish.fountain | github.com/nyousefi/Fountain (MIT repo), FountainTests/ | John August's production draft, the canonical Fountain sample |
| Brick And Steel.fountain | same repo (distributed as Brick And Steel.txt) | Stu Maschwitz's syntax demo script |
| The Last Birthday Card.fountain | github.com/ZoomQuiet/ZoomQuiet.io mirror of the official sample | Stu Maschwitz's short script sample |

## fountain/spec-fixtures/ (official per-element test files)

Sixteen small files from the FountainTests suite in github.com/nyousefi/Fountain (MIT): Boneyard, CenteredText, Dialogue, DualDialogue, ForcedElements, Indenting, MultilineAction, Notes, PageBreaks, SceneHeaders, SceneNumbers, SectionHeaders, Sections-Complex, Simple, Synopses, Transitions. Only data files were taken from that repo, no code.

## fountain/scripts/ (self-written, public domain)

Written for this project and released to the public domain. Designed so pagination tests can assert exact break points.

| File | Purpose |
|---|---|
| kitchen-sink.fountain | Every Fountain element type at least once, including dual dialogue, forced elements, boneyard, notes, sections, synopses, page break |
| two-page-minimal.fountain | Tiny script for fast smoke tests |
| dialogue-break-stress.fountain | Three 60-sentence numbered speeches that force (MORE)/(CONT'D) page breaks |
| orphan-stress.fountain | 30 blocks of growing action padding that sweep a scene heading and character cue across every position near a page bottom |

## fdx/

| File | Source | Notes |
|---|---|---|
| Big Fish.fdx | github.com/intrusive-memory/SwiftCompartido (MIT repo), Fixtures/bigfish.fdx | Official Final Draft version of the Big Fish sample, for FDX import/export and pagination parity tests |

## docx/ and pdf/ (generated locally)

Generated on macOS from the Fountain text, to simulate scripts that live in Word files or text-layer PDFs (the v0.2 import cases):

- docx/: `textutil -convert docx` of Big Fish, Brick And Steel, kitchen-sink
- pdf/: `cupsfilter` of Big Fish, Brick And Steel

These are unformatted (no screenplay indentation), which matches the messy real-world input the import classifier must handle. For formatted variants, export from a real screenwriting tool later and add them here with a note.

## Still wanted (follow-ups)

- Public-domain feature scripts as real-world fixtures: Night of the Living Dead, Plan 9 from Outer Space and similar PD films. The usual hosting sites were unreachable when collecting; find stable sources and add the text here.
- FDX files exported from Final Draft itself with known page counts, for the pagination parity release gate.
- DOCX files formatted the way writers actually format scripts in Word (centered cues, indented dialogue), for classifier accuracy tests.
