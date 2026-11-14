<!-- Slide number: 1 -->

![cover-estate-fit1680x2250-0.5_0.5.jpg](Picture13.jpg)
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
D-Fence closes one loop: a resident reports a breeding site, the system ranks it, a crew is routed to it, and the resident sees it resolved. It is live on Azure. The deck uses the site's dark palette; the font is Segoe UI because Inter is not installed on the build machine.

<!-- Slide number: 2 -->
8653E3
# One app gives four parties one closed loop
AF89F4
771FFF

![resident-map-fit2038x1713-0_0.5.png](Picture12.jpg)

![smartphone-270x270.png](Picture14.jpg)
Resident
F66F87
Reports a site. Tracks it to Resolved.
75F9AA
4CC9F0
Operations Manager

![dashboard-270x270.png](Picture17.jpg)
Sees ranked risk. Books crews and routes.
FFD500
0C0120
Crew

![truck-270x270.png](Picture21.jpg)
272036
Follows the route. Uploads photo proof.

![building-270x270.png](Picture25.jpg)
Authority (AVS, NParks)
Receives wildlife referrals.

### Notes:
Three roles share one system: Resident, Operations Manager and Cleaning Crew. External authorities such as AVS and NParks receive referrals for wildlife cases that D-Fence does not dispatch itself. The screenshot is the resident dengue map in the live dark site. Risk ranking blends live rainfall, forecast and dengue cluster data with each report. Gemini screens report photos for pests.

<!-- Slide number: 3 -->
8653E3
# Four outcomes set D-Fence apart
AF89F4
771FFF

1 Live data decides

![monitoring-270x270.png](Picture13.jpg)
F66F87
Rainfall, forecast and clusters become one ranked queue. Evidence: 7 weighted drivers; rain polled every 5 min.
75F9AA
4CC9F0

![map-270x270.png](Picture16.jpg)
2 Routes hold
FFD500
Crews get road-verified routes inside four hours. Evidence: OneMap legs checked; 4-hour cap in code.
0C0120
3 One shared record

![handshake-270x270.png](Picture20.jpg)
272036
Residents, managers and crews act on the same data. Evidence: report, moderate, assign, complete, audit.

![certified-270x270.png](Picture24.jpg)
4 Tested = live
Every release is the build that passed the tests. Evidence: hash check; 1,243 tests; real Postgres job.
Source: Grader remarks 2026-08-28; course grading brief

### Notes:
These are the WHAM areas: outcomes that earn marks beyond the expected standard. The grader said the app must consume live data, process it, and support several users on shared state. The course also rewards architecture and a rigorous process. Each area is tagged with its number on the slides that prove it: 3 on the data flow, 1 on prioritisation, 2 on routing, 4 on CI/CD and testing.

<!-- Slide number: 4 -->
8653E3
# One report moves through five steps to resolved
AF89F4
771FFF
Resident reports
Server ranks
Manager books
Crew proves
Resident sees it
F66F87

1
2
3
4
5
75F9AA
4CC9F0

![smartphone-198x198.png](Picture16.jpg)

![database-198x198.png](Picture22.jpg)

![dashboard-198x198.png](Picture28.jpg)

![truck-198x198.png](Picture34.jpg)

![inbox-198x198.png](Picture40.jpg)
FFD500
0C0120
POST /api/reports with photos
Plan cache clears. Report joins the queue.
Assigns crew, vehicle and route
Completes the job with photo proof
Report closes. Audit entry. Alert.
272036

WHAM 3
One shared record: report, moderate, assign, complete, audit.

### Notes:
Every step is an HTTPS JSON call: POST /api/reports, /api/ops/dispatch/assign, /api/crew/work-orders/:id/complete. Gemini checks the photo and the report is verified by default. The new report clears the plan cache, so it joins the plan as an unplanned task within seconds. Booked routes do not change on their own. Completing a work order closes the report, writes an audit entry and sends an alert, by Telegram when linked. Residents can also corroborate each other's reports.

<!-- Slide number: 5 -->
8653E3
# Seven weighted drivers turn live data into a ranked queue
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
Each driver to 0-1
100 x severity x weighted mean
Critical, High, Medium, Low
One list, rank 1 first
4CC9F0
| Driver | Weight | Scaled by |
| --- | --- | --- |
| Case size | 0.30 | log, ref 300 |
| Case growth | 0.20 | log, ref 40 |
| Days since treatment | 0.15 | decay, 60 days |
| Rainfall 72 h | 0.12 | cap 120 mm |
| Verified open reports | 0.10 | cap 5 |
| Rainfall 24 h | 0.08 | cap 50 mm |
| Premises mix | 0.05 | as given |
| Tier | Rule |
| --- | --- |
| Critical | Verified report hits an override rule. Score kept. |
| High | Score 70.0 or above |
| Medium | 40.0 to 69.9 |
| Low | Below 40.0 |
| Ties | Severity, open reports, locality name |
| Grouping | Within 100 m (default), same pest, type, task |
FFD500
0C0120
272036

WHAM 1
Output: one ranked list, each score with its driver breakdown.
Source: config/scoring.default.json; src/control/Priority*.ts

### Notes:
Score = 100 x pest severity x (sum of weight x scaled value) / (sum of weights present). The mosquito has severity 1.0. A driver whose source is stale is dropped and the rest are re-weighted; the score is then marked degraded. Weights are committed JSON and must sum to 1.0 at load. Ranking puts every Critical first, then descending score, then severity, then verified open reports, then locality name, so the order is total. Critical comes from configured rules on verified reports only and keeps the score. The 100 m grouping is complete-link: every pair in a group must be within the limit (default 100 m, set between 1 and 1000).

<!-- Slide number: 6 -->
8653E3
# Priority-first routing builds crew routes inside hard limits
AF89F4
771FFF

![dispatch-routes-fit1742x1428-0.5_0.5.png](Picture52.jpg)

![users-162x162.png](Picture13.jpg)

![truck-162x162.png](Picture17.jpg)

![clock-162x162.png](Picture21.jpg)

![map-162x162.png](Picture25.jpg)
F66F87
Staff
Cargo
Four hours
OneMap
75F9AA
Capability, count and HQ match
Seats, payload and cargo fit
Drive, walk, work, delay
Verified driving legs
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
Try each gap. Check up to 6 routes.
Road legs and walk access
Reverse, swap or move a task

WHAM 2
Output: routes with verified roads, plus unassigned tasks.
Source: RouteOptimizationService.ts, routing/

### Notes:
The method is priority-first greedy insertion with bounded local search, so it does not prove the plan is shortest. Each route starts and ends at the crew HQ. Total time = driving + walking + work + on-call delay, at most four hours. For each task the planner ranks insertion candidates by a straight-line estimate, then checks up to six through OneMap and keeps the smallest accepted rise in verified travel time. Driving legs must join into one circuit. Walking access from a vehicle point must take ten minutes or less. Local search allows 64 within-route and 136 cross-route checks. A task can stay unassigned when no checked option meets every limit; a high priority does not guarantee a slot. Wildlife, bird, bee and wasp cases need the Authority Response capability. Source: docs/ROUTING-ALGORITHM-STE100.md and the code.

<!-- Slide number: 7 -->
8653E3
# A thin client calls a layered server on one database
AF89F4
771FFF

Browser

React 18 SPA

esbuild

Tailwind
F66F87

75F9AA
Boundary

18 route modules

12 gateways

Security headers
4CC9F0

Control
FFD500

Services

Scoring

Routing
0C0120

Persistence

Postgres repositories

In-memory twins

17 migrations
272036

Data

Supabase Postgres

PostGIS

Private photo buckets

Outside services

OneMap

data.gov.sg

Gemini

Telegram

### Notes:
The browser only talks JSON over HTTPS. Each store has a Postgres repository and an in-memory twin, chosen at start-up by DATABASE_URL, which is how tests run without a database. The repo folders mirror the layers: src/boundary, src/control and src/persistence, with client/ for the app. Timers inside the server pull rainfall every 5 minutes, the forecast every 6 hours and dengue clusters hourly. Scoring weights are committed JSON in config/.

<!-- Slide number: 8 -->
8653E3
# Mainstream tools carry the stack from browser to cloud
AF89F4
771FFF
Used in the repo
F66F87

![react-415x415.png](Picture14.jpg)

![typescript-415x415.png](Picture17.jpg)

![nodedotjs-415x415.png](Picture20.jpg)

![express-415x415.png](Picture23.jpg)

![postgresql-415x415.png](Picture26.jpg)

![postgis.png](Picture29.jpg)
75F9AA
4CC9F0
FFD500
React
TypeScript
Node.js
Express
PostgreSQL
PostGIS
0C0120

![supabase-415x415.png](Picture32.jpg)

![azure-415x415.png](Picture35.jpg)

![githubactions-415x415.png](Picture38.jpg)

![leaflet-415x415.png](Picture41.jpg)

![onemap.png](Picture44.jpg)

![telegram-415x415.png](Picture47.jpg)
272036
Supabase
Azure
GitHub Actions
Leaflet
OneMap
Telegram

React and Leaflet in the browser. Express on Node. Postgres on Supabase. Azure and GitHub Actions deliver it.
Source: Logos: Simple Icons (CC0); Azure, PostGIS, OneMap from owners' pages

### Notes:
Every logo maps to a dependency or service in the repo: package.json (React, Leaflet, Express, pg), the TypeScript sources, deploy.yml (GitHub Actions, Azure), DEPLOY.md (Supabase, PostGIS), OneMapGateway.ts and TelegramGateway.ts. Logo credits: Simple Icons (CC0) for React, TypeScript, Node.js, Express, PostgreSQL, Supabase, GitHub Actions, Leaflet and Telegram. The Azure, PostGIS and OneMap logos come from the owners' public pages via Google Images. All marks belong to their owners.

<!-- Slide number: 9 -->
8653E3
# Two managed services run the app with no keys in the repo
AF89F4
771FFF
GitHub Actions
Azure App Service
Supabase Singapore
F66F87

1
2
3
75F9AA
4CC9F0

![coding-198x198.png](Picture16.jpg)

![globe-198x198.png](Picture22.jpg)

![database-198x198.png](Picture28.jpg)
FFD500
0C0120
Builds and tests. Signs in by OIDC.
Linux B1, Node 24, East Asia. Secrets in App Settings.
Postgres, PostGIS, signed photo reads over TLS.
272036

No stored deploy password. HTTPS is forced. The app refuses to start if a secret is missing.

### Notes:
CI signs in to Azure with a GitHub OIDC credential, scoped to Website Contributor on this one app. Runtime secrets live only in Azure App Settings. East Asia was chosen because the Azure for Students policy refused Southeast Asia.

<!-- Slide number: 10 -->
8653E3
# Four gates run on every push and only main deploys
AF89F4
771FFF
Test and package
Real Postgres
Migration guard
Workflow lint
F66F87

![test-tube-72x72.png](Picture15.jpg)

![database-72x72.png](Picture20.jpg)

![shield-72x72.png](Picture25.jpg)

![compliance-72x72.png](Picture30.jpg)
75F9AA
Typecheck, build, tests, smoke boot
All 17 migrations, SQL tests
Released files stay unedited
actionlint, checksum-pinned
4CC9F0
FFD500
Hash check
Sign in
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
Archive equals tested archive
Azure by OIDC
Upload, restart
/api/health, 5 min
Server equals tested build

WHAM 4
Tested build = live build. Migration 017 reached production once; the Postgres gate now stops that.
Source: .github/workflows/deploy.yml; CI-CD.md

### Notes:
Every push runs four jobs in parallel. Deploy needs all four and runs only on main, one at a time. The exact zip that passed the tests is the one deployed. Migration 017 passed the in-memory tests, so a real Postgres run now catches that class of bug.

<!-- Slide number: 11 -->
8653E3
# Six test layers run from one function to the live site
AF89F4
771FFF

![tracking-190x190.png](Picture13.jpg)
Live checks
Health poll and server hash after each deploy
F66F87

![computer-vision-190x190.png](Picture16.jpg)
UI sweep
75F9AA
Playwright and axe, run before release
4CC9F0

![speed-190x190.png](Picture20.jpg)
Smoke boot
Release zip boots with network blocked
FFD500

![database-190x190.png](Picture24.jpg)
SQL tests
0C0120
17 migrations from empty on Postgres
272036

![smartphone-190x190.png](Picture28.jpg)
Screen tests
23 files with Testing Library

![calculator-190x190.png](Picture32.jpg)
Unit and service
1,243 Vitest tests pass in the 2026-10-31 run

WHAM 4
Each layer proves the same build: in memory, on real SQL, then live.
Source: tests/, tests-ui/; vitest run 2026-10-31

### Notes:
Most tests use the in-memory twins, so the suite needs no database and runs on every push. The Postgres job proves the same repositories against real SQL. The smoke test boots the packaged zip with outbound fetch blocked. The UI sweep runs locally, not in CI. The full run of 2026-10-31 had 1,301 tests: 1,243 passed, 58 were skipped because they need a live database, and none failed.

<!-- Slide number: 12 -->
8653E3
# Targeted limits keep the app fast, cheap and safe
AF89F4
771FFF

Caching
Abuse limits
F66F87

![cache-180x180.png](Picture14.jpg)

![shield-180x180.png](Picture29.jpg)
Dispatch plans held in memory. New reports clear them.
15-minute sign-in lock-out. HTTP 429 on photo AI quota.
75F9AA
4CC9F0

FFD500
Database
Security

![database-180x180.png](Picture19.jpg)

![padlock-180x180.png](Picture34.jpg)
0C0120
PostGIS GIST indexes for maps. Time-ordered indexes.
scrypt passwords, server-side roles, CSP and HSTS.
272036

Monitoring
Data cost

![download-180x180.png](Picture24.jpg)

![monitoring-180x180.png](Picture39.jpg)
Correlation ids, append-only audit, ingestion run log.
Cut a poll that moved 3.2 MB every 5 minutes.

### Notes:
Abuse limits are targeted, not global: there is no general rate limiter. Plans are debounced at 250 ms. GIST indexes serve spatial queries. Every error carries a correlation id that matches a log line, and a database trigger keeps the audit trail append-only.

<!-- Slide number: 13 -->

![close-resolved-fit1680x2250-0.5_0.5.jpg](Picture13.jpg)
# Report in. Resolved out.
8653E3
QUESTIONS?
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
To recap: one loop from report to resolved, four outcomes that earn marks, a layered server you can read folder by folder, four gates before every deploy, and targeted limits, caching and monitoring. Credits: logos from Simple Icons (CC0), plus the Azure, PostGIS and OneMap logos from their owners' public pages. Screenshots are from the live D-Fence site.