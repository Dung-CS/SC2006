<!-- Slide number: 1 -->
SYSTEM INTRODUCTION

D-Fence
From observation to verified action
Know what matters.
Send the right team.
Verify the outcome.

D
Singapore pest operations • 25-minute presentation
01

D-FENCE  /  SC2006

### Notes:
Presenter 1. Introduce D-Fence as a system connecting pest evidence to coordinated field work. It began with dengue prioritisation and now supports other pest reports. This deck follows PRESENTATION-SCRIPT.md. Repository review: 7 November 2026. No new live verification or test results are claimed.

<!-- Slide number: 2 -->
01 / PURPOSE

Information must become coordinated action
We follow one report from the resident to a verified field outcome.

Observe
Prioritise
Plan
Execute
Verify
Where is the problem?
Who can handle it?
Was it resolved?

Evidence and accountability connect every stage.
02

D-FENCE  /  SC2006

### Notes:
0:00–1:00. Public data tells us where problems exist, but a manager still needs to decide urgency, allocate resources, plan travel, and confirm completion. Introduce the end-to-end journey before discussing implementation.

<!-- Slide number: 3 -->
01 / PEOPLE AND RECORDS

Three roles, one connected workflow
Different screens support different responsibilities.

RESIDENT
OPERATIONS MANAGER
FIELD CREW
Report and follow
Review and coordinate
Act and document
Local map, saved places, photos, reports, alerts.
Evidence, priorities, staff, vehicles, dispatch, verification.
Assigned jobs, progress, completion photos and notes.
03

D-FENCE  /  SC2006

### Notes:
1:00–2:00. Define the four records: report = observation; priority score = locality-and-pest urgency estimate; work order = authorised task; dispatch = assigned work with team and logistics. Server checks enforce role permissions in addition to browser route guards.

<!-- Slide number: 4 -->
02 / TECHNOLOGY

One TypeScript codebase across the application
A browser client, an API server, persistent records, and provider integrations.

INTERFACE
APPLICATION
DATA & DELIVERY
React + TypeScript
Node.js + Express
Postgres + PostGIS
Tailwind CSS
Leaflet maps
esbuild bundles
TypeScript services
HTTP API
Role and workflow rules
Supabase photo storage
GitHub Actions
Azure App Service

OneMap • public feeds • iNaturalist • optional Gemini vision • Telegram
04
package.json • client/build.mjs • src/server.ts
D-FENCE  /  SC2006

### Notes:
2:00–3:15. React 18, Express 4, Tailwind 4, pg database access. PostGIS supports geographic queries. Object storage keeps photographs separate from relational records. OneMap supports maps, geocoding and routing; optional Gemini assists photo entry and Telegram delivers configured notifications.

<!-- Slide number: 5 -->
02 / ARCHITECTURE

Clear modules inside a single server application
Boundary–Control–Entity, with interfaces for persistence and providers.

React client
Role-specific screens
Repositories → PostGIS

HTTP boundaries
Express routes and access checks

Gateways → providers
Controls + entities
Use cases, domain records, policies

Ports
Store and external-service contracts

Production wiring and ingestion timers currently live in src/server.ts.
05
src/boundary/ • src/control/ • src/entity/ • src/ports/ • src/persistence/
D-FENCE  /  SC2006

### Notes:
3:15–5:00. Explain modular monolith: one server organised into modules. Boundaries receive requests, controls coordinate use cases, entities hold domain state/rules. Ports permit persistent or memory implementations. This resembles ports-and-adapters, not a claim of pure hexagonal architecture. The separate scheduler entry point contains a TODO; do not claim an independent production worker.

<!-- Slide number: 6 -->
03 / DESIGN PATTERNS

Strategy: vary the algorithm, preserve the workflow
Factories choose implementations; callers use a common contract.

Logarithmic

Scoring engine
NormalisationStrategy

Capped linear

Recency decay

Benefit: driver-specific behaviour and deterministic substitutes in tests.
06
src/control/normalisation/ • src/control/routing/ • src/control/vision/
D-FENCE  /  SC2006

### Notes:
5:00–5:45. Strategy separates interchangeable behaviour from the use case. Case counts and rainfall have different distributions, so normalisation methods differ. Routing and recognition have similar contracts. Factories are principally simple factories; do not claim a full Abstract Factory. A direct-distance strategy does not authorise bypassing verified road access for executable dispatch.

<!-- Slide number: 7 -->
03 / DESIGN PATTERNS

Template Method: one ingestion lifecycle
Source-specific jobs supply the steps; the base class controls their order.

Record start
Fetch / skip
Validate
Transform
Persist
Record result

UNCHANGED IS A RESULT
FAILURE PRESERVES PRIOR DATA
Publisher unchanged ≠ provider failed
Record health; retain usable stored data
07
src/control/ingestion/AbstractIngestionJob.ts
D-FENCE  /  SC2006

### Notes:
5:45–6:30. run() centralises the lifecycle and shared failure handling. Concrete jobs supply fetching, parsing and persistence. Skip/unchanged outcomes establish that the provider was checked. A bad or empty response must not silently erase a valid previous world.

<!-- Slide number: 8 -->
03 / DESIGN PATTERNS

Decouple changes from their consequences
Observer, Adapter, and Repository keep responsibilities focused.

OBSERVER
ADAPTER
REPOSITORY
React to events
Translate providers
Isolate storage
Typed subjects notify audit and notification listeners.
OneMap, Telegram, storage and vision expose project contracts.
Controllers request records; repositories handle SQL.

Most logic can be exercised without production providers or a live database.
08
src/control/observer/ • src/boundary/gateways/ • src/persistence/
D-FENCE  /  SC2006

### Notes:
6:30–7:10. Observer is in-process: do not imply durable queue delivery. Adapter isolates protocol changes. Repositories encapsulate persistence while in-memory stores support deterministic tests. Avoid labelling the Database wrapper a GoF Singleton.

<!-- Slide number: 9 -->
03 / LIFECYCLE

Completed and Verified mean different things
A transition table defines allowed moves, actors, and evidence guards.

Created
Assigned
Accepted
In Progress
Completed
Verified
Manager assigns
Assigned crew acts
Manager reviews

Completion needs photos + notes. Rejected evidence can return for rework.
09
src/control/WorkOrderTransitionTable.ts
D-FENCE  /  SC2006

### Notes:
7:10–8:00. Explain the normal path. Guards check evidence and role; particular moves require the assigned crew. Verified and Cancelled are terminal. A manager can reject a completion with a reason; the assigned crew can resume work. This is a table-driven state machine, not GoF State subclasses.

<!-- Slide number: 10 -->
04 / DATA FLOW

Two evidence inputs feed one operational loop
Stored records connect observations to decisions and execution.

Gateway → ingestion → database → scoring history
PUBLIC FEEDS

Form / photo → validation → triage → review or auto-verification
RESIDENT REPORTS

Eligible task → plan → assignment → crew evidence → verification
OPERATIONS

Later cycles use updated operational records; feedback is not an instant fixed score drop.
10
src/control/ingestion/ • src/control/scoring/ • src/control/DispatchPlanService.ts
D-FENCE  /  SC2006

### Notes:
8:00–9:00. External data is transformed and persisted. Reports receive validation and triage, with manager review or automatic verification where policy permits. Photo recognition is an entry aid, not proof. Task, report, score, and assignment identities must remain distinct and traceable.

<!-- Slide number: 11 -->
04 / SCORING

Explain the priority, not just the number
Locality-and-pest scores combine severity and urgency.

Priority = 100 × severity × urgency

URGENCY
TRANSPARENCY
CRITICAL OVERRIDE
Normalised drivers
Visible contributions
Tier + reason retained
Weights + evidence tiers
Missing inputs are disclosed
Numerical score is preserved
11
src/control/scoring/PestPriorityCalculator.ts • UrgencyCalculator.ts
D-FENCE  /  SC2006

### Notes:
9:00–10:00. Urgency combines normalised drivers; missing input can redistribute weights and mark degradation. Evidence tiers select driver sets. Mosquito retains the seven-driver dengue model. Report-level triage is separate and uses pest, count and hazard context. Critical rules may elevate a tier without changing the numeric score. Gravitrap collection is not an eighth scoring driver.

<!-- Slide number: 12 -->
04 / DISPATCH DESIGN

Urgency is only one input to a feasible plan
Priority-first greedy insertion, followed by bounded local search.

Verified evidence
Staff capability + HQ
Availability + time

Vehicle + cargo
Road access + travel
Task identity

Output: feasible proposed routes, or unassigned tasks with reasons.
12
docs/ROUTING-ALGORITHM-STE100.md • src/control/RouteOptimizationService.ts
D-FENCE  /  SC2006

### Notes:
10:00–11:00. Explain greedy insertion in plain language: add important tasks, then try limited improvements. Bounded search does not prove the shortest route and may leave feasible work unassigned at search limits. Non-mosquito proposals require verified source reports. Already committed work is separated from new allocation. The manager must save assignment; a proposal alone is not a commitment.

<!-- Slide number: 13 -->
05 / LIVE DEMONSTRATION · A / RESIDENT

Observe → report → track
Switch to the prepared browser profile. Follow the same record identity.

CLICK SEQUENCE
WATCH FOR
Inspect map layers and data freshness
01
Evidence, location, and an accountable status.
Save a prepared address in My locations
02
Add pest details, location and a demo photo
03
Submit; record the report ID and status
04
/map → /locations → /report → /reports/:id
13

D-FENCE  /  SC2006

### Notes:
11:00–13:00. Sign in as resident. Inspect map and timestamps. Add a prepared saved location. Enter a clearly labelled demo report with valid coordinates and photo. Recognition suggestions are optional and must be inspected. Follow the actual returned status; automatic verification may apply. Do not promise Submitted. Use the exact created ID for review.

<!-- Slide number: 14 -->
05 / LIVE DEMONSTRATION · B / MANAGER

Review evidence → understand urgency
Switch to the prepared browser profile. Follow the same record identity.

CLICK SEQUENCE
WATCH FOR
Inspect overview and a score breakdown
01
Score explanation and resource constraints.
Open the same report; inspect its evidence
02
Verify if review is required
03
Check eligible staff and available vehicles
04
/ops → /ops/clusters/:id → /ops/moderation → /ops/staff → /ops/vehicles
14

D-FENCE  /  SC2006

### Notes:
13:00–15:00. Manager profile: show dashboard freshness, cluster score details, report photo and location. If already verified, show that result rather than trying a second verification. Briefly inspect staff capability/HQ/availability and vehicle capacity. Use real screen values, not scripted case totals.

<!-- Slide number: 15 -->
05 / LIVE DEMONSTRATION · C / MANAGER

Inspect a plan → commit the assignment
Switch to the prepared browser profile. Follow the same record identity.

CLICK SEQUENCE
WATCH FOR
Select the prepared day; inspect Routes
01
Proposal becomes a saved operational commitment.
Open a task, route and logistics details
02
Inspect Unassigned / committed reasons
03
Save the eligible dispatch assignment
04
/ops/dispatch → /ops/dispatches
15

D-FENCE  /  SC2006

### Notes:
15:00–17:00. Show Routes, Unassigned / committed, Proposals. Select the correct date; HQ and job-type filters affect map tasks. Open a task callout. Read an available unassigned reason. Save a rehearsed eligible assignment using the actual controls, then inspect Dispatches. If the report cannot be assigned, explain why and use the prepared lifecycle order; state it is a separate fixture.

<!-- Slide number: 16 -->
05 / LIVE DEMONSTRATION · D / CREW + MANAGER

Do the work → submit evidence → verify
Switch to the prepared browser profile. Follow the same record identity.

CLICK SEQUENCE
WATCH FOR
Crew: open the exact assigned job
01
Completed is crew submission. Verified is manager acceptance.
Accept, then start the work
02
Add completion photo and notes; submit
03
Manager: inspect evidence and verify
04
/crew → /crew/jobs/:id → /crew/jobs/:id/complete → /ops/work-orders/:id
16

D-FENCE  /  SC2006

### Notes:
17:00–20:00. Match order identity. Select Today or the prepared scheduled day. Only the assigned crew accepts/starts. Demonstrate required evidence without inventing a successful missing-photo submission. Upload clearly labelled illustrative evidence; this is not a live treatment claim. Manager reviews and verifies. Return to report/history and explain actual linked state and later refresh; no immediate fixed score drop is promised.

<!-- Slide number: 17 -->
06 / QUALITY

Test rules, interfaces, storage, and the release
Different layers expose different classes of failure.

Domain + services
Scoring goldens, guards, duplicate reports, route invariants

React + HTTP
Forms, assignments, screen interactions, API permissions

Real SQL
Migrations, constraints, mappings, and PostGIS queries

Packaged release
Fresh ZIP extraction, boot, health, sign-in, route API, shell

Playwright + accessibility checks run separately on an isolated local app.
17
tests/ • tests-ui/ • playwright.config.ts • tools/smoke-release.mjs
D-FENCE  /  SC2006

### Notes:
20:00–21:00. Vitest and React Testing Library cover rules, components and controlled interactions. Real SQL matters: memory stores cannot prove persistence or spatial queries. Smoke-release blocks outbound HTTP and proves the package can start, not that live providers work. Browser checks exist but are not a current deploy workflow step. Do not cite historic test totals as a new run.

<!-- Slide number: 18 -->
06 / CONTINUOUS INTEGRATION

Four gates must pass before production deployment
Push, pull request, or manual run starts the checks.

Workflow lint
Migration guard
01
02
Validate Actions definitions
Released migrations are append-only

Disposable PostGIS
Test + package
03
04
TLS, fresh migrations, repository tests
npm ci → types → build → tests → ZIP smoke

SQL integration tests use a disposable database, never production credentials.
18
.github/workflows/deploy.yml
D-FENCE  /  SC2006

### Notes:
21:00–22:00. Name the four jobs. The test-and-package job blanks services and skips live DB tests; a separate job starts PostGIS 15 with TLS, applies every migration to an empty database and runs repository.test.ts with explicit DB opt-in. Both are required for deploy. CI validates code and schema changes independently.

<!-- Slide number: 19 -->
06 / CONTINUOUS DELIVERY

Deploy the exact artifact that passed checks
An eligible main-branch run promotes the checked ZIP.

Checked ZIP
Hash + inventory
Azure OIDC
Deploy + restart
Live verification
Short-lived identity
One deployment at a time
Client + server hashes

Live health and deployed-file checks are required after upload.
19
.github/workflows/deploy.yml • tools/package-release.mjs
D-FENCE  /  SC2006

### Notes:
22:00–23:00. Artifact ID and expected hash bind deploy to the tested package. No moving-branch rebuild. OIDC exchanges GitHub identity for short-lived Azure access. Runtime secrets remain in Azure configuration. Deployments are serialised, not cancelled mid-flight. Restart, health, served client hashes and deployed server hash establish the expected files reached the host.

<!-- Slide number: 20 -->
06 / OPERATIONAL BOUNDARIES

State what the checks actually establish
The implementation has explicit operational limits.

DATABASE
PROVIDERS
DEPLOYMENT
Production migration
Live service readiness
Health + identity
Validated in disposable CI; production application is a separate controlled step.
Local mocks and release smoke checks do not prove provider connectivity.
Checks do not establish automatic rollback or zero downtime.
20

D-FENCE  /  SC2006

### Notes:
23:00–24:00. State production migrations are not applied by CI. Explain source freshness and provider dependencies. This slide describes actual limits, not an invented safety checklist. Keep demo screenshots available if network access fails and identify recorded evidence when used.

<!-- Slide number: 21 -->
07 / CLOSING

An accountable path from observation to action
A connected workflow makes each decision easier to explain.

Evidence
Priority
Feasible plan
Field work
Verified result
Why is it urgent?
Who can handle it?
Who verified it?

Questions & discussion
21

D-FENCE  /  SC2006

### Notes:
24:00–25:00. Residents provide local evidence, managers make informed assignments and crews return evidence. BCE and ports separate responsibilities, patterns make workflows consistent and algorithms replaceable, and tests plus artifact verification support delivery. Close with the three questions shown, then invite questions.

<!-- Slide number: 22 -->
APPENDIX / REHEARSAL

Prepare the demo before the room
Use designated records and clearly labelled illustrative evidence.

Three browser profiles: resident, manager, assigned crew
01

Known report and order IDs; correct Singapore scheduled day
02

Eligible capability, HQ, availability, vehicle, and road provider
03

Freshness and health checked; same-workflow screenshots ready
04
22

D-FENCE  /  SC2006

### Notes:
Appendix, outside the 25-minute running order. Never display account passwords. Rehearse duplicate rules, report auto-verification and dispatch controls. A source report that is unassigned is a valid result with a reason; move to the prepared lifecycle fixture and disclose that change. Do not run cleanup or load tools during the talk.

<!-- Slide number: 23 -->
APPENDIX / EVIDENCE

Implementation anchors for technical questions
The repository is the source for this deck, rather than historic demo counts.

src/server.ts
Architecture + scheduling

client/src/app/routes.ts
Roles + navigation

src/control/WorkOrderTransitionTable.ts
Lifecycle + guards

src/control/scoring/ • docs/ROUTING-ALGORITHM-STE100.md
Scoring + route design

.github/workflows/deploy.yml • playwright.config.ts
CI/CD + browser boundary
23

D-FENCE  /  SC2006

### Notes:
Source: PRESENTATION-SCRIPT.md, with the implementation anchors shown. Build/source reproducibility is documented in presentation/README.md. No fabricated UI screenshots, performance measurements, test totals or current deployment claims are included.