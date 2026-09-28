# LearnDjango Design Notes

Internal design contract for the interactive Django learning app.
Modeled on the product shape of `pcottle/learnGitBranching` (sandbox + levels + golf).

## Product analog

| learnGitBranching | LearnDjango |
| --- | --- |
| Commit DAG visualization | Multi-lane architecture graph (URL → View → Model → Template) |
| Git commands in terminal | Django-shaped commands (`startapp`, `model`, `url`, `request`, …) |
| Levels with goal tree | Levels with declarative project-state goals |
| Command golf | Command golf (fewest commands) |
| `undo` / `reset` | `undo` / `reset` |
| Sandbox mode | Sandbox mode |
| Level builder / import | `levels`, `hint`, shareable level JSON |
| 100% client-side | 100% client-side |

## Style anchor

Technical blueprint of a request pipeline crossed with a restrained ops terminal.
Feels like a printed systems diagram from a CS textbook that came alive —
not a startup landing page.

## Palette

| Token | Hex | Role |
| --- | --- | --- |
| stage | `#0B1411` | App background |
| panel | `#121C18` | Terminal / elevated panels |
| edge | `#1E2C26` | Borders, lanes |
| ink | `#C7D4CD` | Primary text |
| mute | `#7A8F86` | Secondary text |
| green | `#44B78B` | Django accent, success, active path |
| deep | `#0C4B33` | Node fills, headers |
| amber | `#D4A84B` | Goal markers, golf score |
| alert | `#C45C4A` | Errors, failed goals |
| paper | `#E6EFEA` | High-contrast captions |

## Typography

| Role | Stack |
| --- | --- |
| Teaching prose | Georgia, "Times New Roman", serif |
| Terminal / nodes / code | Consolas, "Courier New", monospace |
| UI chrome | system-ui, sans-serif |

Scale: 11px captions → 13px body → 16px titles → 22px level title.
Teaching prose max ~62ch. Monospace for anything the learner types or sees as code.

## Layout

```
+--------------------------------------------------+
| LearnDjango   [levels] [sandbox]   golf  3/5      |
+--------------------------------------------------+
|                                                  |
|   multi-lane architecture graph (SVG)            |
|   URL | VIEW | MODEL | TEMPLATE                  |
|   live wiring + request pulse                    |
|                                                  |
+--------------------------------------------------+
| Level objective (serif) / hint strip             |
+--------------------------------------------------+
| terminal history                                 |
| $ startapp blog                            1/4   |
| > _                                              |
+--------------------------------------------------+
```

- Header height ~44px, fixed.
- Graph fills remaining vertical space (~55%).
- Terminal occupies the lower third, always focused.
- Mobile: stack graph above terminal; keep the input bar sticky.

## Signature moments

1. **Wiring** — a successful structural command draws a new node and its edge with a short stroke animation.
2. **Request pulse** — `request /path/` animates a packet along URL → View → Model → Template → Response.
3. **Level clear** — goal markers flip to checks, golf score prints (`par 4 · you 3`).

## Curriculum series

1. **Foundations** — project, app, model, migrate, route, render, request
2. **ORM** — create, filter, select_related, showsql
3. **Request cycle** — middleware, auth gate, form POST
4. **Admin & polish** — register admin, class-based view

## Principles

- One accent (Django green). Amber only for goals/golf. No gradients on chrome.
- Structure encodes meaning: lanes, edges, goal pins. No decorative cards.
- Errors name the fix. Empty graph says what to type first.
- Motion only after user action (command, request, clear).
- Reduced motion: skip pulse/wiring animation, keep final state.

## File map

| File | Responsibility |
| --- | --- |
| `index.html` | Shell markup |
| `css/styles.css` | Tokens + layout |
| `js/engine.js` | Project state machine + command parser |
| `js/levels.js` | Level definitions + goal predicates |
| `js/viz.js` | SVG architecture graph renderer |
| `js/app.js` | Terminal loop, dialogs, golf, persistence |
| `tests/engine.test.js` | Node unit tests for the engine |
