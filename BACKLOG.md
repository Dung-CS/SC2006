# Dengue Prioritiser — Feature Backlog

## Current delivery delta - 2026-10-29 (dispatch map interaction, v0.19)

### Show filtered dispatch tasks and proposals on the bounded map
- **Status:** Implemented; local checks passed; browser and deployment validation pending.
- **Scope:** Dispatch map, dispatch screen, proposal/unplanned response metadata, map tests and focused backend regressions.
- **Acceptance:** Routes, Horizon Unassigned / Committed and Daily Proposals views change the mapped tasks and route lines appropriately. Team and Job Type filters use checkbox groups with All, multi-select and explicit none-selected behaviour. Task callouts show pest type, task type, priority, location, photo and assigned team without generated task headings. Photos load only after selection through the existing authenticated report/image path; missing incident photos use a labelled reference fallback. Map zoom and pan remain within the Singapore extent, and polling retains zoom and selected task while updates are reconciled by task ID.
- **Metadata and routing:** Unplanned tasks expose serialized source coordinates and optional `mapClusterId`. Official cluster proposals expose display-only `mapPoint` from the source boundary centroid; absent boundary geometry yields no invented point. Source-report proposal `point` remains exact. Route calculation, area access, admission and resource limits are unchanged.
- **Known local checks:** Full suite: 1,152 passed / 58 SQL tests skipped; typecheck and build passed; clean package extraction smoke passed. Focused metadata tests: 33 passed across two files. `DFENCE_TEST_LIVE_DB=false`.
- **Pending:** Browser interaction/photo checks and deployment review.

## Current delivery delta - 2026-10-29 (unified authority operations and concise cards)

### Dispatch authority cases through qualified crews
- **Status:** Done (9891e16 deployed; live API and WebDriver verified).
- **Scope:** `../notes/UNIFIED_OPERATIONS_UI_20261029.md`; requirements v0.18. Wildlife, AVS birds and BeeWasp enter ordinary creation, assignment recommendations and route planning. Authority Response is an explicitly recorded Inspection capability; generic inspection does not qualify staff.
- **Acceptance:** No authority-only case loss or required new referral. Preserve exact source points, capability/staffing, road/walking, four-hour and fleet constraints. Retain historical referral records. Remove selected-day urgent and external-referral sections; necessary lists use image cards. Staff/vehicle/task/report titles omit IDs, fixture prefixes and enum tokens; metadata/descriptions retain identity and demo provenance.
- **Known checks:** Final local 1,149 passed / 58 SQL tests skipped; typecheck/build and CI package/deploy/hash checks passed. Live WebDriver, desktop/mobile cards and all 103 staff titles passed; six former authority cases routed and two access-unverified.
- **Release evidence:** Migrations 014/015 recorded; 20 owned AuthorityResponse staff and five vans provisioned with existing readiness preserved. See scratchpad/unified-ops-20261029/DEPLOYMENT.md.
- **Limits:** Existing crew/logistics defaults remain provisional. Supporting crew identities remain a model gap. No savings or global-optimum claim.

## Current delivery delta - 2026-10-29 (Soon Lee dispatch eligibility)

### Require source evidence for non-mosquito site dispatch
- **Status:** Done; deployed and live-verified on `738078ba8b26adda1912f97704da71e5a533b408`; [Actions run 40738506469](https://github.com/Dung-CS/SC2006/actions/runs/40738506469) passed.
- **Entrypoints:** Dispatch proposal generation and shared route-input construction; requirements v0.16.
- **Acceptance:** Keep score-only non-mosquito locality proposals out of executable dispatch; preserve verified report proposals at their source points, explicit work orders and official mosquito cluster proposals; reject spoofed source IDs; preserve source records and existing staffing/availability rules.
- **Evidence:** Live Soon Lee now has one SouthWest mosquito fogging task, zero other Soon Lee tasks and zero score-only non-mosquito route/unplanned tasks. Five routes / 12 tasks; live ETA/resource/priority/browser checks passed. Local suite 1,063 passed / 58 SQL skipped; typecheck/build/diff/package smoke passed. See `scratchpad/routing-implementation-20261028/SOON_LEE_DEPLOYMENT.md` and `SOON_LEE_REVIEW.md`.
- **Open:** Broader compatible-visit bundling is not implemented. Configured local sanitation/general-inspection pools remain unavailable; no regional cap or staffing rule was added. No savings claim.

## Current delivery delta - 2026-10-28 (routing implementation)

### Bounded road-cost planning and fresh snapshots
- **Status:** Deployed and live-verified on `a8ef7ed072eed77eb27a095b739b8e505d3e5881`; [Actions run 40703499843](https://github.com/Dung-CS/SC2006/actions/runs/40703499843) passed test and production deployment.
- **Entrypoints:** `dengue/src/control/RouteOptimizationService.ts`, `dengue/src/control/routing/OneMapRoadRoutingStrategy.ts`, `dengue/src/control/DispatchPlanService.ts`, `dengue/src/control/DispatchRouteInputs.ts`, `dengue/src/boundary/http/WorkOrderRoutes.ts`.
- **Expected actions:** review provisional crew, logistics and demo-fleet values; treat benchmark values as synthetic fixture results only.
- **Acceptance:** compare bounded candidate allocations on consistent actual directed-road duration; accept only strict road-time improvements preserving served IDs and whole-plan constraints; expose ordered leg ETAs; cap concurrency and cancel queued work; refresh five-minute snapshots in the background; retain last good plans; keep committed work out of new allocation with clear reasons.
- **Evidence:** `scratchpad/routing-implementation-20261028/DEPLOYMENT.md`, `deployment-verification.json`, `deployed-dispatch.png`, `VERIFICATION.md`, `REVIEW.md`, and `synthetic-benchmark.md`. Offline 1,061 pass / 58 SQL skips; typecheck, production build, diff check and clean-package smoke pass. Live route, ETA, resource, priority, map and zoom checks passed; no page errors. Frozen fixture comparison: 900 s to 120 s for `synthetic-j1`; separate cross-route unit fixture: 320 s to 150 s with the same three task IDs. Neither is operational savings evidence.
- **Open:** Supporting crew identities are not represented. No live-GPS rolling optimisation, exact 3D packing, global-optimum proof or strict provider API quota is claimed. Live timings are bounded observations, not guarantees; no operational savings claim.

## Current delivery delta - 2026-10-28 (routing research)

### Compile routing best practices and an evaluation plan
- **Status:** Done (research review-ready after root QA and resolved material critique; implementation remains separate).
- **Entrypoints:** `../research/routing-20261028/ROUTING_RESEARCH.md`, source ledgers and reproducible suitability calculation.
- **Expected actions:** review current algorithm and prioritised improvements before implementation.
- **Acceptance:** distinguish code findings, primary evidence and design judgement; disclose channel depth/access; preserve hard road/resource/priority constraints; define matched benchmark and independent feasibility checks.
- **Evidence:** web/official documentation and Perplexity discovery; three Consensus queries (60 raw / 54 unique records); four primary full texts and one supplemental review read. NTU search reachable; bounded publisher retry after Microsoft sign-in still returned zero PDFs / three HTML files. Publisher/proxy access gap and ABI tab failure disclosed. No operational benchmark or savings claim.
- **Implementation:** The bounded road-cost/snapshot slice is now locally verified; see `scratchpad/routing-implementation-20261028/VERIFICATION.md` and the implementation delta above. This does not complete the proposed solver-adapter comparison or live benchmark. Production deployment remains separate; no live route or savings claim.

## Current delivery delta - 2026-10-28 (demo mosquito data)

### Remove confirmed demo mosquito hotspots and jobs
- **Status:** Done (live data cleaned and verified).
- **Entrypoints:** Operations map, Resident map, moderation/report data and dispatch queue.
- **Acceptance:** no confirmed demo mosquito reports, jobs or fixture clusters; preserve genuine NEA data and other records; retain a recovery copy.
- **Evidence:** removed 92 reports, 62 work orders and four test clusters; nine genuine NEA clusters preserved; live map/dispatch checks passed. See ../HANDOVER.md for the backup and exact dependent-record counts. Data-only operation; no new app release.

## Current delivery delta - 2026-10-28 (external provenance)

### Keep external map facts and remove generated pest clusters
- **Status:** Done (deployed and verified live).
- **Release:** commit `4c44def0f18d35f8143aa2802ea2fc8b90357eba` deployed; [Actions run 40620963572](https://github.com/Dung-CS/SC2006/actions/runs/40620963572) succeeded.
- **Entrypoints:** Operations dashboard/map, Resident map, Cluster detail and supporting map/priority APIs.
- **Expected actions:** inspect the real NEA Ho Ching cluster once; view source observations/reports in their own records.
- **Acceptance:** retain external NEA boundaries/counts; no duplicated mosquito rows from other pests' scores; no generated surveillance circles/counts or locality photo carousels; preserve real source records and mixed-pest dispatch.
- **Evidence:** raw NEA feed has nine features and one matching Ho Ching cluster with 99 cases (`scratchpad/map-readability/nea-origin.json`). 1,036 offline tests pass / 58 SQL skip; typecheck/build/diff and main's 81 focused tests pass. Requirements v0.14. Live APIs/screens confirm one Ho Ching entry, nine unique dengue rows, no generated shapes/carousels and a matching client hash. Dispatch zoom/road-route regression also passes. No new live database-test writes occurred.


## Current delivery delta - 2026-10-28

### Dispatch map: readable road tasks and a stable view
- **Status:** Done (deployed and verified live).
- **Release:** commit `11c7680fd40affe1bdde9240951f416d5f0e424b` deployed; [Actions run 40618465605](https://github.com/Dung-CS/SC2006/actions/runs/40618465605) succeeded.
- **Entrypoint:** `/ops/dispatch`.
- **Expected actions:** zoom/pan while dispatch refreshes; choose all road-accessible teams or one team; use explicit focus or Fit to map when required.
- **Acceptance:** only unfinished tasks from validated driving routes appear; duplicate/completed markers are hidden; polling preserves the viewport; original reports/orders remain available.
- **Evidence:** 1,034 offline tests passed / 58 SQL skipped; typecheck/build and `node tools/check-map-browser.mjs` pass. Live polling preserves zoom, team filtering reduces pins, three live routes use OneMap, and served client hash matches the tested build. Requirements v0.13.
- **Test safety:** database integration requires `DFENCE_TEST_LIVE_DB=true` and an isolated disposable database. An earlier live run cleared source metadata; required metadata recovery is verified from genuine feeds/run history, with historical-data caveats retained. See `../HANDOVER.md`.

The delivery records below are historical; their counts and fallback descriptions do not describe the current road-only map contract.

## Current delivery delta - 2026-10-27

- **Deployed through CI/CD:** background all-pest dispatch, HQ vehicle registry, dimensioned logistics and vehicle-constrained routes. [Actions run 40515218625](https://github.com/Dung-CS/SC2006/actions/runs/40515218625) succeeded; Azure `c143da4b-d1fe-47d8-a40a-0a7ea89a8577` is active/status 4. Final live fleet/dispatch, cache and invalidation checks passed.
- Snapshot reads do not wait for route computation. Startup, scoring/cluster changes, application writes and a 30-second fingerprint check refresh plans. The last good plan remains visible. Road waits have a shared 30-second budget before labelled estimates.
- Verified/actioned reports outside dengue clusters, due/overdue orders and locality scores share one queue and map triage. Other pests/tasks are not suppressed by an unrelated open task. Authority cases use qualified ordinary dispatch; historical referral records remain available.
- Manager-only vehicle CRUD is at `/ops/vehicles`. Migration 014 is applied; ten vehicles are explicitly DEMO data, two per HQ. Routes enforce unique available HQ vehicles, seats, kg, m3 and rotated individual-item dimensions. Conservative full-route load envelopes reuse shared gear and accumulate consumables/collection loads. Automatic pest returns are removed; explicit operator returns remain possible. Exact 3D packing and unload-trip optimisation are not implemented.
- Tests are split: offline/CI 1,001 passed / 58 SQL skipped, and live SQL 58 passed separately. Typecheck/build and clean extracted-package smoke pass. Initial live test timeouts were corrected and rechecked; no claim of one uninterrupted full-suite run.
- Every push/PR checks; passing `main` pushes deploy. Source is at `Dung-CS/SC2006`, main `ae99340c92fdaa5c7986d4edff22721a992d9079`. `.env` never goes to GitHub. Identity IDs are encrypted GitHub Secrets; live service credentials remain in Azure settings. OIDC has app-scoped Website Contributor.
- Recognition's Gemini 3 request convention is corrected; a fresh known-cockroach fixture returned HTTP 200 / one detection in 2.843 seconds. This does not prove general accuracy or provider reliability. Human confirmation/manual fallback remain; no new key/billing action is owed.
- Live verification passed: 10 demo vehicles, 10 routes and 43 tasks (Rat 2, Cockroach 2, Mosquito 39), with 29 unplanned tasks and 53 visible referrals. Internal planned priorities are Medium 36 / Low 7; no current internal High task was present, while urgent external referrals remain visible.
- Authenticated cached snapshot reads took 1.434-3.368 seconds. Background refresh took 31.305 seconds with the shared 30-second road-provider wait budget; this is not a subsecond response claim. Vehicle-edit invalidation and last-good-plan retention passed; the test edit was restored. Headless Edge captured fleet/dispatch screens with no page errors. Root visually reviewed both: packing/route text and the fleet table/form were readable, with no obvious layout issue.
- Master requirements v0.11 records 694 unique IDs and zero duplicates. **Pending:** review provisional crew/logistics/demo-fleet values; downstream epics, models, use cases and test-plan traceability. Multi-person planning still persists only one lifecycle lead.

The delivery notes above supersede earlier routing and recognition status claims. The original prioritisation and trial records below are historical context.

Written 2026-09-01. Shareable: https://claude.ai/code/artifact/9c6e5fdb-5865-465a-bfbf-d0187e191244

## Prioritisation basis: the marker is a TA

A TA marks many teams in a fixed window against a rubric with lines to tick. They will not read the
scoring function and admire it. So grade impact here = **how visibly and directly a feature satisfies
a criterion the marker is looking for**, not technical merit.

1. **Visible beats deep.** A value ticking on screen proves "live data update" better than a paragraph
   asserting it. A phone buzzing on cue proves multi-user interaction better than a class diagram.
2. **Features mapping 1:1 to a stated criterion are worth more than their effort suggests** (the marker
   is checking off a list). Quality improvements that don't change what's on screen are worth less.
3. **The demo is 13–15 min** — room for ~6–7 features shown properly. Hence a cut list, not a longer backlog.

Effort key: S = 1–2 days · M = 3–5 days · L = 1–2 weeks. Impact /5. Ratio = impact ÷ effort.

## Backlog

| ID | Feature | Criterion served | Impact | Effort | Ratio | Tier |
|---|---|---|---|---|---|---|
| F1 | Cluster ingestion + change detection | Live data | 4 | M | 1.33 | Foundation |
| F2 | Accounts and roles | Multi-user / Lab 3 access control | 4 | S | 2.00 | Foundation |
| F3 | Saved locations + geocoding | Multi-user / entity model | 4 | M | 1.33 | Foundation |
| F4 | Rainfall accumulation service | Live data | 5 | M | 1.67 | Build first |
| F5 | Priority scoring engine | **Data processing — the core** | 5 | L | 1.00 | Build first |
| F6 | Breeding-site reporting | **Multi-user — the core** | 5 | M | 1.67 | Build first |
| F7 | Geofenced resident alerts | Live data + multi-user | 5 | M | 1.67 | Build first |
| F8 | Planner work queue | Multi-user / second actor | 5 | M | 1.67 | Build first |
| F9 | Cluster map | Demo visibility | 4 | M | 1.33 | If on schedule |
| F10 | Cluster trend + history | Live-data proof over time | 4 | S | **2.00** | If on schedule |
| F11 | Report photos + moderation | Multi-user depth | 3 | M | 1.00 | If on schedule |
| F12 | Destination / route check | Marginal | 2 | M | 0.67 | Cut or defer |
| F13 | Fogging schedule scraper | Improves F5 invisibly | 2 | L | 0.40 | Cut or defer |
| F14 | Temperature breeding-rate modifier | Invisible sophistication | 1 | M | 0.33 | **Do not build** |

## Inputs / Processing / Outputs

### F1 — Cluster ingestion and change detection
- **In:** NEA Dengue Clusters GeoJSON, polled on a schedule. Verified fields: `OBJECTID, LOCALITY,
  CASE_SIZE, HOMES, PUBLIC_PLACES, CONSTRUCTION_SITES, FMEL_UPD_D` plus polygon geometry.
- **Processing:** fetch, parse, diff each cluster against the last stored snapshot; classify as
  new / grown / shrunk / closed by comparing `CASE_SIZE` and geometry; append a timestamped history
  row rather than overwriting.
- **Out:** normalised `Cluster` records with `first_seen`, `last_updated`, `case_delta`, plus a full
  history table.
- **Why this rank:** no marks alone, but everything reads from it, and the history table makes F10
  nearly free.

### F2 — Accounts and roles
- **In:** email/password via Supabase Auth; role assigned at registration (resident | planner).
- **Processing:** registration, login, session handling, row-level rules — a resident reads only their
  own saved locations; a planner reads the queue and every report.
- **Out:** authenticated sessions, `User` entity with role, enforced access boundaries.
- **Why this rank:** Lab 3 requires persistent storage and access control explicitly. Supabase gives
  both in ~1 day; hand-rolling costs a week and earns nothing extra.

### F3 — Saved locations and geocoding
- **In:** user-entered address or postal code; **OneMap Search API — the one government API call that
  satisfies the Smart Nation requirement.**
- **Processing:** geocode to lat/lon, then point-in-polygon against every active cluster to determine
  exposure. Store with a label: home, workplace, child's school.
- **Out:** `SavedLocation` records with coordinates, label, live cluster status.
- **Why this rank:** carries a lot of the Labs 1–3 marks — the entity model, persistence design and
  access-control question all become concrete here.

### F4 — Rainfall accumulation service
- **In:** rainfall real-time API (VERIFIED): `data.stations[id, name, location{latitude, longitude}],
  readings[timestamp, data[stationId, value]]`. 97 stations, 5-minute totals in mm.
- **Processing:** poll every 5 minutes; assign each cluster centroid to its nearest station (or
  interpolate across the three nearest by inverse distance); maintain rolling 24h and 72h accumulation.
- **Out:** `rainfall_24h` and `rainfall_72h` per cluster and per saved location, updating continuously.
- **Why this rank:** makes "live data update" visibly true. Show the 5-minute tick during the demo.

### F5 — Priority scoring engine *(the core)*
- **In:** cluster case size and growth delta (F1), rainfall accumulation (F4), open report counts (F6),
  days since last treatment (F13 or a seeded table), homes/public-places/construction breakdown.
- **Processing:** normalise each driver to a common scale, apply tuned weights, compute a composite
  priority score per locality, rank and tier into high/medium/low. **Retain each driver's contribution
  to the final score.**
- **Out:** ranked priority list with score, tier, and per-driver contribution breakdown.
- **Why this rank:** highest-value single feature; answers the "not a simple presentation of data" veto.
  The driver breakdown is not decoration — without it a TA sees a number and cannot tell whether any
  computation happened.

### F6 — Breeding-site reporting *(the multi-user core)*
- **In:** resident report — location, type (standing water / uncleared refuse / blocked drain),
  description, optional photo.
- **Processing:** geocode or accept a map pin; attach to the enclosing cluster or nearest locality;
  validate; run a status lifecycle (submitted → verified → actioned → closed); feed the open-report
  count back into F5 as a scoring driver.
- **Out:** `Report` records visible to other residents and the planner queue; adjusted priority score.
- **Why this rank:** this is the entire multi-user criterion, and the loop that makes it a system.

### F7 — Geofenced resident alerts
- **In:** SavedLocation coords (F3), active cluster polygons (F1), 24-hr forecast API, cluster growth events.
- **Processing:** evaluate trigger rules each ingestion cycle — location has entered an active cluster,
  its cluster has grown, or heavy rain is forecast within 24h for an already-active cluster. Dedupe and
  apply a cooldown so one event doesn't fire repeatedly.
- **Out:** push notification via Telegram Bot API (free, no metering).
- **Why this rank:** the best ten seconds of the demo. A TA watching a phone buzz on cue remembers it
  far longer than an architecture slide. Cheap to build, disproportionately rewarded.

### F8 — Planner work queue
- **In:** ranked priorities (F5), open reports (F6).
- **Processing:** filter and sort the queue, assign to an officer, mark actioned — which writes back a
  treatment date that re-enters F5 as `days_since_last_treatment`, lowering that locality's future score.
- **Out:** operational queue view, action log with audit history.
- **Why this rank:** creates the second actor the use case model needs and closes the feedback loop.
  Demonstrating report → priority → action → recalculated priority in 90 seconds is the strongest thing
  you can show.

### F9 — Cluster map
- **In:** cluster polygons, priority tiers, report pins, saved locations.
- **Processing:** layered render — choropleth by priority tier, report markers, user locations overlaid;
  client-side filtering by tier and report status.
- **Out:** interactive map, the primary interface for both actors.
- **Why this rank:** high visibility and TAs respond to maps — but it is presentation, not processing,
  and must not eat the schedule F5 needs.

### F10 — Cluster trend and history *(best ratio in the backlog)*
- **In:** the cluster history table F1 already writes.
- **Processing:** per-locality time series of case counts, growth rate, trajectory classification
  (growing / stable / receding).
- **Out:** sparkline per locality plus a trajectory tag.
- **Why this rank:** nearly free once F1 stores history, and the clearest possible evidence that the
  data genuinely updates — you can show weeks of movement rather than asserting it.

### F11 — Report photos and moderation
- **In:** image upload from the reporting form; planner moderation actions.
- **Processing:** store to Supabase storage, attach to the report, planner confirms or rejects;
  rejected reports stop contributing to the priority score.
- **Out:** photo-backed reports, moderation audit trail.
- **Why this rank:** deepens the multi-user story and adds genuine states to the dialog map. Worth doing
  once F5–F8 are stable.

### F12 — Destination and route check
- **In:** destination address, OneMap routing.
- **Processing:** geocode the destination, find clusters within a buffer of the destination or route
  corridor, summarise risk.
- **Out:** pre-travel advisory.
- **Why this rank:** overlaps heavily with F3 and F7 — a TA will read it as the same capability twice.
  Cut unless genuinely ahead.

### F13 — Fogging schedule ingestion
- **In:** town council public pages, scraped. Public and unauthenticated, so it clears both the FAQ bar
  and the grader's.
- **Processing:** scrape, parse dates and block ranges from inconsistent layouts, normalise, compute
  days since last treatment per locality.
- **Out:** treatment history table feeding F5.
- **Why this rank:** **the classic over-investment trap.** Every town council formats its pages
  differently, so it is genuinely a week of fiddly work — and the TA cannot see any of it, because the
  output is one input to a score. **Seed the table manually first**; F5 behaves identically.

### F14 — Temperature breeding-rate modifier
- **In:** air temperature API (VERIFIED live, 18 stations).
- **Processing:** degree-day accumulation to estimate the Aedes larval development window, applied as a
  modifier to the F5 score.
- **Out:** refined priority score.
- **Why this rank:** epidemiologically the most defensible item on this list, and the least rewarded —
  a TA marking against a rubric has no line for it. **Do not build it; say it** in the extensibility
  segment and in Q&A. A sentence instead of a week.

## Build order (7 weeks across Labs 3–4)

1. **Weeks 1–2 — Foundation: F1, F2, F3.** Nothing is demonstrable yet, and that is correct. Resist
   building the map first — everything reads from F1's history table, and starting it late costs you
   F10 entirely.
2. **Weeks 3–4 — The three criteria: F4, F5, F6.** By end of week 4 you should be able to say *and show*
   that the system ingests live data, computes a ranked priority from it, and lets residents change that
   ranking. That sentence is the project.
3. **Week 5 — Close the loop: F7, F8.** Turns a set of features into a system; the demo script starts to
   write itself.
4. **Weeks 6–7 — Visible polish: F9, F10, F11.** Stop here.
5. **Only if genuinely ahead — F12, F13.** And even then, seed the fogging table by hand first.

## The two decisions that matter most

- **Do not build F14, and do not build F13 properly.** Between them they are close to three weeks of work
  a TA cannot see. Say both in the extensibility segment instead — a sentence buys what a fortnight of
  building would not.
- **Protect F5.** It is the only large item in the first two tiers and the feature that answers the
  "not a simple presentation of data" veto. The common failure is spending week 3 on the map because it
  is satisfying to see, then arriving at week 6 with a scoring function that is three `if` statements.
  **Build the ugly version of the map and the good version of the score.**



## Operational continuation — YOLO-World trial rejected; recognition timeout remains open (2026-10-21)

The latest fresh Gemini photo timed out; manual observation is the fallback. The completed isolated YOLO-World trial does not resolve this failure. Both S and L were rejected for deployment after poor results on a fixed 10-image set with resized duplicates.

- S exact matches: 4/10 at 0.25 (two crow positives and two negatives), 2/10 at 0.60 (negatives only). L: 2/10 at either threshold (negatives only); wrong bird labels and extra Mynah boxes at 0.25.
- Both missed all rat, cockroach, mosquito and hornet positives. The user's photo was not available; no general accuracy claim is supported.
- No ONNX export or application integration was implemented or validated. No app/provider/config/deployment, billing/key, database, or production-record change occurred. Existing Gemini remains deployed; no replacement is selected.
- Evidence: `scratchpad/smart-nation-yolo-20261021/README.md`, `ROOT_VERIFICATION.json`, and `hash-manifest.json`; details in `../STATUS.md`.
## Operational continuation — selected-species and mosquito-model checks rejected (2026-10-21)

The selected-species YOLO-World S test and Culico-Net ONNX mosquito detector both failed as deployment candidates. The selected-species run counted 0/2 rat, 0/2 cockroach, 0/1 mosquito and 0/1 wasp positives at both thresholds; only the two crow positives were counted correctly. Its 40/50 and 44/50 aggregate exact counts reuse five hints on the same ten files and are dominated by negatives, not accuracy. Culico-Net exact counts were 2/10 at 0.25 and 4/10 at 0.60; it found the Aedes image but generated false mosquito boxes on other pests and standing water.

The user's fresh-photo timeout remains unresolved; their photo was unavailable. Manual observation remains the fallback. No app/provider/configuration/deployment change occurred. Root independently reran both tests; non-timing outputs matched exactly. Python network guards observed zero attempts, not proof of OS firewall isolation. The bounded source scan did not establish a suitably covered, verified-free-licensed model; it does not establish that none exists.

Evidence and candidate limits: `scratchpad/smart-nation-pest-models-20261021/RESULT.md`, `ROOT_VERIFICATION.json`, and `CANDIDATES.md`.

## Dispatch horizon and demonstration rehearsal (2026-10-29)

Status: Done (deployed bc64be2; live WebDriver verified).
Entrypoint: `/ops/dispatch`.
Expected actions: choose one to seven days, select a day, inspect its tasks/routes and horizon-unassigned reasons.
Acceptance: unique task/report allocation across dates; no early scheduling; verified road or <=10-minute walking access each way; all High/Critical dispositions visible; daily resource and four-hour constraints retained.
Validation: 1,128 passed / 58 SQL tests skipped; typecheck/build and clean package smoke passed. Nine owned demo orders, eight demo staff and three demo vans provisioned without altering existing staff availability. Final Edge WebDriver flows passed; final release evidence is in scratchpad/dispatch-demo-20261029/DEPLOYMENT.md.
