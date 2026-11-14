# D-Fence W13 Presentation Script - Draft 1 (ASD-STE100)

## Slide 1: Cover
In Tampines, a resident finds stagnant water behind her residential block.
She submits a report through the municipal portal.
Her report disappears into an untracked queue without status feedback.
No field team arrives to inspect or clean the breeding site.
Our software engineering team built a platform to remove that operational failure.
Good morning, examiners and fellow classmates.
We present D-Fence.
D-Fence connects the resident, the operations manager, and the field officer in one accountable data loop.
The backend server scores every reported hazard against live environmental data.
The system automatically plans road-checked vehicle routes that take under four hours.
Operations managers review each route and commit the daily field dispatch.
Field officers perform the physical remediation work and submit photographic evidence.
Both the resident and the operations manager receive immediate status updates.
The complete software application operates live on Microsoft Azure cloud infrastructure.

## Slide 2: Three stakeholders
Three distinct roles share one system, from citizen hazard report to verified field resolution.
The software application provides dedicated accounts for three user roles.
Nur Aisyah lives in a Tampines housing estate.
She wants to report stagnant water in under one minute.
She wants to see proof that municipal teams treated the reported site.
Her past reports vanished without status progress updates.
Rachel Lim manages municipal pest eradication operations.
She wants field teams to treat the highest-risk hazard sites first.
She wants daily field routes that fit within a single four-hour shift.
She struggled with scattered data feeds and manual route scheduling.
Ahmad Faizal works as an operational field officer.
He wants an ordered job list with clear geographical stops.
He wants to pack the correct equipment before leaving headquarters.
He struggled with vague task instructions and missing tools on site.
The platform provides separate interfaces for residents, operations managers, and field officers.
The system routes non-vector wildlife cases to external partner authorities as referrals.

## Slide 3: Stage 1: Report
Residents submit pest photographs, while an automated vision model detects and counts specimens.
Stage one starts the operational service loop.
Nur Aisyah reports a pest hazard through the mobile web form or the map interface.
OneMap address search or device satellite positioning finds the exact geographical location.
Nur Aisyah uploads a camera photograph, or selects a sample test image.
On upload, a Gemini vision model scans the image bytes.
The vision model draws a bounding box around each detected specimen.
The model counts the total number of pest specimens in the image.
The resident reviews the detected species and count before final submission.
The resident confirms or corrects the details with one tap.
The backend server checks existing database reports in the immediate vicinity.
The server refuses duplicate reports of the same pest species within fifty metres and twenty-four hours.
Background ingestion jobs also collect hazard records from public agency feeds.
The operational loop therefore does not depend on citizen reporting alone.

## Slide 4: Stage 2: Rank
The platform ranks every hazard into one list, combining severity with live environmental urgency.
Stage two calculates operational task priority.
Automated ingestion jobs pull active dengue cluster records from the National Environment Agency.
The ingestion pipeline also collects twenty-four-hour rainfall readings and regional weather forecasts.
The scoring engine evaluates every municipal task across all pest species.
The engine calculates total priority by multiplying species severity by environmental urgency.
Rachel Lim reviews one consolidated priority queue instead of five separate agency data feeds.
The operations management screen displays an active dengue cluster with one hundred and one cases.
The scoring engine calculates a priority score of forty-eight point seven.
This score places the dengue cluster in the Medium priority tier.
The interface displays the exact numerical contribution from each mathematical driver.
When an external agency feed becomes stale, the system redistributes that driver weight.
The engine flags the resulting score as degraded so the operations manager knows.

## Slide 5: Rank in detail
A unified scoring formula rates every pest species on disease risk and active evidence.
One scoring queue holds every municipal task across all twenty-two catalogue pests.
Fixed severity ratings derive from disease transmission, direct physical harm, statutory duty, and property damage.
Mosquitoes and rats receive the maximum severity rating of one point zero zero.
Environmental urgency is a weighted sum of normalised data drivers.
The active driver set depends on the empirical evidence available for that species.
Mosquito hazards belong to evidence tier A with live government case feeds and rainfall.
Tier B species add citizen wildlife sightings from iNaturalist within ninety days.
Tier C pests, including rats, depend on resident reports and past treatment history.
A residential block with many verified rat reports can outrank a moderate dengue cluster.
A high volume of ant reports cannot outrank genuine disease vectors.
A calculated score of seventy or higher assigns the High priority tier.
A score of forty or higher assigns the Medium priority tier.
Life-safety hazards skip standard arithmetic and enter the Critical tier immediately.
Such hazards include venomous snakes indoors, crocodile sightings, or reported human injuries.

## Slide 6: Stage 3: Plan
Automated route planning builds complete field schedules that fit within a single work shift.
Stage three plans daily vehicle dispatches for field teams.
The route optimization planner assigns ranked tasks to regional depot teams.
The planner builds recommended routes across a seven-day operational horizon.
The operations map displays routes in distinct colours for each depot team.
OneMap driving routing services verify every road travel leg.
When a vehicle cannot park directly at a site, the system checks pedestrian access.
The system permits a walking leg of ten minutes or less from the vehicle.
Each planned route sums driving travel, pedestrian walking, on-site treatment, and on-call buffer time.
The combined route duration remains strictly below the four-hour shift limit.
This strict duration constraint prevents worker fatigue and ensures schedule compliance.

## Slide 7: Plan in detail
Fast straight-line filters screen candidate stops before official road routing verifies the best paths.
The planning engine uses a greedy insertion algorithm.
The engine first sorts pending tasks by operational urgency.
Critical hazards come first, followed by jobs requiring scarce officer skills, then shorter tasks.
For each task, the algorithm tests every possible insertion slot in every crew schedule.
The algorithm estimates transit time using straight-line distance at thirty-five kilometres per hour.
This fast calculation tests thousands of candidate combinations in milliseconds.
The engine sends only the best six candidate slots to the OneMap routing service.
OneMap returns exact road driving and pedestrian walking times.
The system inserts the task into the slot with the lowest verified time increase.
The engine then applies a two-opt local search optimization to each route.
The two-opt step cuts two route legs and reverses the intermediate stop sequence.
The engine keeps the reversed sequence only when verified OneMap travel time decreases.
The algorithm restricts reversals to stops within the same priority tier.
A final swap routine moves tasks between teams to balance daily workloads.

## Slide 8: Stage 4: Review
Operations managers review full vehicle dispatches, containing assigned crews, equipment lists, and ordered stops.
Stage four provides the operations manager review gate.
A dispatch is never an isolated individual job.
A dispatch represents one complete circuit originating from a regional depot.
The left screen shows the proposed Central Sanitation route.
The route assigns two field officers to four ordered task locations.
The route consumes three hours and twenty-eight minutes against the four-hour limit.
Estimated vehicle transit requires thirty-six minutes.
The right screen shows the route details page.
Rachel Lim inspects the assigned vehicle and crew members.
The screen presents an eight-item logistics packing list.
Field officers tick each item on this list as they pack equipment.
Rachel Lim can adjust assigned crew members, change vehicles, or reorder task stops.
When Rachel Lim saves manual route modifications, the system flags the dispatch as fixed.
Subsequent automated planning runs never overwrite a fixed dispatch.

## Slide 9: Stage 5: Dispatch
Field officers manage daily work from a mobile device, packing required tools and following stops.
Stage five covers operational execution in the field.
Ahmad Faizal signs in on his mobile phone and opens the jobs screen.
The primary card displays today's assigned route for Central Team One.
The card shows his team partner, their vehicle model, and the vehicle registration plate.
The planned route occupies three hours and sixteen minutes of the four-hour shift.
Field officers spend thirty-one minutes travelling and one hundred and sixty-five minutes on site.
The route fills eighty-two per cent of the available four-hour shift capacity.
The officer checks items on an eleven-item equipment load list before leaving the depot.
Every checkbox interaction immediately saves to the server database.
The mobile screen displays the four assigned stops in strict execution sequence.
The team conducts high-priority mosquito fogging first, followed by medium and low tasks.
The current route displays verified demonstration records on the production system.

## Slide 10: Dispatch in detail
A strict lifecycle state table requires photographic evidence before any field task can close.
A table-driven state machine governs the complete work order lifecycle.
The development team implemented this logic in the WorkOrderTransitionTable class.
The team chose a state transition table instead of individual GoF state subclasses.
A declarative table keeps transition permissions clear and makes basis paths easy to test.
A work order progresses through six sequential lifecycle states.
These states are Created, Assigned, Accepted, In Progress, Completed, and Verified.
Only the assigned field officer can transition a work order to the Completed state.
The system requires photographic evidence, operational notes, and a timestamp before completion.
Only an operations manager possesses authority to transition the order to Verified.
If a manager rejects submitted evidence, the system returns the work order to In Progress.
The rejection record captures a mandatory explanatory reason for the field crew.

## Slide 11: Stage 6: Resolve
Residents and managers track identical verified outcomes when field teams complete their assignments.
Stage six closes the operational feedback loop.
When Rachel Lim verifies a completed work order, the server updates all linked resident reports.
Nur Aisyah opens the My Reports screen and sees the updated verified status.
The operations manager sees the identical completion state on the management console.
The system dispatches an automated Telegram notification to residents who linked accounts.
Domain observers capture every lifecycle transition in an append-only database audit log.
The platform preserves full operational history for administrative review and public accountability.
This transparent workflow ensures that citizen complaints never disappear without recorded action.

## Slide 12: BCE architecture
Boundary, control, and entity layers separate user interfaces from core business logic and storage.
Our software architecture follows the boundary, control, entity design pattern.
Read each swimlane column from top to bottom, where arrows represent dependency calls.
A boundary route class receives the incoming HTTP network request.
The route validates input syntax and delegates execution to a single controller class.
The controller executes application business rules and calls abstract port interfaces.
For example, the ReportController depends strictly on the ReportStore interface.
A PostgreSQL repository implements that port interface and returns Report domain entities.
In route planning, WorkOrderRoutes calls the RouteOptimizationService controller.
The optimization service depends on the abstract IRouteStrategy port interface.
The OneMap road routing class implements that port strategy.
Every domain port provides an in-memory twin repository for automated testing.
The main server startup file selects real or in-memory implementations from environment variables.

## Slide 13: Design patterns
Standard design patterns isolate external interfaces and keep background data ingestion pipelines resilient.
The engineering design applies five standard Gang of Four software patterns.
The Strategy pattern abstracts normalisation formulas, routing algorithms, and pest vision models.
Callers swap algorithmic implementations without changing internal business logic.
The Template Method pattern structures background ingestion in the AbstractIngestionJob class.
Every data job executes an identical sequence of fetch, validate, transform, and persist steps.
When an external agency feed fails, the job logs the error and preserves existing database records.
The Observer pattern decouples lifecycle state transitions from audit logging and Telegram notifications.
Adapter classes wrap the OneMap, Telegram, and National Environment Agency network endpoints.
These adapters convert external data payloads into stable internal domain structures.
The Repository pattern isolates SQL and PostGIS database queries behind clean interface contracts.

## Slide 14: Tech stack
A unified TypeScript ecosystem connects browser interfaces, cloud backend services, and external government endpoints.
The application uses one TypeScript codebase across both client and server tiers.
The architecture groups technologies across six distinct operational domains.
On the front end, React, TypeScript, and Tailwind CSS deliver responsive user interfaces.
Leaflet renders interactive map views and geospatial hazard boundaries.
On the back end, Node.js and Express handle HTTP routing and API requests.
The data layer uses PostgreSQL with the PostGIS spatial extension hosted on Supabase in Singapore.
External services include OneMap for routing, Telegram for notifications, and Gemini for vision inspection.
Continuous integration uses GitHub Actions to build and deploy releases to Azure App Service.
Automated testing relies on Vitest, React Testing Library, and Playwright browser automation.

## Slide 15: CI/CD pipeline
Automated quality checks validate every commit before secure deployment pushes the release into production.
Four automated check jobs execute concurrently on every code push.
The first job compiles TypeScript, builds application packages, and executes one thousand two hundred and forty-seven tests.
The second job executes seventeen database migrations against a disposable PostGIS container in CI.
The third job verifies that committed migration scripts remain append-only and unmodified.
The fourth job runs actionlint to validate GitHub Actions workflow syntax.
Production deployment runs strictly on the main branch, and only when all four parallel jobs pass.
The system deploys the exact tested build archive into Azure App Service.
Azure authentication uses short-lived OpenID Connect tokens, eliminating permanent stored deployment secrets.
Following container restart, the pipeline polls the health endpoint and verifies the live SHA-256 package hash.

## Slide 16: Testing strategy
Multiple automated testing layers verify domain logic in memory, on realistic databases, and live.
Our verification architecture spans six comprehensive testing layers.
The unit and service layer runs one thousand two hundred and forty-seven Vitest tests against in-memory stores.
These tests validate scoring formulas, route heuristics, and state machine transitions in seconds.
The screen testing layer executes twenty-three test suites using React Testing Library.
Real database tests execute seventeen migrations on a temporary PostGIS fifteen container in CI.
A smoke boot test launches the release archive with outbound network access blocked.
This check proves that the application bundle contains all required runtime dependencies.
Playwright end-to-end tests automate user walkthroughs, while axe-core validates accessibility standards.
Finally, deployment monitoring polls production health endpoints and verifies live deployment package hashes.

## Slide 17: Operational robustness
In-memory plan caching, spatial database indexes, and hardened network controls guarantee reliable production performance.
The platform implements specific engineering controls to maintain performance and operational safety.
DispatchPlanService precomputes and caches route schedules in memory, refreshing them when underlying data changes.
PostGIS GIST spatial indexes accelerate polygon containment and geographic proximity queries.
Database SQL aggregation reduced rainfall network transfer by three point two megabytes every five minutes.
Authentication security enforces a fifteen-minute lockout after repeated failed sign-in attempts.
Outbound HTTP clients implement bounded exponential back-off when receiving rate-limit responses.
Password storage uses scrypt cryptographic hashing.
The server enforces role-based access checks, strict Content Security Policy headers, and HTTP Strict Transport Security.
Database triggers protect the audit log from unauthorized updates, and errors carry unique correlation identifiers.

## Slide 18: Close
D-Fence delivers an open, accountable municipal service that turns citizen reports into proven resolutions.
D-Fence closes the gap between citizen hazard reporting and verifiable municipal action.
Resident submissions and public data feeds produce a transparent, mathematically justified priority score.
Automated route optimization ensures that daily field dispatches respect strict shift constraints.
Field teams execute ordered tasks using mobile checklists and mandatory photographic proof.
Operations managers verify completed work before updating public hazard records.
The complete application operates live at dfence-sc2006.azurewebsites.net.
We welcome your questions on our software design, architecture, and testing.
