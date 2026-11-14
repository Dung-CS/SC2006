<!-- Slide number: 1 -->

![cover-estate.jpg](CoverFullBleedImage.jpg)

# D-Fence
8653E3
SC2006 WEEK 13
AF89F4
D-Fence
771FFF
F66F87
Dengue sanitisation, from report to resolved
75F9AA
4CC9F0
FFD500
0C0120
272036

### Notes:
D-Fence closes one loop: a resident reports a breeding site, the server prioritises it with live data, an optimizer builds a road-verified route under four hours, a crew carries out remediation with photo evidence, and the manager verifies completion. The application is live on Azure. The deck uses the application's dark palette with Segoe UI typography.

<!-- Slide number: 2 -->
8653E3
# Three stakeholders share one closed operational loop
AF89F4
771FFF

![persona-resident.jpg](PersonaPortrait1.jpg)

![persona-manager.jpg](PersonaPortrait2.jpg)

![persona-crew.jpg](PersonaPortrait3.jpg)
F66F87
Aisha binti Rahman
Chow Yen Kit
Tan Ah Seng
Resident & parent in Tampines
Regional Operations Manager
Vector Control Specialist
75F9AA
4CC9F0

FFD500
Goal
Goal
Goal
0C0120
Report stagnant water; get transparent remediation proof
Prioritise hotspots by live risk; dispatch 4-hour routes
Follow clear turn-by-turn routes with required gear
272036

Pain point
Pain point
Pain point
Worry over dengue risk; past reports lacked progress updates
Fragmented public feeds; manual route planning overhead
Unclear task scopes; arriving at sites without proper tools
Source: Resident UAT and field trials

### Notes:
Three roles share one system: Resident, Operations Manager, and Cleaning Crew. External authorities receive referrals for non-vector wildlife cases through separate channels without internal accounts. Each role has focused screens: residents report and track; managers evaluate scores and assign crews; crews execute routes and submit photo proof. Staff portraits are authentic Unsplash licensed assets.

<!-- Slide number: 3 -->
8653E3
# Residents submit geo-tagged observations screened by multimodal vision
AF89F4
1 · Report
2 · Rank
3 · Plan
4 · Review
5 · Dispatch
6 · Resolve
771FFF

![resident-report-form-fit2223x1713-0.5_0.5.png](Picture28.jpg)

![persona-resident.jpg](ActingPersonaThumbnailStage1.jpg)

![smartphone-270x270.png](Picture13.jpg)
Stage 1 of 6
F66F87
Resident submits report
75F9AA
4CC9F0
Citizen intake

![map-270x270.png](Picture16.jpg)
Address search via OneMap, pin drop, and photo upload
FFD500
0C0120
Vision screening

![computer-vision-270x270.png](Picture20.jpg)
272036
Gemini 3 Flash screens photos for pest taxon classification
Spatial deduplication

![shield-270x270.png](Picture24.jpg)
Refuses duplicate reports of same pest within 50 m and 24 h
Source: src/boundary/routes/reports.ts

### Notes:
Stage 1 starts the loop. Residents submit reports through a mobile-first form or the interactive map. Location resolves via OneMap or GPS coordinates. Gemini 3 Flash screens uploaded photos to suggest the pest species, though residents confirm the final submission. Deduplication logic rejects reports of the identical pest type within 50 metres and 24 hours. A fresh verified report immediately invalidates the server dispatch plan cache.

<!-- Slide number: 4 -->
8653E3
# Server prioritises community reports and active clusters continuously
AF89F4
1 · Report
2 · Rank
3 · Plan
4 · Review
5 · Dispatch
6 · Resolve
771FFF

![manager-ops-dashboard-fit2223x1713-0.5_0.5.png](Picture28.jpg)

![persona-manager.jpg](ActingPersonaThumbnailStage2.jpg)

![database-270x270.png](Picture13.jpg)
Stage 2 of 6
F66F87
Server ranks queue
75F9AA
Telemetry intake
4CC9F0

![monitoring-270x270.png](Picture16.jpg)
NEA cluster GeoJSON hourly; weather stations polled every 5 min
FFD500
0C0120
Dynamic scoring

![calculator-270x270.png](Picture20.jpg)
272036
Combines 7 weighted environmental and operational drivers
Degraded handling

![shield-270x270.png](Picture24.jpg)
Stale data sources redistribute weight and flag degraded state
Source: src/control/scoring/

### Notes:
Stage 2 computes priority. Ingestion jobs continuously pull NEA dengue clusters, 5-minute rainfall totals from 87 weather stations, and 24-hour regional forecasts. The scoring engine evaluates each cluster and community report against seven weighted drivers. Missing or stale feeds automatically redistribute weights and flag the score as degraded rather than failing. Critical override rules elevate severe hazards to top rank while preserving numerical scores.

<!-- Slide number: 5 -->
8653E3
# Seven weighted drivers turn live telemetry into a transparent priority queue
AF89F4
771FFF
Inputs
Scale
Score
Tier
Rank
F66F87

![database-48x48.png](Picture15.jpg)

![chart-48x48.png](Picture20.jpg)

![calculator-48x48.png](Picture25.jpg)

![flag-48x48.png](Picture30.jpg)

![priority-48x48.png](Picture35.jpg)
75F9AA
Clusters, rain, reports
Driver normalized 0 to 1
100 x severity x sum(w*x)
Critical, High, Med, Low
Deterministic sorted list
4CC9F0
| Driver | Weight | Scale Method |
| --- | --- | --- |
| Case size | 0.30 | log scale, ref 300 |
| Case growth delta | 0.20 | log scale, ref 40 |
| Days since treatment | 0.15 | recency decay, 60 d |
| Rainfall 72 h | 0.12 | capped linear, 120 mm |
| Verified open reports | 0.10 | capped linear, 5 reps |
| Rainfall 24 h | 0.08 | capped linear, 50 mm |
| Premises mix | 0.05 | pass-through proportion |
| Tier | Classification Rule |
| --- | --- |
| Critical | Verified report matches override rule; score kept |
| High | Calculated priority score >= 70.0 |
| Medium | Score between 40.0 and 69.9 |
| Low | Score strictly below 40.0 |
| Ties | Severity, open report count, locality name |
| Grouping | Complete-link within 100 m, same pest & task |
FFD500
0C0120
272036

Output: one ranked list, each score with its driver breakdown.
Source: config/scoring.default.json

### Notes:
Score = 100 x pest severity x sum(weight x scaled value) / sum(weights present). Mosquito severity is 1.0. A stale driver is omitted and the remaining weights re-normalised. Tiers follow transparent boundaries: Critical is an override for verified hazards, High starts at 70.0, Medium at 40.0. Spatial grouping uses complete-link clustering: all reports in a group must sit within 100 metres of each other.

<!-- Slide number: 6 -->
8653E3
# Optimizer builds road-verified crew circuits under the 4-hour cap
AF89F4
1 · Report
2 · Rank
3 · Plan
4 · Review
5 · Dispatch
6 · Resolve
771FFF

![manager-dispatch-cards-fit2223x1713-0.5_0.5.png](Picture28.jpg)

![persona-manager.jpg](ActingPersonaThumbnailStage3.jpg)

![map-270x270.png](Picture13.jpg)
Stage 3 of 6
F66F87
Server plans optimal dispatch
75F9AA
4CC9F0
Greedy insertion

![target-270x270.png](Picture16.jpg)
Priority-first allocation evaluating up to 6 candidate routes
FFD500
0C0120
Directed roads

![chart-270x270.png](Picture20.jpg)
272036
Real turn-by-turn geometry verified via OneMap Driving API
Shift constraint

![clock-270x270.png](Picture24.jpg)
Drive + walk + on-site + on-call delay strictly capped at 4 h
Source: src/control/RouteOptimizationService.ts

### Notes:
Stage 3 plans routing. The planner maps urgent tasks to regional depot teams using greedy insertion with bounded local search. Every leg is verified against OneMap directed driving routes. When vehicles cannot stop directly at the work site, pedestrian walking legs under 10 minutes are verified. Routes enforce depot affinity and strict shift limits.

<!-- Slide number: 7 -->
8653E3
# Priority-first greedy insertion enforces depot affinity and hard operational limits
AF89F4
771FFF

![manager-dispatch-cards-fit1742x1428-0.5_0.5.png](Picture52.jpg)

![users-162x162.png](Picture13.jpg)

![truck-162x162.png](Picture17.jpg)

![clock-162x162.png](Picture21.jpg)

![map-162x162.png](Picture25.jpg)
F66F87
Crew
Cargo
Four hours
Access
75F9AA
Capability, count, HQ match
Seats, payload kg, m3 volume
Drive, walk, service, lag
Road access or 10 min walk
4CC9F0
Sort
Insert
Verify
Improve
FFD500

1
2
3
4
0C0120

![priority-106x106.png](Picture32.jpg)

![target-106x106.png](Picture38.jpg)

![shield-106x106.png](Picture44.jpg)

![speed-106x106.png](Picture50.jpg)
272036
Critical, High, Medium, Low
Check up to 6 candidate routes
OneMap road & walking legs
2-opt untangling within tier

Output: multi-stop road circuits with verified pedestrian walking access.
Source: docs/ROUTING-ALGORITHM-STE100.md

### Notes:
The routing algorithm operates priority-first. Critical tasks are assigned first and locked to Stop 1 with immediate base return. Within each priority tier, candidate insertion tests up to six routes through OneMap, choosing the smallest increase in verified travel time. Tasks lacking road access within 25 metres require verified walking paths of 10 minutes or less. Total route time (driving + walking + on-site effort + on-call lag) cannot exceed 14,400 seconds. Manually created or edited dispatches are marked isFixed and excluded from automated replanning.

<!-- Slide number: 8 -->
8653E3
# Manager inspects logistics checklists and commits dispatches on the details page
AF89F4
1 · Report
2 · Rank
3 · Plan
4 · Review
5 · Dispatch
6 · Resolve
771FFF

![manager-dispatch-details-fit2223x1713-0.5_0.5.png](Picture28.jpg)

![persona-manager.jpg](ActingPersonaThumbnailStage4.jpg)

![target-270x270.png](Picture13.jpg)
Stage 4 of 6
F66F87
Manager reviews & commits
75F9AA
4CC9F0
Dedicated workspace

![dashboard-270x270.png](Picture16.jpg)
Details page mounts assignment editor, vehicle specs, and stops
FFD500
0C0120
Equipment checklist

![compliance-270x270.png](Picture20.jpg)
272036
Live gear packing list updates crew loading status in real time
Fixed persistence

![padlock-270x270.png](Picture24.jpg)
Manager saves lock dispatch with isFixed flag against auto-replanning
Source: client/src/screens/operations/

### Notes:
Stage 4 is manager review. Clicking 'View & Edit Dispatch Details' opens a dedicated operational workspace. The manager inspects vehicle cargo utilisation (payload kg and m³ volume), reviews stop sequence, and manages the logistics packing checklist. Items added or removed here immediately reflect on the crew's mobile view. Saving an edited dispatch sets isFixed: true, preventing background optimization cycles from overwriting manual assignments.

<!-- Slide number: 9 -->
8653E3
# Field crew navigates ordered stops and checks off equipment on mobile
AF89F4
1 · Report
2 · Rank
3 · Plan
4 · Review
5 · Dispatch
6 · Resolve
771FFF

![crew-my-jobs-fit2223x1713-0.5_0.5.png](Picture28.jpg)

![persona-crew.jpg](ActingPersonaThumbnailStage5.jpg)

![truck-270x270.png](Picture13.jpg)
Stage 5 of 6
F66F87
Crew dispatched to field
75F9AA
4CC9F0
Mobile checklist

![compliance-270x270.png](Picture16.jpg)
Interactive packing checklist persists checks to backend
FFD500
0C0120
Route navigation

![map-270x270.png](Picture20.jpg)
272036
Numbered stop sequence with pest type, priority, and coordinates
Field safety

![shield-270x270.png](Picture24.jpg)
Specific PPE and equipment requirements enforced before departure
Source: client/src/screens/crew/MyJobsScreen.tsx

### Notes:
Stage 5 covers field execution. Crew members sign in on mobile devices to access My Jobs. The interactive equipment checklist allows crew to tick off respirators, foggers, and larvicide granules before departing the depot. Toggling checklist items immediately persists via /api/crew/dispatch/checklist/toggle. The crew navigates stops in sequence, viewing priority pills and on-site instructions.

<!-- Slide number: 10 -->
8653E3
# A table-driven state machine enforces photo proof and formal verification
AF89F4
771FFF

![manager-wo-detail-fit2223x1713-0.5_0.5.png](Picture28.jpg)
State machine

![coding-270x270.png](Picture13.jpg)
Created -> Assigned -> Accepted -> In Progress -> Completed -> Verified
F66F87
75F9AA
Evidence guard
4CC9F0

![computer-vision-270x270.png](Picture16.jpg)
Completion requires timestamp, task confirmation, notes, and photos
FFD500
0C0120
Role separation

![certified-270x270.png](Picture20.jpg)
272036
Completed is crew field submission; Verified is manager sign-off
Rework loop

![speed-270x270.png](Picture24.jpg)
Manager rejection records reason and returns job to In Progress
Source: src/control/WorkOrderTransitionTable.ts

### Notes:
The work-order lifecycle is implemented as a table-driven state machine in WorkOrderTransitionTable.ts, deliberately rejecting GoF State subclasses to keep transition rules declarative and basis-path testable. Only assigned crew can progress jobs to Completed, which strictly requires photographic evidence, timestamp, and notes. Only an Operations Manager can transition a job to Verified. If evidence is inadequate, the manager rejects it with a reason, returning the order to In Progress for rework.

<!-- Slide number: 11 -->
8653E3
# Audit logging and status alerts confirm job resolution to the resident
AF89F4
1 · Report
2 · Rank
3 · Plan
4 · Review
5 · Dispatch
6 · Resolve
771FFF

![resident-my-reports-fit2223x1713-0.5_0.5.png](Picture28.jpg)

![persona-resident.jpg](ActingPersonaThumbnailStage6.jpg)

![tracking-270x270.png](Picture13.jpg)
Stage 6 of 6
F66F87
Resident sees update
75F9AA
4CC9F0
Closed loop

![certified-270x270.png](Picture16.jpg)
Report status flips to Verified and closes linked public observation
FFD500
0C0120
Append-only audit

![database-270x270.png](Picture20.jpg)
272036
Database triggers record immutable transition history with timestamps
Resident alerts

![inbox-270x270.png](Picture24.jpg)
Configured Telegram bot dispatches notification on completion
Source: src/control/observer/

### Notes:
Stage 6 closes the operational loop. When the manager verifies the completed work order, linked community reports update to Verified. Residents can track status changes under My Reports. Database triggers write an immutable entry to the append-only audit log. If the resident configured Telegram alerts, a completion notification is dispatched with remediation details.

<!-- Slide number: 12 -->
8653E3
# Boundary-Control-Entity layering isolates use cases from external protocols
AF89F4
771FFF

Boundary (HTTP & Gateways)

ReportRoutes

OpsRoutes

OneMapGateway

TelegramGateway

NEAFeedGateway
F66F87

75F9AA
Control (Use Cases & Observers)

PriorityScoringEngine

RouteOptimizationService

WorkOrderLifecycleController

AbstractIngestionJob
4CC9F0

Entity (Domain Models & Rules)
FFD500

WorkOrder

DengueCluster

PriorityScore

PestReport

TransitionTable
0C0120

Ports (Store & Gateway Contracts)

ClusterStore

WorkOrderStore

ReportStore

OneMapPort

StoragePort
272036

Persistence (Storage Implementations)

PostgresRepositories

In-Memory Test Twins

17 SQL Migrations

Composition Root

src/server.ts dynamic wiring based on DATABASE_URL and environment
Source: src/boundary/, src/control/, src/ports/

### Notes:
The architecture adheres strictly to Boundary-Control-Entity with Ports and Adapters. Boundaries handle HTTP parsing, security headers, and gateway integrations. Controls coordinate business use cases and state transitions. Entities hold pure domain rules. Ports define abstract store and gateway interfaces. Persistence supplies dual implementations: Postgres with PostGIS for production, and in-memory twins enabling full-suite tests to run in seconds without a database. src/server.ts serves as the composition root.

<!-- Slide number: 13 -->
8653E3
# Proven design patterns keep algorithms interchangeable and ingestion resilient
AF89F4
771FFF

Strategy

![coding-270x270.png](Picture13.jpg)
NormalisationStrategy (log, linear, decay), IRouteStrategy (road vs foot), and IVisionStrategy (Gemini vs mock)
F66F87
75F9AA
Template Method

![target-270x270.png](Picture16.jpg)
4CC9F0
AbstractIngestionJob defines pipeline: start -> fetch/skip -> validate -> transform -> persist; failures preserve prior state
FFD500
Observer

![inbox-270x270.png](Picture20.jpg)
0C0120
In-process typed event bus (ReportObserver, WorkOrderObserver) decouples state mutations from audit and Telegram alerts
272036
Adapter

![dashboard-270x270.png](Picture24.jpg)
Gateways translate external third-party APIs (OneMap, Telegram, data.gov.sg GeoJSON) into stable domain models
Repository

![database-270x270.png](Picture28.jpg)
Stores encapsulate SQL queries and PostGIS geometry behind port interfaces with in-memory test doubles
Source: src/control/normalisation/, src/control/routing/

### Notes:
Design patterns solve concrete engineering challenges in D-Fence. The Strategy pattern allows swapping normalisation formulas per driver and substituting routing algorithms for tests. The Template Method pattern in AbstractIngestionJob standardises ingestion: if a publisher feed is unchanged, it logs a successful skip; if a fetch fails, prior data is preserved. The Observer pattern decouples domain events from external alerts, and Adapters insulate business logic from third-party API changes.

<!-- Slide number: 14 -->
8653E3
# Mainstream tools deliver an integrated TypeScript platform from browser to cloud
AF89F4
771FFF
Categorised technology stack
F66F87

![react-415x415.png](Picture14.jpg)

![typescript-415x415.png](Picture17.jpg)

![tailwindcss-415x415.png](Picture20.jpg)

![nodedotjs-415x415.png](Picture23.jpg)

![express-415x415.png](Picture26.jpg)

![postgresql-415x415.png](Picture29.jpg)
75F9AA
4CC9F0
FFD500
React
TypeScript
Tailwind
Node.js
Express
PostgreSQL
0C0120

![postgis.png](Picture32.jpg)

![supabase-415x415.png](Picture35.jpg)

![onemap.png](Picture38.jpg)

![azure-415x415.png](Picture41.jpg)

![githubactions-415x415.png](Picture44.jpg)

![vitest-415x415.png](Picture47.jpg)
272036
PostGIS
Supabase
OneMap
Azure
Actions
Vitest

Front end: React & Tailwind. Back end: Node & Express. Data: Postgres & PostGIS. Cloud: Azure & Supabase.
Source: Logos: Simple Icons (CC0); Azure, PostGIS, OneMap from official domains

### Notes:
The stack is grouped by architectural purpose: Front end (React 18, TypeScript, Tailwind CSS, Leaflet), Back end (Node.js, Express), Data (PostgreSQL, PostGIS, Supabase Singapore), External APIs (OneMap, data.gov.sg, Telegram), CI/CD and Hosting (GitHub Actions, Azure App Service with OIDC and App Settings secrets), and Testing (Vitest, Testing Library, Playwright). All code shares TypeScript types.

<!-- Slide number: 15 -->
8653E3
# Four parallel gates validate every commit before passwordless OIDC deployment
AF89F4
771FFF
Test and package
Disposable SQL
Migration guard
Workflow lint
F66F87

![test-tube-72x72.png](Picture15.jpg)

![database-72x72.png](Picture20.jpg)

![shield-72x72.png](Picture25.jpg)

![compliance-72x72.png](Picture30.jpg)
75F9AA
Typecheck, build, 1247 tests, offline smoke
All 17 migrations on PostGIS 15 with TLS
Released migration files stay append-only
actionlint pins GitHub Actions syntax
4CC9F0
FFD500
Hash check
Azure OIDC
Deploy
Health poll
Live hash
0C0120

272036
1
2
3
4
5

![certified-72x72.png](Picture36.jpg)

![padlock-72x72.png](Picture42.jpg)

![delivery-72x72.png](Picture48.jpg)

![monitoring-72x72.png](Picture54.jpg)

![tested-72x72.png](Picture60.jpg)
Deployment zip equals tested artifact
Short-lived token, zero stored passwords
Kudu zipdeploy and container restart
Poll /api/health until status ok
Deployed server hash equals release build

Tested build = live build. Disposable PostGIS validates migrations without touching production.
Source: .github/workflows/deploy.yml, CI-CD.md

### Notes:
CI/CD runs four parallel jobs on every push. Deployment triggers only on main and requires all four checks to pass. The exact zip tested in CI is promoted to production via Azure OIDC authentication, avoiding stored passwords. Deployment restarts the container and verifies health and SHA256 hashes against the built artifact. A disposable PostGIS 15 container in CI validates migrations from an empty database.

<!-- Slide number: 16 -->
8653E3
# Six test layers verify domain invariants, real SQL migrations, and the live release
AF89F4
771FFF

![tracking-190x190.png](Picture13.jpg)
Live verification
Automated /api/health polling and remote server SHA256 verification post-deploy
F66F87

![computer-vision-190x190.png](Picture16.jpg)
Browser UI & a11y
75F9AA
Playwright end-to-end browser walkthroughs and axe-core accessibility audits
4CC9F0

![speed-190x190.png](Picture20.jpg)
Release smoke boot
Packaged distribution zip boots in clean sandbox with outbound HTTP blocked
FFD500

![database-190x190.png](Picture24.jpg)
Real SQL integration
0C0120
All 17 migrations executed against disposable PostGIS 15 with SSL in CI
272036

![smartphone-190x190.png](Picture28.jpg)
Screen components
23 screen test suites using React Testing Library verifying user interactions

![calculator-190x190.png](Picture32.jpg)
Domain unit & service
1,247 automated Vitest unit tests covering scoring, routing, and state tables

Each layer validates the identical build: in memory, against real SQL, then in production.
Source: tests/, vitest run 2026-10-31

### Notes:
The testing strategy spans six distinct layers. Unit and service tests use in-memory store doubles, allowing 1,247 tests to run in seconds. Real SQL integration tests execute in CI against a disposable PostGIS container to prove migrations and spatial queries. The smoke boot test extracts the production zip and boots it with network access blocked to prove self-contained packaging. Browser UI and accessibility checks run with Playwright and axe-core.

<!-- Slide number: 17 -->
8653E3
# Targeted caching and spatial indexing ensure rapid, resilient field execution
AF89F4
771FFF

Dispatch Caching
Abuse Protection
F66F87

![cache-180x180.png](Picture14.jpg)

![shield-180x180.png](Picture29.jpg)
Precomputed plans served from memory; 30 s fingerprint check detects changes
15-minute sign-in lockout on failed attempts; bounded backoff on 429 rate limits
75F9AA
4CC9F0

FFD500
Spatial Indexing
Security Hardening

![database-180x180.png](Picture19.jpg)

![padlock-180x180.png](Picture34.jpg)
0C0120
PostGIS GIST spatial indexes accelerate polygon containment and proximity queries
scrypt password hashing, server-enforced RBAC, strict CSP, and HSTS headers
272036

Data Efficiency
Append-Only Audit

![download-180x180.png](Picture24.jpg)

![monitoring-180x180.png](Picture39.jpg)
SQL aggregation eliminates 3.2 MB per 5 min overhead on rainfall polling
Database triggers guard immutable audit log; every error carries correlation ID
Source: src/control/DispatchPlanService.ts

### Notes:
Robustness is engineered through targeted mechanisms rather than generic limits. Dispatch plans are precomputed and cached in memory, refreshing on data mutations. PostGIS GIST indexes support fast spatial lookups. Data egress costs were cut by aggregating rainfall on the SQL server. Security includes scrypt hashing, strict CSP, and immutable database audit triggers.

<!-- Slide number: 18 -->

![close-resolved-fit1680x2250-0.5_0.5.jpg](Picture13.jpg)
# Report in. Resolved out.
8653E3
QUESTIONS & DISCUSSION
AF89F4
Report in. Resolved out.
771FFF
F66F87
75F9AA
dfence-sc2006.azurewebsites.net
4CC9F0
FFD500
0C0120
272036

### Notes:
D-Fence establishes an accountable loop from observation to action: crowdsourced citizen reports and live government feeds converge into an explainable priority score, optimal routes are calculated within shift limits, field crew execute jobs with mobile checklists and photo evidence, and managers verify completion. The application is live at dfence-sc2006.azurewebsites.net.