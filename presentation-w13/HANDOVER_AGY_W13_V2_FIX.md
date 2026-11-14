# Handover to agy: D-Fence W13 v2, fix round

Do the work yourself. Do not spawn subagents. Read `HANDOVER_AGY_W13_V2.md` (same folder) first:
its goal, owned files, do-not-touch list, live-site rules and Rules section still apply.

## State
v2 is built: `D-Fence-W13-v2.pptx` (18 slides) from `dfence-w13-v2.outline.md`, post-processed by
`review-20261107/postprocess.py`. Renders: `D-Fence-W13-v2_png/slide-NN.png`. Assets: `assets/v2/`.
Alfred reviewed every render. The failures below must be fixed. Slide numbers are v2 slides.

## Fixes (in priority order)
1. **S1 cover.** Full-bleed hero image across the whole slide. Over it, a black rectangle
   at about 50-60% transparency covering the whole slide (or at least the text half), and white title text
   on top. Remove the purple split panel. Apply the same treatment to S18 (close).
2. **Journey tracker on every stage slide.** The six-stage tracker (Report, Rank, Plan, Review,
   Dispatch, Resolve) must appear at the top of S3-S11, with the current stage highlighted. S5,
   S7 and S10 have no tracker now; they are detail slides for stages Rank, Plan and Dispatch, so
   highlight those stages.
3. **Persona cards and overlaps.** S6 and S8: title text overlaps the persona photo. Lay out each
   stage slide as tracker (top), title, persona card (left column: photo, name, role, one line on
   what they do at this stage), screenshot (right). Nothing may overlap. S2: render each stakeholder
   as one compact persona card (photo, name, role, goal, pain point), three cards side by side,
   not a 3x3 grid. Use these persona names:
   - Manager: the name the app shows for `manager-ychow.jpg`, as it appears in the screenshots.
   - Crew: the name matching `crew-*.jpg` in `client/public/visuals/staff/credits.json`.
   - Resident: pick a name that fits the resident photo. Record the photo's source,
     author and licence in `review-20261107/CREDITS.md`.
   Remove the line "Source: Resident UAT and field trials". No such source exists.
4. **Right screenshot per stage.** Each stage slide must show that stage:
   - S4 (Rank): `manager-ops-dashboard.png` or `manager-cluster-detail.png` (not the dispatch page).
   - S6 (Plan): `manager-dispatch-cards.png`.
   - S7: do not repeat the S6 screenshot. Use a routing diagram or the cluster/route map.
   - S8 (Review): `manager-dispatch-details.png` (the details page).
   - S9 (Dispatch): the crew view with real jobs and the checklist. The current image shows the
     empty "Nothing here" state; recapture a populated crew My Jobs view read-only, or crop
     `crew-jobs-desktop.png` / `crew-my-jobs.png` if they show jobs. Never show an empty state.
   - S10: no demo e-mail addresses visible; crop or pick another shot.
   Remove "PPE enforced before departure" unless `src/` or `client/` shows it.
5. **Real logos, not generic icons.** On S13, S15 and S16, replace every generic flat icon and every
   wrong icon (the PHP/C#/JS icon) with the tool's real logo, or with a small screenshot of that
   stage in action. Tools: GitHub Actions, actionlint, PostgreSQL/PostGIS, Vitest, React Testing
   Library, Playwright, axe-core, Azure App Service, Microsoft Entra (OIDC), Supabase. Fetch logos
   from official sources or Simple Icons (CC0) with PowerShell `Invoke-WebRequest`. Save them to
   `assets/v2/logos/`. Record each source in `review-20261107/CREDITS.md`. On S13 (design
   patterns), use no logos: use small code-name labels or a simple diagram instead.
6. **S14 tech stack grouped by purpose.** Six labelled groups: Front end, Back end, Data, Maps and
   external APIs, CI/CD and hosting, Testing. Put the real logos and names under each group. Only list
   tools that the repo uses (check `package.json`, `client/package.json` and `.github/workflows/`).
7. **British English** in all slide text: optimiser, normalised, prioritise, and so on. Write
   "Medium", not "Med". Fix the wrap of "WorkOrderLifecycleController" on S12 by using a smaller
   label box or a line break at a camel-case boundary.
8. **Verify claims** against the source, and correct or drop each one that fails. Record the result in the report:
   - dedup "50 m and 24 h" and the vision model name (S3)
   - "17 SQL migrations" (S12, S15, S16)
   - "1247 tests" and "23 screen test suites" (S15, S16)
   - `IRouteStrategy` and `IVisionStrategy` names (S13)
   - "3.2 MB per 5 min" and "30 s fingerprint" (S17)

## Build and self-check
Edit the outline and `postprocess.py`, then run `deck.py check`, `build`, postprocess,
`verify` and `render` into `D-Fence-W13-v2_png/`. Open every PNG and check:
- each fix above is in place
- text is 12 pt or larger
- no overlap or overflow
- the right stage is highlighted

Fix and rebuild until all checks pass. Keep memory use low: close the browser after capture, and do not run more than one
build or render at once.

## Report
Write `review-20261107/REPORT.md`. Per fix 1-8, say what changed and on which slide.
Then list the claim checks (claim, source file, result), the captures and logos (path, source,
date), the `verify` output and any open issues. Print a short summary at the end.
