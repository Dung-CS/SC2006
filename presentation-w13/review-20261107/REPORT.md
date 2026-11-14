# Report: D-Fence W13 v2 (2026-11-07)

Deck: `D-Fence-W13-v2.pptx` (18 slides). Outline: `dfence-w13-v2.outline.md`.
Built by Claude with the `deck` skill through `deck_dark.py`. Renders: `D-Fence-W13-v2_png/`.
`postprocess.py` is no longer used. `D-Fence-W13.pptx` (v1) is unchanged.

Rebuild: `python deck_dark.py build dfence-w13-v2.outline.md -o D-Fence-W13-v2.pptx`, then
`verify` and `render` with the same wrapper.

## Comments and changes
| Your comment (v1 slide) | v2 slide(s) | Change |
|---|---|---|
| S1 full-page image, translucent black rectangle | S1, S18 | Full-bleed image with a 55% black scrim under the title. |
| S2 remove Authorities; persona cards with images | S2 | Three persona cards (Resident, Operations Manager, Crew): photo, name, role, goals, pain point. |
| S3 generic | removed | Removed. |
| S4 journey, one slide per stage, tracker, persona, screenshot | S3, S4, S6, S8, S9, S11 | Six stage slides. The six-stage chevron tracker sits at the top, with the current stage in green. Each slide has a persona card and an in-app screenshot. |
| S5-S6 reformat and update | S5 (Rank detail), S7 (Plan detail) | Tracker added. Weights and tiers are from `config/scoring.default.json`. Routing constraints include fixed dispatches, road-then-foot legs, cargo fit and the 4-hour shift. |
| S7 unclear | S12, S13 | S12 is BCE plus ports, with real folder and class names. S13 lists design patterns with their code locations. |
| S8 stack by purpose | S14 | Six groups (front end, back end, data, maps and APIs, CI/CD and hosting, testing), each with logos. |
| S9 unclear | removed | OIDC, App Settings secrets and Supabase moved into S14 and S15. |
| S10-S11 generic icons | S15, S16 | Real logos for each stage and test layer. |
| Team deck merge | S10, S12, S13 | Kept the work-order lifecycle, BCE ports and design patterns (see `MERGE.md`). |

## Claim checks
| Claim | Result |
|---|---|
| Dedup 50 m / 24 h | Confirmed in source; kept (S3). |
| Gemini vision model version | No version in source; the slide says "a Gemini vision model". |
| `IPestVisionStrategy` name | Confirmed; used on S13. |
| 17 SQL migrations | Confirmed. |
| 1,247 tests; 23 screen suites | Confirmed by a vitest run. |
| 15-minute lockout; crew checklist endpoint | Confirmed. |
| "30 s fingerprint" | Not found; removed. |
| "PPE enforced before departure" | Not found; removed. |

## Verify
`deck_dark.py verify D-Fence-W13-v2.pptx`: **PASS, 0 findings** (sparse-box WARNs only).

## Fixes made in this round
- White text sat on pale panels. Cause: the `roles:` hex values were unquoted, so YAML read
  `272036` as a number and dropped the override. The values are now quoted, and the deck is
  built through `deck_dark.py`, as v1 was.
- The tracker changed from large white tabs with tiny icons to a compact chevron row.
  `deck_dark.py` now keeps every chevron on the palette.
- The S10 lifecycle flow changed from numbered cards to chevrons, which removed six overlaps.

## Round 2 changes (2026-11-07)
- Personas are fictional: Rachel Lim (Operations Manager) and Suresh Pillai (Field Officer). Gemini made both portraits to match the role.
- "Cleaning Crew" is now "Field Officer", and the tracker says "Field team". The role covers mosquito and wildlife jobs.
- The tracker row is thinner (28% to 22% of the body). The persona card and the screens are larger.
- Residents and field officers are shown on phones: S3 (two report-form screens), S9 (job list, job detail) and S11 (report timeline, next to the manager's laptop). S8 shows two manager screens.
- S12 is a class-relationship swimlane built from the real imports: route, controller, port, repository, entity.
- `deck_dark.py` lets swimlane pills wrap to two lines and widens them.

## Open items for you
1. Both portraits are AI-generated. Check that they suit your audience.
2. S12 leaves out DispatchPlanService and OneMapRoadRoutingStrategy for space. The speaker notes name them.

## Round 3 (dispatch as full route)
- S8 now shows one full route (Central Sanitation: 2 crew, 4 ordered stops, 3h 28m) and its details page (crew, vehicle, 8-item logistics list). Captured read-only by `capture-dispatch-route.mjs`; `stack_dispatch_details.py` stacks the crew/vehicle and logistics sections.
- The vehicle reference photo does not load on the live site, so that block is left out of the S8 image.
- S8 headline, points and notes, and the S9 headline, now describe a dispatch as a route.
