<!-- Slide number: 1 -->

![cover-estate-fit4000x2250-0.5_0.5.jpg](Picture11.jpg)

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
Imagine it is Saturday night. You spot stagnant water behind your block, take a photo and report it.

Two weeks later, the water is still there. Nobody came, and your neighbour is down with dengue.

(pause, let the story land)

That gap between a report and a fix is what we set out to close.

We are proud to present D-Fence.

D-Fence joins residents, operations managers and field officers in one loop. It ranks every hazard with live government data and plans routes that fit a four-hour shift.

The system runs live on Azure today.

<!-- Slide number: 2 -->
8653E3
# Three roles share one loop, from the resident's report to the field team's fix
AF89F4
771FFF

![gemini-head-and-shoulders-portrait-photograph-of-a-mala-fit1210x719-0.5_0.3.jpg](Picture13.jpg)

![gemini-head-and-shoulders-portrait-photograph-of-a-chin-fit1210x719-0.5_0.3.jpg](Picture20.jpg)

![gemini-field-officer-portrait-head-and-shoulders-of-a-m-fit1210x719-0.5_0.3.jpg](Picture27.jpg)
F66F87
75F9AA
4CC9F0
FFD500
0C0120
Nur Aisyah
Rachel Lim
Ahmad Faizal
Resident, Tampines
Operations Manager
Field Officer
272036
Goal: report stagnant water in under a minute
Goal: treat the highest-risk sites first
Goal: a clear job list with stops in order
Goal: see proof that the site was treated
Goal: send field teams on routes that fit one shift
Goal: the right gear packed before leaving HQ
Pain: past reports vanished with no progress update
Pain: scattered feeds and manual route planning
Pain: vague tasks and missing equipment on site
Source: client/src/lib/staffVisuals.ts; resident portrait AI-generated

### Notes:
(handoff point if the team splits here)

Three distinct roles share one system, from citizen hazard report to verified field resolution.

Our software provides dedicated accounts for three key user roles.

Nur Aisyah lives in Tampines. She wants to report stagnant water in under one minute, and she needs proof that teams treated the site. In the past, her reports vanished without updates.

Rachel Lim directs operations. She needs to treat the highest-risk sites first and build routes that fit one shift. Scattered feeds and manual planning slowed her down.

Ahmad Faizal is our field officer. He needs an ordered job list and the right gear packed before leaving HQ. Vague tasks and missing tools wasted his time on site.

(emphasize the contrast)

What stands out in this design is that three separate roles share one verified data record.

Wildlife cases go to a dedicated wildlife response team in our own crew.

<!-- Slide number: 3 -->
8653E3
# A resident uploads a photo, and an AI model detects and counts the pest in it
AF89F4
771FFF
Report
Rank
Plan
Review
Dispatch
Resolve
F66F87

Resident
Server
Server
Manager
Field team
Everyone
75F9AA

![gemini-head-and-shoulders-portrait-photograph-of-a-mala-fit1112x537-0.5_0.3.jpg](Picture31.jpg)

4CC9F0

![resident-upload-screen-421x913.png](Picture40.jpg)

![resident-vision-cockroach-screen-421x913.png](Picture45.jpg)
FFD500
0C0120
272036
Nur Aisyah
Resident
Finds the address with OneMap search or drops a pin
A Gemini vision model boxes and counts the pest in her photo
Duplicates of one pest within 50 m and 24 h are refused
Upload a photo
AI detects the pest
Source: src/control/ReportController.ts

### Notes:
Residents submit pest photographs, while an automated vision model detects and counts specimens.

Stage one starts the operational loop. Nur Aisyah reports a pest hazard through our mobile web form or the map view.

OneMap address search and device satellite coordinates resolve the exact location.

She uploads a camera photo, or picks a sample test image.

On upload, a Gemini vision model checks the photo.

The model draws bounding boxes around detected pests and counts every specimen.

(point to the phone mockups on screen)

Nur Aisyah confirms the detected species and count with one tap before submitting.

To protect operational capacity, our server checks existing nearby submissions.

The platform refuses duplicate reports of the same pest within fifty metres.

Background ingestion jobs also collect records from public agency feeds, so the system never depends on resident reports alone.

<!-- Slide number: 4 -->
8653E3
# The server scores every task, for every pest, and shows how each score was reached
AF89F4
771FFF
Report
Rank
Plan
Review
Dispatch
Resolve
F66F87

Resident
Server
Server
Manager
Field team
Everyone
75F9AA

![gemini-head-and-shoulders-portrait-photograph-of-a-chin-fit1112x537-0.5_0.3.jpg](Picture31.jpg)

4CC9F0

![manager-cluster-detail-1541x963.png](Picture41.jpg)
FFD500
0C0120
272036
Rachel Lim
Operations Manager
Sees one ranked list instead of five data feeds
Opens any cluster to see each driver's share

A stale feed is flagged, not hidden
Source: src/control/PriorityScoringEngine.ts

### Notes:
The platform ranks every hazard into one list, combining severity with live environmental urgency.

Stage two computes operational priority.

Background ingestion jobs pull active dengue clusters from the National Environment Agency, alongside rainfall readings and weather forecasts.

Our scoring engine rates every municipal task by multiplying species severity by environmental urgency.

Rachel Lim sees one clear ranked list instead of separate agency feeds.

On screen, you see an active dengue cluster with one hundred and one cases.

The engine calculates its priority score and places this cluster into the Medium tier.

(steady tone, walk through the driver contributions)

The interface displays each driver's contribution so the manager understands the calculation.

Stale data feeds never hide.

When a feed goes stale, the server redistributes that driver weight and flags the score as degraded.

<!-- Slide number: 5 -->
8653E3
# Every task, whatever the pest, gets one 0-100 score: severity times urgency
AF89F4
771FFF
Report
Rank
Plan
Review
Dispatch
Resolve
F66F87

Resident
Server
Server
Manager
Field team
Everyone
75F9AA
| Pest (22 in catalogue) | Severity | Evidence |
| --- | --- | --- |
| Mosquito | 1.00 | A: NEA feeds |
| Rat | 1.00 | C: reports |
| Macaque | 0.92 | C: reports |
| Wild boar | 0.83 | C: reports |
| Cockroach | 0.75 | B: sightings |
| Snake | 0.75 | B: sightings |
| Bee or wasp | 0.75 | B: sightings |
| Pigeon | 0.58 | B: sightings |
| Bed bug | 0.50 | C: reports |
| Termite | 0.33 | B: sightings |
| Urgency driver | A | B | C |
| --- | --- | --- | --- |
| NEA case size and growth | 0.50 | - | - |
| Rainfall, 72 h and 24 h | 0.20 | - | - |
| Premises mix | 0.05 | - | - |
| Open verified reports | 0.10 | 0.30 | 0.35 |
| Report velocity, 14 days | - | 0.20 | 0.25 |
| Corroborations | - | 0.10 | 0.15 |
| iNaturalist sightings, 90 days | - | 0.20 | - |
| Days since treatment | 0.15 | 0.15 | 0.20 |
| Distance to a pest operator | - | 0.05 | 0.05 |
4CC9F0
FFD500
0C0120
272036

Score = 100 x severity x urgency. High is 70 or more, Medium 40 or more; a verified hazard overrides to Critical.
Source: PEST-PRIORITY-MODEL.md; config/pests.default.json

### Notes:
A unified scoring formula rates every pest species on disease risk and active evidence.

One unified scoring queue holds every task across our catalogue of twenty-two pests.

Severity is fixed per species based on disease risk, physical harm, statutory duty, and property damage.

Mosquitoes and rats sit at the top of the severity scale.

Urgency sums normalised data drivers, and the active driver set depends on the evidence available for that species.

Mosquitoes belong to evidence tier A, supported by live government case counts and rainfall data.

Tier B species incorporate citizen wildlife observations from iNaturalist.

Tier C pests, including rats, depend on resident reports and treatment history.

(lift energy on the practical trade-off)

What surprised our team was that a high-volume rat block can legitimately outrank a moderate dengue cluster.

At the same time, an influx of ant complaints can never displace genuine disease vectors.

Life-safety cases, such as a snake indoors, a crocodile or an injury, skip the calculation and enter Critical priority immediately.

<!-- Slide number: 6 -->
8653E3
# The server builds road-checked team routes that fit one four-hour shift
AF89F4
771FFF
Report
Rank
Plan
Review
Dispatch
Resolve
F66F87

Resident
Server
Server
Manager
Field team
Everyone
75F9AA

![gemini-head-and-shoulders-portrait-photograph-of-a-chin-fit1112x537-0.5_0.3.jpg](Picture31.jpg)

![manager-routes-map-fit2594x1278-0.5_0.5.png](Picture37.jpg)
4CC9F0
FFD500
0C0120
272036
Rachel Lim
Operations Manager
Gets proposed routes for a seven-day horizon
Each colour is one field team's route from its HQ
Routes follow real roads, then a short walk
Source: src/control/RouteOptimizationService.ts

### Notes:
Automated route planning builds complete field schedules that fit within a single work shift.

Stage three plans field routes for the teams.

The route planner assigns ranked tasks to HQ teams for the days ahead.

The map displays proposed routes, where each colour represents one field team starting from HQ.

OneMap driving routes check every road travel leg.

When a vehicle cannot park directly at the work site, the system checks pedestrian access.

The planner allows only a short walk from the vehicle stopping point.

(deliberate pace, stress the hard boundary)

Each route sums driving travel, pedestrian walking, on-site treatment, and on-call buffer time.

The combined total keeps every field route strictly under the four-hour shift limit.

<!-- Slide number: 7 -->
8653E3
# Cheap straight-line estimates shortlist each insertion; OneMap checks the best six
AF89F4
771FFF
Report
Rank
Plan
Review
Dispatch
Resolve
F66F87

Resident
Server
Server
Manager
Field team
Everyone
75F9AA
Sort
Estimate
Verify
Insert
2-opt
Swap
4CC9F0
FFD500

Critical first, then scarce skills
Rank every slot by straight-line time
OneMap road and walk times, best 6
Cheapest verified slot within 4 hours
Reverse same-tier stops if shorter
Move or swap jobs between crews
0C0120
272036
| 2-opt example | Stop order | Time |
| --- | --- | --- |
| Before | Depot-1-2-3-4-5-Depot | 55 min |
| Cut legs | 2-3 and 4-5 cross | - |
| Reverse 2 to 4 | Depot-1-4-3-2-5-Depot | 37 min |
| Keep it? | Yes: OneMap time falls; same tier only | -18 min |

2-opt cuts two legs and reverses the stops between them; it is kept only when OneMap time falls.
Source: src/control/RouteOptimizationService.ts; ROUTING-ALGORITHM.md

### Notes:
Fast straight-line filters screen candidate stops before official road routing verifies the best paths.

Our route planner uses greedy insertion.

The algorithm sorts the tasks first. Critical hazards come first, then jobs that few crews can do, then short jobs.

For each task, the planner evaluates every available slot across all team schedules.

The algorithm estimates transit time using straight-line distances.

That simple estimate lets the engine test every potential slot cheaply.

(lean forward, emphasize the optimization trick)

The best part is that OneMap verifies only the best six candidate slots.

OneMap returns verified road and walking travel times, and the task takes the slot with the lowest verified time increase.

Then two-opt optimization cleans up each route.

Two-opt cuts two legs and reverses the stops between them, keeping the change only when OneMap time decreases.

Reversals only operate across stops of identical priority tier.

Finally, the planner moves or swaps jobs between crews when that shortens the routes.

<!-- Slide number: 8 -->
8653E3
# Each dispatch is a full route: ordered stops, a crew, a vehicle and a logistics list
AF89F4
771FFF
Report
Rank
Plan
Review
Dispatch
Resolve
F66F87

Resident
Server
Server
Manager
Field team
Everyone
75F9AA

![gemini-head-and-shoulders-portrait-photograph-of-a-chin-fit1112x537-0.5_0.3.jpg](Picture31.jpg)

4CC9F0

![manager-route-crew-vehicle-logistics-956x775.png](Picture46.jpg)
FFD500

![manager-route-card-956x464.png](Picture41.jpg)
0C0120
272036
Rachel Lim
Operations Manager
Reviews each proposed route from its HQ

Edits stops, crew, vehicle and logistics list

A saved edit locks the route against replanning
Route: crew and stops
Crew, vehicle, logistics
Source: client/src/screens/operations/

### Notes:
Operations managers review full vehicle dispatches with assigned crews and ordered stops.

Stage four provides the operations manager review gate.

In D-Fence, a dispatch is never an isolated individual task.

A dispatch is one complete circuit that starts from HQ.

The left screen shows the Central Sanitation route.

The proposed schedule assigns field officers to ordered task locations.

This route takes three hours and twenty-eight minutes, inside the shift limit.

The right screen shows the route details page.

Rachel Lim inspects the assigned vehicle and crew members.

The page displays a logistics packing list that officers tick as they load equipment.

(firm, authoritative)

What I love most is that saving an edited route locks it against background re-planning.

Rachel Lim can adjust stops, swap vehicles, or modify crews, and her manual decision remains completely stable.

<!-- Slide number: 9 -->
8653E3
# The field officer opens one phone screen with the crew, van, load list and ordered stops
AF89F4
771FFF
Report
Rank
Plan
Review
Dispatch
Resolve
F66F87

Resident
Server
Server
Manager
Field team
Everyone
75F9AA

![gemini-field-officer-portrait-head-and-shoulders-of-a-m-fit1112x537-0.5_0.3.jpg](Picture31.jpg)

4CC9F0

![crew-dispatch-top-421x913.png](Picture40.jpg)

![crew-dispatch-stops-421x913.png](Picture45.jpg)
FFD500
0C0120
272036
Ahmad Faizal
Field Officer
Sees crew, van and plate for today's route
Sees the route fill 82% of a 4-hour shift
Ticks the load list; stops run in priority order
My dispatch
Ordered stops
Source: client/src/screens/crew/MyJobsScreen.tsx

### Notes:
Field officers manage daily work from a mobile device, packing required tools and following stops.

Stage five moves into physical field execution.

Ahmad Faizal signs in on his mobile phone and opens the My Jobs screen.

The top card displays today's dispatch for Central Team One.

The card shows the assigned crew, the van model, and the registration plate.

The planned route fills eighty-two per cent of the shift.

Field officers split time between vehicle travel and on-site treatment.

(point to the mobile checklist)

Ahmad Faizal checks off gear on the equipment load list as items enter the van.

Every checkbox tap persists immediately to the database.

The right phone screen lists the task stops in priority order.

The crew performs high-priority mosquito fogging first, followed by medium and low jobs.

This crew and its route are demo data on the live site.

<!-- Slide number: 10 -->
8653E3
# A table-driven state machine needs photo evidence before a job can close
AF89F4
771FFF
Report
Rank
Plan
Review
Dispatch
Resolve
F66F87

Resident
Server
Server
Manager
Field team
Everyone
75F9AA
4CC9F0
Created
Assigned
Accepted
In Progress
Completed
Verified
FFD500

Server
Manager
Field team
Field team
With evidence
Manager
0C0120
| Rule | Effect |
| --- | --- |
| Evidence | Photos, notes and time before Completed |
| Roles | The field team completes; only a manager verifies |
| Rework | Rejection returns the job to In Progress |

![manager-wo-detail-crop-fit2223x813-0.25_0.45.png](Picture49.jpg)
272036
Source: src/control/WorkOrderTransitionTable.ts

### Notes:
A strict lifecycle state table requires photographic evidence before any field task can close.

A table-driven state machine governs the complete work order lifecycle.

We implemented this logic in our WorkOrderTransitionTable class.

We chose one declarative table over a separate class for each state.

A single table keeps transition rules transparent and makes every branch directly testable.

A work order advances across six defined lifecycle states: Created, Assigned, Accepted, In Progress, Completed, and Verified.

Only the assigned field officer can advance a job to Completed.

The system strictly demands completion photos, treatment notes, and a timestamp before closing.

(emphasize role authority)

The key advantage is that only an operations manager can verify completed work.

If a manager rejects the submitted evidence, the job returns to In Progress with an explanatory reason.

<!-- Slide number: 11 -->
8653E3
# The resident and the manager see the same verified status when the work is done
AF89F4
771FFF
Report
Rank
Plan
Review
Dispatch
Resolve
F66F87

Resident
Server
Server
Manager
Field team
Everyone
75F9AA

![gemini-head-and-shoulders-portrait-photograph-of-a-mala-fit1112x537-0.5_0.3.jpg](Picture31.jpg)

4CC9F0

![m-resident-report-detail-2-421x913.png](Picture40.jpg)
FFD500

![manager-wo-detail-956x597.png](Picture46.jpg)
0C0120
272036
Nur Aisyah
Resident
My Reports shows each report's current status

Gets a Telegram alert if she linked her account
Every status change is kept in an append-only audit log
Resident: report timeline
Manager: verified job
Source: src/control/observer/

### Notes:
Residents and managers track identical verified outcomes when field teams complete their assignments.

Stage six completes the loop.

When Rachel Lim verifies a completed work order, all linked resident reports update immediately.

Nur Aisyah opens My Reports on her phone and sees the verified resolution status.

The operations manager sees the identical completion state on her dashboard.

Residents who connected their account receive an automated Telegram alert confirming the treatment.

(calm, conclusive)

Domain observers record every status transition in an append-only database audit log.

The platform maintains a permanent, tamper-resistant history of all municipal actions.

Citizen reports never disappear into unmonitored queues, because every step to verified resolution is recorded and visible to everyone.

<!-- Slide number: 12 -->
8653E3
# Each use case runs down one chain of classes: route, controller, port, repository, entity
AF89F4
771FFF
Report
Rank
Plan
Close
F66F87
Boundary
Report Routes
Work Order Routes
Crew Routes
75F9AA
4CC9F0

Control
Report Controller
Priority Scoring Engine
Route Optimization Service
Work Order Lifecycle Controller
FFD500
Ports (interfaces)
0C0120
Report Store
Priority Score Store
IRouteStrategy
Work Order Store
272036

Persistence
Report Repository
Priority Score Repository
Work Order Repository
Entity
Report
Priority Score
Work Order
Source: Import statements in src/; src/server.ts

### Notes:
(handoff point if the team splits here)

Three distinct architectural layers separate user interfaces from core business logic and storage.

Our system architecture follows the Boundary, Control, Entity design pattern.

Read each swimlane column on screen from top to bottom, where arrows represent dependency calls.

A boundary route class receives incoming HTTP requests, validates syntax, and calls one controller.

The controller executes business rules and depends strictly on abstract port interfaces.

For example, ReportController depends only on the ReportStore interface. A PostgreSQL repository implements that port and returns Report domain entities.

In route planning, WorkOrderRoutes calls RouteOptimizationService, which depends on the IRouteStrategy port.

Our OneMap road strategy implements that interface.

(highlight testability)

And this is where it gets interesting, because every port has an in-memory twin repository.

Unit tests use these twins and run without a database. At start-up, the server picks the real or in-memory version from its configuration.

<!-- Slide number: 13 -->
8653E3
# Five design patterns keep algorithms swappable and data ingestion safe to fail
AF89F4
771FFF
| Pattern | Where in the code | Why we use it |
| --- | --- | --- |
| Strategy | NormalisationStrategy, IRouteStrategy, IPestVisionStrategy | Swap a formula, router or vision model without changing callers |
| Template Method | AbstractIngestionJob | Every feed runs fetch, validate, transform, persist; a failure keeps old data |
| Observer | IReportObserver, IWorkOrderObserver, AuditLogObserver | State changes trigger audit and alerts without coupling |
| Adapter | OneMapGateway, TelegramGateway, NEAFeedGateway | External APIs map onto stable domain types |
| Repository | ReportRepository, WorkOrderRepository + in-memory twins | SQL and PostGIS stay behind port interfaces |
F66F87
75F9AA
4CC9F0
FFD500
0C0120
272036
Source: src/control/

### Notes:
Standard design patterns isolate external interfaces and keep background data ingestion pipelines resilient.

Our design applies five design patterns to solve concrete architectural challenges.

Strategy isolates normalisation formulas, routing algorithms, and pest vision models so we can swap implementations without altering callers.

Template Method structures our ingestion pipeline in AbstractIngestionJob.

Every external feed follows a uniform sequence: fetch, validate, transform, and persist.

(deliberate pace, stress safety)

A failed agency feed never corrupts stored data.

If an external API fails, the ingestion job logs a skip and preserves earlier database records.

Observer decouples work order lifecycle events from audit logging and Telegram alerts.

Adapters wrap OneMap, Telegram, and National Environment Agency endpoints into stable internal models.

Repositories isolate SQL queries and PostGIS spatial operations behind clean port contracts.

<!-- Slide number: 14 -->
8653E3
# One TypeScript stack runs from the browser to the cloud, grouped by purpose
AF89F4
771FFF
Front end
Back end
Data
F66F87

![nodedotjs-394x394.png](Picture27.jpg)

![express-394x394.png](Picture30.jpg)

![postgresql-316x316.png](Picture34.jpg)

![postgis.png](Picture37.jpg)

![supabase-316x316.png](Picture40.jpg)
75F9AA

![react-204x204.png](Picture14.jpg)

![typescript-204x204.png](Picture17.jpg)

![tailwindcss-204x204.png](Picture20.jpg)

![leaflet-204x204.png](Picture23.jpg)
4CC9F0
FFD500
React
TypeScript
Tailwind
Leaflet
Node.js
Express
PostgreSQL
PostGIS
Supabase
0C0120
Maps and external APIs
CI/CD and hosting
Testing
272036

![vitest-316x316.png](Picture61.jpg)

![testinglibrary-316x316.png](Picture64.jpg)

![playwright-316x316.png](Picture67.jpg)

![githubactions-394x394.png](Picture54.jpg)

![azure-394x394.png](Picture57.jpg)

![onemap.png](Picture44.jpg)

![telegram-316x316.png](Picture47.jpg)

![googlegemini-316x316.png](Picture50.jpg)
Vitest
Testing Library
Playwright
OneMap
Telegram
Gemini
Actions
Azure
Source: package.json; client/package.json. Logos: Simple Icons (CC0)

### Notes:
A unified TypeScript codebase connects browser interfaces with backend services and government endpoints.

Our team chose a unified TypeScript stack across the entire application lifecycle.

The slide organises our tools across six functional groups.

On the front end, React, TypeScript, and Tailwind CSS deliver clean user interfaces, while Leaflet renders maps and cluster boundaries.

On the back end, Node.js and Express manage API routes and controllers.

For data, PostgreSQL with the PostGIS spatial extension runs on Supabase in Singapore.

External services integrate OneMap for routing, Telegram for alerts, and Gemini for vision inspection.

GitHub Actions manages automated deployment to Azure App Service using OpenID Connect.

Our test suite runs on Vitest, React Testing Library, and Playwright.

<!-- Slide number: 15 -->
8653E3
# Four parallel checks gate every commit, then OIDC deploys the exact tested build
AF89F4
771FFF
Test and package
Disposable SQL
Migration guard
Workflow lint
F66F87

![vitest-72x72.png](Picture15.jpg)

![postgresql-72x72.png](Picture20.jpg)

![git-72x72.png](Picture25.jpg)

![githubactions-72x72.png](Picture30.jpg)
75F9AA
Typecheck, build, 1,247 tests
17 migrations on PostGIS 15
Released migrations stay append-only
actionlint checks the workflows
4CC9F0
FFD500
Sign in
Deploy
Verify live
0C0120

272036
1
2
3

![openid-72x72.png](Picture36.jpg)

![azure-72x72.png](Picture42.jpg)

![nodedotjs-72x72.png](Picture48.jpg)
Short-lived OIDC token, no stored password
Zip deploy to Azure App Service, restart
Health is ok; live hash equals tested zip

Tested build = live build. A throwaway PostGIS checks migrations without touching production.
Source: .github/workflows/deploy.yml; CI-CD.md

### Notes:
(handoff point if the team splits here)

Automated quality checks validate every commit before secure deployment pushes the release into production.

Four automated jobs run concurrently on every code push to protect code quality.

The first job checks types, builds packages, and executes all unit tests.

The second job applies every database migration to a disposable PostGIS container.

The third job verifies that committed SQL migration files remain strictly append-only.

The fourth job runs actionlint to validate GitHub Actions workflow syntax.

Deployment runs strictly on the main branch, and only when all four parallel checks pass.

(strong security emphasis)

Here is the part that got me, because Azure deployment uses short-lived OpenID Connect tokens without stored passwords.

The exact build artifact tested in CI deploys to Azure App Service.

Following restart, the pipeline polls our health endpoint and confirms that the live package hash matches the tested build.

<!-- Slide number: 16 -->
8653E3
# Six test layers check domain rules, real SQL and the live release
AF89F4
771FFF

![vitest-190x190.png](Picture13.jpg)
Unit and service
1,247 Vitest tests on scoring, routing and state tables
F66F87

![testinglibrary-190x190.png](Picture16.jpg)
Screens
75F9AA
23 screen suites with React Testing Library
4CC9F0

![postgis-190x190.png](Picture20.jpg)
Real SQL
17 migrations on a disposable PostGIS 15 in CI
FFD500

![nodedotjs-190x190.png](Picture24.jpg)
Smoke boot
0C0120
The release zip boots with outbound network blocked
272036

![playwright-190x190.png](Picture28.jpg)
Browser and accessibility
Playwright walkthroughs with axe-core checks

![azure-190x190.png](Picture32.jpg)
Live release
Health poll and live hash check after each deploy

Every layer tests the same build: in memory, on real SQL, then live.
Source: tests/; vitest run: 1,247 passed, 58 skipped, 89 files

### Notes:
Multiple automated testing layers verify domain logic in memory and on realistic databases.

Our verification strategy spans six distinct testing layers.

At the base, more than twelve hundred Vitest unit tests run against in-memory stores in seconds.

These tests thoroughly cover scoring formulas, route insertion heuristics, and state machine transitions.

Screen test suites validate UI components using React Testing Library.

Real database tests execute migrations on a disposable PostGIS container in CI to verify spatial queries.

(lean in, high confidence)

Our smoke test boots the release archive with outbound network access blocked.

This test proves that the release package is entirely self-contained.

Playwright end-to-end walkthroughs and axe-core check user journeys and accessibility.

Finally, deployment monitoring polls production health and verifies live package hashes after release.

<!-- Slide number: 17 -->
8653E3
# Caching, spatial indexes and hardening keep the app fast and safe under load
AF89F4
771FFF

Dispatch caching
Abuse protection
F66F87

![cache-180x180.png](Picture14.jpg)

![shield-180x180.png](Picture29.jpg)
Plans are precomputed and served from memory; data changes refresh them
15-minute lockout after failed sign-ins; bounded back-off on 429s
75F9AA
4CC9F0

FFD500
Spatial indexes
Security hardening

![database-180x180.png](Picture19.jpg)

![padlock-180x180.png](Picture34.jpg)
0C0120
PostGIS GIST indexes speed up containment and distance queries
scrypt hashing, server-side role checks, strict CSP and HSTS
272036

Data efficiency
Append-only audit

![download-180x180.png](Picture24.jpg)

![monitoring-180x180.png](Picture39.jpg)
SQL aggregation removes 3.2 MB per 5 min of rainfall traffic
Database triggers protect the audit log; errors carry a correlation ID
Source: src/control/DispatchPlanService.ts; src/entity/Account.ts

### Notes:
(handoff point if the team splits here)

In-memory route caching and spatial database indexes keep the live system fast and reliable.

DispatchPlanService precomputes and caches route schedules in memory, refreshing them only when data changes.

PostGIS GIST spatial indexes accelerate boundary containment and distance queries.

(proud delivery on concrete engineering gain)

Here is the result I like best. Moving rainfall aggregation into SQL removed three point two megabytes of traffic every five minutes.

Security controls enforce a lockout after repeated failed sign-in attempts, alongside bounded exponential back-off on rate-limited external calls.

Passwords use scrypt cryptographic hashing, and the server enforces strict Content Security Policy headers.

Database triggers keep the audit log append-only, and every operational error carries a unique correlation identifier.

<!-- Slide number: 18 -->

![close-resolved-fit4000x2250-0.5_0.5.jpg](Picture11.jpg)

# Report in. Resolved out.
8653E3
QUESTIONS AND DISCUSSION
AF89F4
Report in. Resolved out.
771FFF
F66F87
dfence-sc2006.azurewebsites.net
75F9AA
4CC9F0
FFD500
0C0120
272036

### Notes:
(handoff point if the team splits here)

Every report should end in a fix. With D-Fence, it finally can.

The data was always there. NEA maps the clusters. OneMap knows the roads. Every resident carries a camera. What was missing was one loop to join them.

(build the energy)

D-Fence is that loop, and it is live today.

(slow down, look at the room)

So next time you see stagnant water, you will not wonder if anyone is coming. You will know.

Open D-Fence on your phone and report what you see. Let's close the loop together.

(pause)

We are ready for your questions, on stale data feeds and on scaling to more crews.