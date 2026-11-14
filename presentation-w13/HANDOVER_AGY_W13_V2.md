# Handover to agy: D-Fence W13 deck, version 2

Do the work yourself. Do not spawn subagents.

## Goal
Redraft the W13 deck to Yen Kit's comments, and merge the useful content from the team's draft.
Produce a new outline and a new built deck. Do not overwrite the current deck.

## State on disk
- Current deck: `smart_nation/dengue/presentation-w13/D-Fence-W13.pptx`
  (built by the `deck` skill from `dfence-w13.outline.md`; build log `D-Fence-W13.pptx.build.json`;
  renders in `D-Fence-W13_png/`; assets in `assets/` and `D-Fence-W13_assets/`).
- Team draft (23 slides, generic in places): `review-20261107/team-source/D-Fence-Presentation.pptx`.
  Markdown of both decks: `review-20261107/md/*.md` (read these, not the pptx).
- Deck skill: `.claude/skills/deck/SKILL.md` (read it in full first). Commands:
  `python .claude/skills/deck/deck.py check|build|verify|render ...`
- App source and docs: `smart_nation/dengue/` (`REQUIREMENTS.md`, `HANDOVER.md`, `STATUS.md`,
  `CI-CD.md`, `DESIGN-PATTERNS.md`, `docs/ROUTING-ALGORITHM-STE100.md`, `src/`, `client/`).
- Latest app state (2026-10-31, commit `29ffe20`): streamlined dispatch cards (HQ and team,
  crew with portraits, effort breakdown against the 4-hour cap, ordered stops); a "View & Edit
  Dispatch Details" page (editable assignment, vehicle cargo specs, stop progress, logistics
  checklist); fixed dispatches (`isFixed`) excluded from auto-replanning; crew checklist on My Jobs;
  road-then-foot routing; real fleet models (Toyota Hiace/Hilux, GBD plates).
- Screenshots on hand (check each is current before use): `smart_nation/dengue/demo-shots/`,
  `screen-shots-after/`, `screen-shots/`. Portraits: `client/public/visuals/staff/`
  (`manager-*.jpg`, `crew-*.jpg`, see `credits.json`). Hero images: `client/public/visuals/hero/`.

## Files you own
- `smart_nation/dengue/presentation-w13/dfence-w13-v2.outline.md` (new)
- `smart_nation/dengue/presentation-w13/D-Fence-W13-v2.pptx` (new) and its build json / render folder
- `smart_nation/dengue/presentation-w13/assets/v2/` (new: crops, screenshots, persona images)
- `smart_nation/dengue/presentation-w13/review-20261107/` (scratch, scripts, report)

## Do not touch
`D-Fence-W13.pptx`, `dfence-w13.outline.md`, anything under `.claude/` or `.agents/`, `memory/`,
`soul.md`, `CLAUDE.md`, `AGENTS.md`, app source under `smart_nation/dengue/src` and `client/`.
Live site: read-only browsing for screenshots. Do not submit, assign, verify, edit or delete
any record on `https://dfence-sc2006.azurewebsites.net`.

## Remaining steps
1. **Merge scan.** Read both Markdown files. List the team-deck content that is specific and
   true to the repo and missing from the current deck. Candidates: work-order lifecycle
   (Completed vs Verified, transition table, `src/control/WorkOrderTransitionTable.ts`); BCE with
   ports (`src/boundary`, `src/control`, `src/entity`, `src/ports`, `src/persistence`); design
   patterns (Strategy for normalisation/routing/vision, Template Method ingestion, Observer,
   Adapter, Repository); two-input data flow; operational limits. Verify each against the source
   before using it. Drop generic lines. Write the list to `review-20261107/MERGE.md` with the
   source file for each kept item.
2. **Apply Yen Kit's comments** in the new outline (numbers are current-deck slides):
   - S1: full-bleed image; a translucent black rectangle over it so the title text has contrast.
   - S2: three stakeholders only (Resident, Operations Manager, Crew). Remove Authorities: there
     is no authority account. Each stakeholder gets a persona card with a real persona image
     (name, role, goal, pain point). Use the staff portraits for manager and crew; find or
     source a licensed resident portrait and record its credit.
   - S3 (WHAM, "Four outcomes"): remove.
   - S4: replace with one slide per journey stage, six slides:
     1. Resident reports / report created from API
     2. Server ranks
     3. Server plans optimal dispatch route
     4. Manager reviews
     5. Crew dispatched
     6. Resident / manager sees update
     Put the full six-stage flow at the top of each of these slides as a tracker, with the
     current stage highlighted. Each slide has the acting persona's card and an in-app
     screenshot of that stage.
   - S5 (scoring) and S6 (routing): keep content, re-format to the journey-tracker pattern
     above (they map to stages 2 and 3; merge or follow on as the stage's detail slide). Update
     content to the latest requirements and code (e.g. fixed dispatches, road-then-foot,
     vehicle cargo fit, 4-hour effort breakdown). Check every number against `config/` and `src/`.
   - S7: its purpose is unclear. Make it a BCE architecture slide (layers with real folder
     names and example classes), merged with the team's ports view. No tech logos on it.
   - S8: group the tech stack by purpose: Front end, Back end, Data, Maps and external APIs,
     CI/CD and hosting, Testing. Logos under each heading.
   - S9 ("Two managed services"): purpose unclear. Fold its facts (OIDC, secrets in App Settings,
     Supabase Singapore) into the CI/CD slide or the hosting group; remove the standalone slide.
   - S10 (CI/CD) and S11 (test layers): replace generic icons with the tool's real logo
     (GitHub Actions, actionlint, PostgreSQL, Vitest, Testing Library, Playwright, axe, Azure)
     or a small screenshot of that stage in action (e.g. Actions run page, test output). Use
     what is on disk or capture it; record sources.
   - Add the kept merge items from step 1 where they fit (likely: lifecycle slide after
     "Crew dispatched", design patterns slide after BCE).
   - Keep S12 (limits) and S13 (close) unless a comment above changes them.
3. **Screenshots.** Use the newest screenshots that show the 2026-10-31 UI. Where none exists
   (dispatch cards, details page, crew checklist), capture from the live site with Playwright
   (credentials are documented in `smart_nation/HANDOVER.md`), read-only. Save to
   `assets/v2/`. Never fake a screenshot.
4. **Build.** `deck.py check` the outline, fix every issue, then `build` to
   `D-Fence-W13-v2.pptx`, `verify`, and `render`. If a needed component does not exist in the
   deck skill (e.g. full-bleed image with overlay, persona card, stage tracker), compose it
   from existing components or post-process with a python-pptx script in `review-20261107/`.
   Do not edit the deck skill.
5. **Self-check.** Open every rendered PNG. Check: text >= 12 pt, no grey body text, no
   overflow or overlap, tracker shows the right stage, every screenshot matches its stage,
   titles are one-sentence action titles in British English. Fix and rebuild.

## Rules
- British English, short active sentences. Numbers must trace to the repo.
- No backslashes in Bash heredocs; write scripts with file tools. ASCII-only stdout.
- Keep the template, palette and Segoe UI font of the current deck.

## Report format
Write `review-20261107/REPORT.md`: per comment (S1-S11) what changed and on which new slide;
merge items kept and dropped (with reason); screenshots used or captured (with path and
date); verify output; open issues. Print the same summary at the end.
