# D-Fence W13 Presentation: Merge Scan Report

This document records the specific, repository-grounded content scanned from the team draft (`review-20261107/md/D-Fence-Presentation.79a0d18fff5b6a40.md`), evaluated against the current deck (`dfence-w13.outline.md` / `review-20261107/md/D-Fence-W13.791585c55de8e420.md`) and verified against the live codebase (`smart_nation/dengue/src/`).

---

## 1. Kept Items (Specific, True to Repo, Missing from Current Deck)

### Item 1: Work-Order Lifecycle & State Machine
- **Source Slide:** Team Slide 9 ("Completed and Verified mean different things")
- **Repo Source:** `src/control/WorkOrderTransitionTable.ts`, `src/entity/enums.ts`, `REQUIREMENTS.md` §8.3.1–8.3.21
- **Specific Technical Content:**
  - Strict 6-state progression: `Created` -> `Assigned` -> `Accepted` -> `In Progress` -> `Completed` -> `Verified` (plus terminal `Cancelled`).
  - Table-driven state machine (`TransitionRule[]`), deliberately rejecting GoF State subclasses to keep transition rules declarative and basis-path testable.
  - Crucial semantic separation between **`Completed`** (field crew upload with mandatory photo proof, completion timestamp, notes, and task-performed confirmation) and **`Verified`** (Operations Manager review and formal acceptance).
  - Rejection with reason: A manager can reject completion evidence (`HAS_REJECTION_REASON`), returning the work order to `In Progress` for crew rework.
  - Role and actor guards: Transitions strictly enforced by `actor: Role` and `assigneeOnly: boolean` (only assigned crew can accept, progress, or complete).
- **Target Slide in V2:** Insert as a dedicated slide in the Journey / Process sequence following "Stage 5: Crew Dispatched".

### Item 2: Boundary-Control-Entity (BCE) with Ports & Adapters Architecture
- **Source Slide:** Team Slide 5 ("Clear modules inside a single server application")
- **Repo Source:** `src/boundary/`, `src/control/`, `src/entity/`, `src/ports/Stores.ts`, `src/persistence/`, `src/server.ts`
- **Specific Technical Content:**
  - Clear structural layer mapping:
    - `src/boundary/`: HTTP route handlers (`/api/reports`, `/api/ops/*`, `/api/crew/*`) and external gateway clients (`OneMapGateway`, `TelegramGateway`, `NEAFeedGateway`).
    - `src/control/`: Domain use-case controllers (`PriorityScoringEngine`, `RouteOptimizationService`, `WorkOrderLifecycleController`, `AbstractIngestionJob`).
    - `src/entity/`: Domain models and invariants (`WorkOrder`, `DengueCluster`, `PriorityScore`, `PestReport`).
    - `src/ports/`: Abstract interfaces decoupling storage (`ClusterStore`, `WorkOrderStore`, `ReportStore`) and external gateways (`Stores.ts`).
    - `src/persistence/`: Dual implementations—production Postgres/PostGIS repositories alongside in-memory twins for zero-database unit and CI testing.
  - Composition Root in `src/server.ts`: Wires concrete stores and gateways dynamically at boot based on `DATABASE_URL` and environment variables.
- **Target Slide in V2:** Replaces current S7 ("System Architecture") to give rigorous BCE + Ports layout with real class names and folder paths.

### Item 3: Software Design Patterns Mapped to Operational Challenges
- **Source Slide:** Team Slides 6, 7, 8 ("Design Patterns: Strategy, Template Method, Observer, Adapter, Repository")
- **Repo Source:** `src/control/normalisation/`, `src/control/routing/`, `src/control/ingestion/AbstractIngestionJob.ts`, `src/control/observer/`, `src/boundary/gateways/`, `src/ports/Stores.ts`
- **Specific Technical Content:**
  - **Strategy Pattern:**
    - Scoring Normalisation (`NormalisationStrategy`): Logarithmic for exponential case counts/growth, Capped Linear for rain/reports, Recency Decay for treatment age (`src/control/normalisation/`).
    - Route Optimization (`IRouteStrategy`): OneMap road driving network vs road-then-foot pedestrian bridging (`src/control/routing/`).
    - Computer Vision (`IVisionStrategy`): Gemini 3 Flash multimodal screening vs deterministic mock vision (`src/control/vision/`).
  - **Template Method Pattern:**
    - `AbstractIngestionJob.ts`: Invariant pipeline (`run()`: log start -> fetch/conditional skip -> validate -> transform -> persist -> log result). Concrete jobs (`ClusterIngestionJob`, `RainfallIngestionJob`, `ForecastIngestionJob`) implement specific step hooks.
    - Architectural invariant: Unchanged publisher data is a recorded successful skip; fetch errors preserve historical data rather than dropping records.
  - **Observer Pattern:**
    - In-process typed event bus (`ReportObserver`, `WorkOrderObserver`, `ClusterObserver`) decoupling state mutations from audit logging and Telegram notifications (`src/control/observer/`).
  - **Adapter Pattern:**
    - Boundary gateways wrap external third-party schemas (OneMap, Telegram, data.gov.sg GeoJSON, Supabase Storage) into domain-compatible entities.
  - **Repository Pattern:**
    - Stores encapsulate persistence mechanisms behind domain port interfaces.
- **Target Slide in V2:** Insert as a dedicated "Design Patterns" slide following BCE Architecture.

### Item 4: Two-Input Operational Convergence
- **Source Slide:** Team Slide 10 ("Two evidence inputs feed one operational loop")
- **Repo Source:** `src/server.ts`, `src/control/ingestion/`, `src/boundary/routes/reports.ts`, `src/control/scoring/`
- **Specific Technical Content:**
  - Explicit distinction between automated institutional telemetry (NEA dengue clusters, 5-min weather station rainfall, 24h weather forecasts) and resident citizen reports.
  - Both data streams converge in the centralized PostGIS database and jointly feed the multi-factor scoring engine and dispatch optimization.
- **Target Slide in V2:** Integrated into Journey Stage 1 / Stage 2 and Data Flow framing.

### Item 5: Concrete Operational Limits and CI Hygiene
- **Source Slide:** Team Slide 18 & 20 ("Disposable PostGIS", "Operational Boundaries")
- **Repo Source:** `.github/workflows/deploy.yml`, `tools/smoke-release.mjs`, `CI-CD.md`
- **Specific Technical Content:**
  - Disposable PostGIS 15 container in CI running all 17 migrations from scratch with SSL; zero production database exposure.
  - Release smoke boot script (`tools/smoke-release.mjs`) boots packaged artifact in an isolated sandbox with outbound HTTP blocked.
  - Explicit operational boundaries: CI proves deployment package integrity; production migrations are controlled manual steps; no automatic rollback.
- **Target Slide in V2:** Incorporated into CI/CD pipeline (Slide 10) and Robustness/Boundaries (Slide 12).

---

## 2. Dropped Items (Generic, Fluff, or Redundant)

| Team Slide | Content / Heading | Reason for Dropping |
|---|---|---|
| **Slide 1** | "Know what matters. Send the right team. Verify the outcome. 25-minute presentation" | Generic marketing slogans and presentation timing notes; does not belong in executive slide content. |
| **Slide 2** | "Where is the problem? Who can handle it? Was it resolved?" | Generic rhetorical questions; replaced by concrete 6-stage journey flow. |
| **Slide 3** | "Different screens support different responsibilities" | Generic truism. Stakeholder roles are detailed on Slide 2 with authentic persona cards. |
| **Slide 4** | "A browser client, an API server, persistent records, and provider integrations" | Superficial tech list. Replaced by categorized Tech Stack slide with real logos. |
| **Slides 13–16** | Step-by-step live demo click sequences (`/map -> /locations -> /report...`) | Rehearsal instructions for presenters, not slide presentation content. |
| **Slide 21** | "An accountable path from observation to action" | Generic summary slide. Deck S13 closing ("Report in. Resolved out.") is concise and punchy. |
| **Slide 22** | "Appendix / Rehearsal: Three browser profiles..." | Presenter setup notes, not a deliverable presentation slide. |
