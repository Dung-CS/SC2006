# D-Fence W13 Presentation Script

## Beat map, not yet confirmed

The 22 physical slides in D-Fence-W13-v2.pptx give 18 spoken beats.
Zero slides are merged. Zero slides are split. Zero beats are inserted. Slides 19 to 22 are appendix slides, marked not spoken. Use them only in Q&A.

| Slide | Physical slide | The one argument | Seconds | Cumulative |
|---|---|---|---|---|
| 1 | 1 | Your own report going nowhere shows the gap D-Fence closes | 50s | 00:50 |
| 2 | 2 | Three distinct roles share one system, from citizen hazard report to verified field resolution | 60s | 01:50 |
| 3 | 3 | Residents submit pest photographs, while an automated vision model detects and counts specimens | 65s | 02:55 |
| 4 | 4 | The platform ranks every hazard into one list, combining severity with live environmental urgency | 65s | 04:00 |
| 5 | 5 | A unified scoring formula rates every pest species on disease risk and active evidence | 80s | 05:20 |
| 6 | 6 | Automated route planning builds complete field schedules that fit within a single work shift | 65s | 06:25 |
| 7 | 7 | Fast straight-line filters screen candidate stops before official road routing verifies the best paths | 80s | 07:45 |
| 8 | 8 | Operations managers review full vehicle dispatches with assigned crews and ordered stops | 70s | 08:55 |
| 9 | 9 | Field officers manage daily work from a mobile device, packing required tools and following stops | 75s | 10:10 |
| 10 | 10 | A strict lifecycle state table requires photographic evidence before any field task can close | 65s | 11:15 |
| 11 | 11 | Residents and managers track identical verified outcomes when field teams complete their assignments | 65s | 12:20 |
| 12 | 12 | Three distinct architectural layers separate user interfaces from core business logic and storage | 75s | 13:35 |
| 13 | 13 | Standard design patterns isolate external interfaces and keep background data ingestion pipelines resilient | 70s | 14:45 |
| 14 | 14 | A unified TypeScript codebase connects browser interfaces with backend services and government endpoints | 60s | 15:45 |
| 15 | 15 | Every push runs four checks, and only a fully green build reaches production | 70s | 16:55 |
| 16 | 16 | We perform six layers of testing, from unit tests to full end-to-end testing | 30s | 17:25 |
| 17 | 17 | Six safeguards keep the app fast under load and safe from abuse | 60s | 18:25 |
| 18 | 18 | Think back to the stagnant water. Picture a future where every report ends in a fix | 55s | 19:20 |
| 19 | 19 | Appendix A1: how one priority score is built | not spoken | 19:20 |
| 20 | 20 | Appendix A2: severity holds back volume, and overrides beat arithmetic | not spoken | 19:20 |
| 21 | 21 | Appendix A3: how the planner inserts one task | not spoken | 19:20 |
| 22 | 22 | Appendix A4: how the planner improves finished routes | not spoken | 19:20 |

Total allocated time: 1,160 seconds (19 minutes 20 seconds). 40 seconds of slack remain inside the 20-minute slot.

---

## 1 · Cover (Team) · physical slide 1 · (0:00 to 0:50)

> Imagine it is Saturday night. You spot stagnant water behind your block, take a photo and report it.
>
> Two weeks later, the water is still there. Nobody came, and your neighbour is down with dengue.
>
> (pause, let the story land)
>
> **That gap between a report and a fix is what we set out to close.**
>
> We are proud to present D-Fence.
>
> D-Fence joins residents, operations managers and field officers in one loop. It ranks every hazard with live government data and plans routes that fit a four-hour shift.
>
> The system runs live on Azure today.

## 2 · Three stakeholders (Team) · physical slide 2 · (0:50 to 1:50)

> (handoff point if the team splits here)
>
> **Three distinct roles share one system, from citizen hazard report to verified field resolution.**
>
> Our software provides dedicated accounts for three key user roles.
>
> Nur Aisyah lives in Tampines. She wants to report stagnant water in under one minute, and she needs proof that teams treated the site. In the past, her reports vanished without updates.
>
> Rachel Lim directs operations. She needs to treat the highest-risk sites first and build routes that fit one shift. Scattered feeds and manual planning slowed her down.
>
> Ahmad Faizal is our field officer. He needs an ordered job list and the right gear packed before leaving HQ. Vague tasks and missing tools wasted his time on site.
>
> (emphasize the contrast)
>
> **What stands out in this design is that three separate roles share one verified data record.**
>
> Wildlife cases go to a dedicated wildlife response team in our own crew.

## 3 · Stage 1: Report (Team) · physical slide 3 · (1:50 to 2:55)

> **Residents submit pest photographs, while an automated vision model detects and counts specimens.**
>
> Stage one starts the operational loop. Nur Aisyah reports a pest hazard through our mobile web form or the map view.
>
> OneMap address search and device satellite coordinates resolve the exact location.
>
> She uploads a camera photo, or picks a sample test image.
>
> On upload, a Gemini vision model checks the photo.
>
> The model draws bounding boxes around detected pests and counts every specimen.
>
> (point to the phone mockups on screen)
>
> Nur Aisyah confirms the detected species and count with one tap before submitting.
>
> To protect operational capacity, our server checks existing nearby submissions.
>
> The platform refuses duplicate reports of the same pest within fifty metres.
>
> Background ingestion jobs also collect records from public agency feeds, so the system never depends on resident reports alone.

## 4 · Stage 2: Rank (Team) · physical slide 4 · (2:55 to 4:00)

> **The platform ranks every hazard into one list, combining severity with live environmental urgency.**
>
> Stage two computes operational priority.
>
> Background ingestion jobs pull active dengue clusters from the National Environment Agency, alongside rainfall readings and weather forecasts.
>
> Our scoring engine rates every municipal task by multiplying species severity by environmental urgency.
>
> Rachel Lim sees one clear ranked list instead of separate agency feeds.
>
> On screen, you see an active dengue cluster with one hundred and one cases.
>
> The engine calculates its priority score and places this cluster into the Medium tier.
>
> (steady tone, walk through the driver contributions)
>
> The interface displays each driver's contribution so the manager understands the calculation.
>
> Stale data feeds never hide.
>
> When a feed goes stale, the server redistributes that driver weight and flags the score as degraded.

## 5 · Rank in detail (Team) · physical slide 5 · (4:00 to 5:20)

> **A unified scoring formula rates every pest species on disease risk and active evidence.**
>
> One unified scoring queue holds every task across our catalogue of twenty-two pests.
>
> Severity is fixed per species based on disease risk, physical harm, statutory duty, and property damage.
>
> Mosquitoes and rats sit at the top of the severity scale.
>
> Urgency sums normalised data drivers, and the active driver set depends on the evidence available for that species.
>
> Mosquitoes belong to evidence tier A, supported by live government case counts and rainfall data.
>
> Tier B species incorporate citizen wildlife observations from iNaturalist.
>
> Tier C pests, including rats, depend on resident reports and treatment history.
>
> (lift energy on the practical trade-off)
>
> **What surprised our team was that a high-volume rat block can legitimately outrank a moderate dengue cluster.**
>
> At the same time, an influx of ant complaints can never displace genuine disease vectors.
>
> Life-safety cases, such as a snake indoors, a crocodile or an injury, skip the calculation and enter Critical priority immediately.

## 6 · Stage 3: Plan (Team) · physical slide 6 · (5:20 to 6:25)

> **Automated route planning builds complete field schedules that fit within a single work shift.**
>
> Stage three plans field routes for the teams.
>
> The route planner assigns ranked tasks to HQ teams for the days ahead.
>
> The map displays proposed routes, where each colour represents one field team starting from HQ.
>
> OneMap driving routes check every road travel leg.
>
> When a vehicle cannot park directly at the work site, the system checks pedestrian access.
>
> The planner allows only a short walk from the vehicle stopping point.
>
> (deliberate pace, stress the hard boundary)
>
> Each route sums driving travel, pedestrian walking, on-site treatment, and on-call buffer time.
>
> The combined total keeps every field route strictly under the four-hour shift limit.

## 7 · Plan in detail (Team) · physical slide 7 · (6:25 to 7:45)

> **Fast straight-line filters screen candidate stops before official road routing verifies the best paths.**
>
> Our route planner uses greedy insertion.
>
> The algorithm sorts the tasks first. Critical hazards come first, then jobs that few crews can do, then short jobs.
>
> For each task, the planner evaluates every available slot across all team schedules.
>
> The algorithm estimates transit time using straight-line distances.
>
> That simple estimate lets the engine test every potential slot cheaply.
>
> (lean forward, emphasize the optimization trick)
>
> **The best part is that OneMap verifies only the best six candidate slots.**
>
> OneMap returns verified road and walking travel times, and the task takes the slot with the lowest verified time increase.
>
> Then two-opt optimization cleans up each route.
>
> Two-opt cuts two legs and reverses the stops between them, keeping the change only when OneMap time decreases.
>
> Reversals only operate across stops of identical priority tier.
>
> Finally, the planner moves or swaps jobs between crews when that shortens the routes.

## 8 · Stage 4: Review (Team) · physical slide 8 · (7:45 to 8:55)

> **Operations managers review full vehicle dispatches with assigned crews and ordered stops.**
>
> Stage four provides the operations manager review gate.
>
> In D-Fence, a dispatch is never an isolated individual task.
>
> A dispatch is one complete circuit that starts from HQ.
>
> The left screen shows the Central Sanitation route.
>
> The proposed schedule assigns field officers to ordered task locations.
>
> This route takes three hours and twenty-eight minutes, inside the shift limit.
>
> The right screen shows the route details page.
>
> Rachel Lim inspects the assigned vehicle and crew members.
>
> The page displays a logistics packing list that officers tick as they load equipment.
>
> (firm, authoritative)
>
> **What I love most is that saving an edited route locks it against background re-planning.**
>
> Rachel Lim can adjust stops, swap vehicles, or modify crews, and her manual decision remains completely stable.

## 9 · Stage 5: Dispatch (Team) · physical slide 9 · (8:55 to 10:10)

> **Field officers manage daily work from a mobile device, packing required tools and following stops.**
>
> Stage five moves into physical field execution.
>
> Ahmad Faizal signs in on his mobile phone and opens the My Jobs screen.
>
> The top card displays today's dispatch for Central Team One.
>
> The card shows the assigned crew, the van model, and the registration plate.
>
> The planned route fills eighty-two per cent of the shift.
>
> Field officers split time between vehicle travel and on-site treatment.
>
> (point to the mobile checklist)
>
> Ahmad Faizal checks off gear on the equipment load list as items enter the van.
>
> Every checkbox tap persists immediately to the database.
>
> The right phone screen lists the task stops in priority order.
>
> The crew performs high-priority mosquito fogging first, followed by medium and low jobs.
>
> This crew and its route are demo data on the live site.

## 10 · Dispatch in detail (Team) · physical slide 10 · (10:10 to 11:15)

> **A strict lifecycle state table requires photographic evidence before any field task can close.**
>
> A table-driven state machine governs the complete work order lifecycle.
>
> We implemented this logic in our WorkOrderTransitionTable class.
>
> We chose one declarative table over a separate class for each state.
>
> A single table keeps transition rules transparent and makes every branch directly testable.
>
> A work order advances across six defined lifecycle states: Created, Assigned, Accepted, In Progress, Completed, and Verified.
>
> Only the assigned field officer can advance a job to Completed.
>
> The system strictly demands completion photos, treatment notes, and a timestamp before closing.
>
> (emphasize role authority)
>
> **The key advantage is that only an operations manager can verify completed work.**
>
> If a manager rejects the submitted evidence, the job returns to In Progress with an explanatory reason.

## 11 · Stage 6: Resolve (Team) · physical slide 11 · (11:15 to 12:20)

> **Residents and managers track identical verified outcomes when field teams complete their assignments.**
>
> Stage six completes the loop.
>
> When Rachel Lim verifies a completed work order, all linked resident reports update immediately.
>
> Nur Aisyah opens My Reports on her phone and sees the verified resolution status.
>
> The operations manager sees the identical completion state on her dashboard.
>
> Residents who connected their account receive an automated Telegram alert confirming the treatment.
>
> (calm, conclusive)
>
> Domain observers record every status transition in an append-only database audit log.
>
> The platform maintains a permanent, tamper-resistant history of all municipal actions.
>
> Citizen reports never disappear into unmonitored queues, because every step to verified resolution is recorded and visible to everyone.

## 12 · BCE architecture (Team) · physical slide 12 · (12:20 to 13:35)

> (handoff point if the team splits here)
>
> **Three distinct architectural layers separate user interfaces from core business logic and storage.**
>
> Our system architecture follows the Boundary, Control, Entity design pattern.
>
> Read each swimlane column on screen from top to bottom, where arrows represent dependency calls.
>
> A boundary route class receives incoming HTTP requests, validates syntax, and calls one controller.
>
> The controller executes business rules and depends strictly on abstract port interfaces.
>
> For example, ReportController depends only on the ReportStore interface. A PostgreSQL repository implements that port and returns Report domain entities.
>
> In route planning, WorkOrderRoutes calls RouteOptimizationService, which depends on the IRouteStrategy port.
>
> Our OneMap road strategy implements that interface.
>
> (highlight testability)
>
> **And this is where it gets interesting, because every port has an in-memory twin repository.**
>
> Unit tests use these twins and run without a database. At start-up, the server picks the real or in-memory version from its configuration.

## 13 · Design patterns (Team) · physical slide 13 · (13:35 to 14:45)

> **Standard design patterns isolate external interfaces and keep background data ingestion pipelines resilient.**
>
> Our design applies five design patterns to solve concrete architectural challenges.
>
> Strategy isolates normalisation formulas, routing algorithms, and pest vision models so we can swap implementations without altering callers.
>
> Template Method structures our ingestion pipeline in AbstractIngestionJob.
>
> Every external feed follows a uniform sequence: fetch, validate, transform, and persist.
>
> (deliberate pace, stress safety)
>
> A failed agency feed never corrupts stored data.
>
> If an external API fails, the ingestion job logs a skip and preserves earlier database records.
>
> Observer decouples work order lifecycle events from audit logging and Telegram alerts.
>
> Adapters wrap OneMap, Telegram, and National Environment Agency endpoints into stable internal models.
>
> Repositories isolate SQL queries and PostGIS spatial operations behind clean port contracts.

## 14 · Tech stack (Team) · physical slide 14 · (14:45 to 15:45)

> **A unified TypeScript codebase connects browser interfaces with backend services and government endpoints.**
>
> Our team chose a unified TypeScript stack across the entire application lifecycle.
>
> The slide organises our tools across six functional groups.
>
> On the front end, React, TypeScript, and Tailwind CSS deliver clean user interfaces, while Leaflet renders maps and cluster boundaries.
>
> On the back end, Node.js and Express manage API routes and controllers.
>
> For data, PostgreSQL with the PostGIS spatial extension runs on Supabase in Singapore.
>
> External services integrate OneMap for routing, Telegram for alerts, and Gemini for vision inspection.
>
> GitHub Actions manages automated deployment to Azure App Service using OpenID Connect.
>
> Our test suite runs on Vitest, React Testing Library, and Playwright.

## 15 · CI/CD pipeline (Team) · physical slide 15 · (15:45 to 16:55)

> (handoff point if the team splits here)
>
> **Every push runs four checks, and only a fully green build reaches production.**
>
> All of this lives in workflows/deploy.yml.
>
> Test and package builds the app, runs the unit tests and zips the release. This stops us from shipping broken code.
>
> Disposable SQL applies every migration to a blank PostGIS database. This catches a broken migration before it reaches the live DB.
>
> Migration guard blocks edits to a released migration. This keeps the live DB and a fresh DB on the same schema.
>
> Workflow lint checks the workflow file itself, so an error in the pipeline can't break or skip a deploy.
>
> (strong security emphasis)
>
> **Once all four checks pass, GitHub signs in to Azure with a short-lived token.**
>
> It then adds any new tables and columns to the live DB, so the code never runs ahead of its schema.
>
> Next, the zip with the app and its dependencies is unpacked and started. Health and file checks confirm that the right version is live.
>
> Only after those checks pass does it remove old schema that the code no longer uses. Then it checks health once more. So if a release goes wrong, the last good zip still fits the database, and rollback is just a redeploy.

## 16 · Testing strategy (Team) · physical slide 16 · (16:55 to 17:25)

> **We perform six layers of testing, from unit tests to full end-to-end testing.**
>
> Each layer catches what the one below it cannot. Unit tests are fast, so they run on every change. End-to-end tests are slower, but they prove the real app works for a real user.
>
> You will find all of them in the tests folder.

## 17 · Operational robustness (Team) · physical slide 17 · (17:25 to 18:25)

> (handoff point if the team splits here)
>
> **Six safeguards keep the app fast under load and safe from abuse.**
>
> The left column is speed. The right column is safety.
>
> For speed, DispatchPlanService builds route plans ahead of time and keeps them in memory.
>
> Spatial indexes in the first migration make map lookups fast. A spatial index groups shapes by location, so a query checks only the nearby areas instead of every one.
>
> (proud delivery on concrete engineering gain)
>
> **SQL aggregation means the database adds up the rainfall readings itself and sends back only the totals. Here is the result I like best. Doing that cut three point two megabytes of traffic every five minutes.**
>
> For safety, Account dot ts locks an account after repeated failed sign-ins. The HTTP client backs off when an outside service says slow down.
>
> Passwords are stored as scrypt hashes. A database trigger blocks any edit to the audit log.
>
> And every error carries an ID, so one complaint maps to one log line.

## 18 · Close (Team) · physical slide 18 · (18:25 to 19:20)

> (handoff point if the team splits here)
>
> **So think back to that stagnant water behind your block.**
>
> Too often, the resident never learns if anyone came.
>
> D-Fence closes that gap. The resident reports. The server ranks and plans. The manager reviews, and the field team fixes. Everyone sees the same verified result.
>
> (build the energy)
>
> Picture a future where every report ends in a fix. Residents trust that someone is coming. Managers send crews where the risk is highest. And dengue stops at the source, before it reaches the next neighbour.
>
> (slow down, look at the room)
>
> Report in. Resolved out. D-Fence is live today, at the address on screen.
>
> (pause)
>
> Thank you. We are ready for your questions, on stale data feeds and on scaling to more crews.

---

## Q&A

Anticipated questions from examiners and classmates, with verified single-sentence answers grounded in project specifications, architecture, and live deployment records.

### Questions we expect

1. **How does the priority scoring engine handle conflicting or delayed external data feeds?**
When an external agency feed becomes stale, the engine redistributes that driver weight proportionally across the remaining active drivers and flags the score as degraded.

2. **How does the routing algorithm scale as the number of tasks or vehicles increases?**
Fast straight-line geometric estimation screens thousands of candidate slots in milliseconds, so only the top six candidate slots make external calls to OneMap road routing.

3. **Why did you choose a table-driven state machine instead of Gang of Four State pattern subclasses?**
WorkOrderTransitionTable centralises transition permissions into one declarative structure, making permitted paths easy to audit and basis path testing straightforward.

4. **How do you prevent duplicate pest reports from overwhelming field operations?**
The server automatically refuses duplicate submissions of the same pest species reported within fifty metres and twenty-four hours.

5. **Why are wildlife pests handled differently from mosquitoes and rats?**
Mosquitoes and rats carry statutory eradication duties and direct public health risks rated at severity one point zero zero, whereas non-vector wildlife cases go to a dedicated wildlife response team through the normal dispatch flow.

6. **What happens if a field officer arrives at a site that cannot be reached directly by vehicle?**
The planner validates drivable road routes first, and if direct vehicle access is impossible, verifies a pedestrian walking leg of ten minutes or less from the nearest vehicle access point.

7. **How does the application prevent data loss during background ingestion failures?**
The AbstractIngestionJob template method wraps fetch, validate, transform, and persist steps, so a network or schema failure logs a skip while retaining the previous valid database records.

8. **What is the response time and memory footprint of dispatch route planning?**
Dispatch routes are precomputed and cached in memory by DispatchPlanService, serving cached plans and refreshing in the background when scores or clusters change.

### Data and figures cut from the spoken script

Every figure cut from the spoken script under the one-figure budget is preserved here for reference during technical questioning:

- **Slide 3 (Stage 1 Report)**: Duplicate report time window is twenty-four hours alongside the fifty-metre radius constraint.
- **Slide 4 (Stage 2 Rank)**: Active dengue cluster calculated score is forty-eight point seven, and five separate public agency feeds are ingested.
- **Slide 5 (Rank in detail)**: High priority threshold is seventy, and Medium priority threshold is forty. Species severity ratings: Macaque 0.92, Wild Boar 0.83, Cockroach 0.75, Snake 0.75, Bee or Wasp 0.75, Pigeon 0.58, Bed Bug 0.50, Termite 0.33. Urgency weights: NEA case size and growth 0.50, rainfall 0.20, premises mix 0.05, open reports 0.10 to 0.35, report velocity 0.20 to 0.25, corroborations 0.10 to 0.15, iNaturalist 90-day sightings 0.20, days since treatment 0.15 to 0.20, distance to operator 0.05.
- **Slide 5 (Rank in detail, severity)**: Mosquitoes and rats carry the top severity rating of 1.00.
- **Slide 6 (Stage 3 Plan)**: Planning horizon is seven operational days. The walking leg limit is ten minutes or less.
- **Slide 8 (Stage 4 Review, shift)**: The shift ceiling is four hours.
- **Slide 7 (Plan in detail)**: Straight-line transit estimate speed is thirty-five kilometres per hour. Two-opt runtime reduction example shows fifty-five minutes reduced to thirty-seven minutes, saving eighteen minutes.
- **Slide 8 (Stage 4 Review)**: Central Sanitation route specifics: two field officers, four ordered stops, thirty-six minutes of driving travel, eight-item logistics packing list.
- **Slide 9 (Stage 5 Dispatch)**: Central Team One specifics: three hours and sixteen minutes total duration, thirty-one minutes of transit travel, one hundred and sixty-five minutes of on-site work, four stops, eleven-item load list.
- **Slide 15 (CI/CD pipeline)**: Test suite contains one thousand two hundred and forty-seven automated tests, and database migration suite contains seventeen migrations executed on disposable PostGIS fifteen.
- **Slide 16 (Testing strategy)**: Screen test suite comprises twenty-three React Testing Library test suites, and database container is PostGIS fifteen.
- **Slide 17 (Operational robustness)**: Authentication enforces a fifteen-minute account lockout after repeated failed sign-in attempts.
- **Code map for slides 15 to 17** (for a TA question on where something lives): pipeline in .github/workflows/deploy.yml; packaging and smoke boot in tools/package-release.mjs and tools/smoke-release.mjs; migration guard in tools/check-migrations.mjs; unit and screen tests in tests/ (helpers in tests/helpers, fixtures in tests/fixtures); real SQL test in tests/repository.test.ts; browser sweep in tests-ui/ui-sweep.pw.ts; plan cache in src/control/DispatchPlanService.ts; spatial indexes and audit trigger in src/persistence/migrations/001_initial_schema.sql; rainfall SQL in src/persistence/RainfallRepository.ts; lockout in src/entity/Account.ts; back-off in src/boundary/gateways/HttpClient.ts; scrypt in src/persistence/CredentialRepository.ts; security headers in src/boundary/http/ExpressApp.ts; error ID in src/boundary/http/RouteHandler.ts.

### Unknown facts protocol

If asked for a number or implementation metric not recorded on the slides or in this briefing, recite this exact sentence:

> "The deck does not carry that. I would rather come back to you with a real figure than guess at one."

---

## Checks before you present

All assertions verified against the built PowerPoint presentation and codebase:

1. **Lead lines**: All 18 lead lines contain between 10 and 15 words, strictly obey the 18-word ceiling, contain at most two clauses, and contain zero statistics.
2. **Spoken word budget**: Spoken words total about 2,216 after the slide 16 rewrite (2,307 before), inside the band of 2,185 to 2,415. That implies 19.3 minutes at 115 words per minute. The slack is deliberate and leaves time for the live demo.
3. **Punctuation sweep**: Searches for em dash, en dash, and semicolon yielded zero hits across the entire presentation script and notes file.
4. **Figure verification**: Every spoken number appears directly on the slide or in its notes line:
   - Slide 1: 'four hours' matches the shift duration cap in the cover notes.
   - Slide 2: 'one minute' matches the resident reporting goal on slide two.
   - Slide 3: 'fifty metres' matches the duplicate threshold on slide three (twenty-four hours parked in Q&A).
   - Slide 4: 'one hundred and one cases' matches the cluster case size on slide four (score 48.7 and the five feeds parked in Q&A).
   - Slide 5: 'twenty-two pests' matches the pest catalogue size on slide five (the 1.00 severity rating, weights and other severities parked in Q&A).
   - Slide 6: 'four-hour shift limit' matches slide six (seven-day horizon and ten-minute walk parked in Q&A).
   - Slide 7: 'best six' matches the top candidate slots verified by OneMap in slide seven notes (35 km/h and 18-minute savings parked in Q&A). Slide seven's two-opt table still labels the start 'Depot'. The script says HQ.
   - Slide 8: 'three hours and twenty-eight minutes' matches the Central Sanitation route duration on slide eight (four stops and eight items parked in Q&A).
   - Slide 9: 'eighty-two per cent' matches the shift capacity percentage on slide nine (3h 16m, 31m travel, 165m site time and the four stops parked in Q&A).
   - Slide 10: 'six defined lifecycle states' matches the six states on slide ten.
   - Slide 11: Zero statistics spoken, which is fully compliant.
   - Slide 12: Zero statistics spoken, where five swimlane layers are visible on slide twelve.
   - Slide 13: 'five design patterns' matches the five rows on slide thirteen.
   - Slide 14: 'six functional groups' matches the six logo clusters on slide fourteen.
   - Slide 15: 'four checks' is a label for the four boxes on screen. No statistic is spoken (1,247 tests and 17 migrations parked in Q&A). File paths spoken: .github/workflows/deploy.yml.
   - Slide 16: 'six layers' is a label for the six rows on screen. No statistic is spoken. The layers themselves (1,247 Vitest tests, component tests, integration tests on PostGIS, the release smoke test, Playwright and axe in tests-ui, deployment verification) are on the slide and parked in Q&A.
   - Slide 17: 'three point two megabytes' matches the SQL aggregation bandwidth reduction on slide seventeen (15-minute lockout parked in Q&A).
   - Slide 18: Zero statistics spoken. 'The address on screen' is dfence-sc2006.azurewebsites.net on slide eighteen. The close follows the SilverGate pattern: think back, picture a future, then the tagline. It makes no ask.
5. **Energy beats**: Eight energy beats, on slides 2, 5, 7, 8, 10, 12, 15 and 17. Each sits at least 90 seconds after the previous one, each is bolded, and no phrase repeats. The slide 4, 13 and 16 beats were demoted to plain lines to keep the spacing. The slide 18 picture-a-future line is plain, not bold, because it falls under 90 seconds after the slide 17 beat.

---

## Timing table

| Slide | Slide title | Seconds | Cumulative | Drop order / Cut priority |
|---|---|---|---|---|
| 1 | Cover | 50s | 00:50 | Priority 9 (Never cut: opening cold open, credentials, and D-Fence introduction) |
| 2 | Three stakeholders | 60s | 01:50 | Priority 4 (Can drop stakeholder pain point details if time presses) |
| 3 | Stage 1: Report | 65s | 02:55 | Priority 8 (Essential: resident reporting entry point and AI vision) |
| 4 | Stage 2: Rank | 65s | 04:00 | Priority 8 (Essential: severity times urgency core ranking mechanism) |
| 5 | Rank in detail | 80s | 05:20 | Priority 3 (Can trim lower pest severity details, but retain rat vs dengue principle) |
| 6 | Stage 3: Plan | 65s | 06:25 | Priority 8 (Essential: four-hour shift limit and road-then-foot routing) |
| 7 | Plan in detail | 80s | 07:45 | Priority 2 (Can trim two-opt arithmetic, but retain straight-line to OneMap concept) |
| 8 | Stage 4: Review | 70s | 08:55 | Priority 7 (Essential: manager review gate, fixed route lock, and packing list) |
| 9 | Stage 5: Dispatch | 75s | 10:10 | Priority 7 (Essential: field mobile execution and checklist persistence) |
| 10 | Dispatch in detail | 65s | 11:15 | Priority 5 (Can trim transition table implementation details, but retain evidence rule) |
| 11 | Stage 6: Resolve | 65s | 12:20 | Priority 8 (Essential: closed loop, resident verification, and audit log) |
| 12 | BCE architecture | 75s | 13:35 | Priority 9 (Never cut: core software engineering architecture and testability) |
| 13 | Design patterns | 70s | 14:45 | Priority 3 (Can trim secondary design pattern descriptions) |
| 14 | Tech stack | 60s | 15:45 | Priority 1 (First to cut: logo visual speaks for itself) |
| 15 | CI/CD pipeline | 70s | 16:55 | Priority 4 (Can trim the workflow lint and migration guard lines, but keep the deploy.yml path) |
| 16 | Testing strategy | 30s | 17:25 | Priority 6 (Can drop the why-layers line, but keep the six layers and the tests folder) |
| 17 | Operational robustness | 60s | 18:25 | Priority 2 (Can trim the password and error ID lines) |
| 18 | Close | 55s | 19:20 | Priority 9 (Never cut: closing loop, picture-a-future vision, and Q&A handoff) |
| 19 to 22 | Appendix | 0s | 19:20 | Not spoken. Open only to answer a ranking or routing question |

Total allocated time: 1,160 seconds (19 minutes 20 seconds). 40 seconds of slack remain inside the 20-minute slot.