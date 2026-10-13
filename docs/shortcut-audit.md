# Keyboard shortcut audit

Last audited: October 13, 2026, after Cmd+Option+D (dual dialogue) turned out to be macOS's system-wide "show/hide Dock" shortcut and never reached the app.

Check EVERY new shortcut against this file before adding it. The rules that came out of the audit:

1. **Never use Cmd/Ctrl+Alt (Option) combinations.** On macOS several are system hotkeys that intercept before the app (Cmd+Opt+D = Dock, Cmd+Opt+Esc = Force Quit, Cmd+Opt+Space = Finder search, Cmd+Opt+8 = zoom when accessibility shortcuts are on). On Windows and Linux, Ctrl+Alt is AltGr: international layouts type real characters with it (Polish AltGr+S = s with acute, German AltGr+2 = squared sign, French AZERTY AltGr+3..6 = # { [ |), so any Ctrl+Alt binding steals typing from those writers.
2. **Never use Cmd+Shift+3/4/5/Q/6-on-touchbar** on macOS (screenshots, log out). This rules out Cmd+Shift+digit as a family.
3. The digit family (views, stash pane) is therefore **Cmd+Ctrl+digit on macOS** (unclaimed by the system; distinct from Ctrl+digit Space switching) and **Ctrl+Shift+digit on Windows/Linux** (unclaimed; no AltGr involvement).
4. Also avoid: Cmd+H/Cmd+Opt+H/Cmd+Q/Cmd+M (macOS app roles, already provided by the appMenu role), Cmd+Ctrl+F (macOS fullscreen, provided by the togglefullscreen role), Cmd+Ctrl+D (macOS dictionary look-up), Cmd+Ctrl+Space (emoji), Cmd+Ctrl+Q (lock screen), Ctrl+Shift+Esc (Windows Task Manager), Alt+F4/Alt+Tab/Alt+Esc/Ctrl+Esc (Windows system), Ctrl+Shift+U (Linux IBus unicode input).

## Current bindings (all verified against the lists above)

| Shortcut (mac / win-linux) | Action | Status |
|---|---|---|
| Cmd+N / Ctrl+N | New | clean |
| Cmd+O / Ctrl+O | Open | clean |
| Cmd+Shift+I / Ctrl+Shift+I | Import | clean |
| Cmd+S / Ctrl+S | Save | clean |
| Cmd+Shift+S / Ctrl+Shift+S | Save As | clean |
| Cmd+E / Ctrl+E | Export PDF | clean (macOS "use selection for find" is app-local, not system) |
| Cmd+F / Ctrl+F | Find and Replace | clean |
| Cmd+Shift+X / Ctrl+Shift+X | Send selection to stash | clean (was Cmd+Alt+X: AltGr+X types z-acute on Polish layouts) |
| Cmd+Shift+B / Ctrl+Shift+B | Toggle dual dialogue | clean (was Cmd+Alt+D: macOS Dock toggle) |
| Cmd+Ctrl+1..6 / Ctrl+Shift+1..6 | Views: Write, Corkboard, Pacing, Beat Board, Outline, Reports | clean (was Cmd+Alt+1..6: AltGr digits type # { [ etc. on AZERTY; and Cmd+Shift+3/4/5 would be macOS screenshots) |
| Cmd+Ctrl+7 / Ctrl+Shift+7 | Toggle stash pane | clean (was Cmd+Alt+S: AltGr+S types s-acute on Polish layouts) |
| Cmd+Shift+D / Ctrl+Shift+D | Toggle dark mode | clean (Mail's "send" is app-local) |
| Cmd+Shift+F / Ctrl+Shift+F | Toggle focus mode | clean |
| Cmd+Shift+T / Ctrl+Shift+T | Show structure | clean (browser "reopen tab" is app-local) |
| Cmd+/ / Ctrl+/ | Keyboard shortcuts | clean |
| Cmd+1..6 / Ctrl+1..6 (editor) | Set element type | clean (Safari tab switching is app-local; inside our own editor) |
| Tab, Shift+Tab (editor) | Cycle element type | clean |
| Shift+Enter (editor) | Line break in element | clean |
| Cmd+Z, Cmd+Shift+Z / Ctrl+Z, Ctrl+Shift+Z, Ctrl+Y | Undo, redo | clean (platform conventions) |

Menu roles (quit, hide, zoom, fullscreen, devtools) come from Electron's role system and carry the platform's own shortcuts; never rebind those.
