# LAB 5: Team Sprint Meeting Minutes (Weeks 2–13)

**Module:** SC2006 / CZ2006 Software Engineering  
**Project:** D-Fence — Smart Nation Vector & Pest Control Platform  
**Team Members:** Chow Yen Kit, Dung, Team Members  
**Meeting Cadence:** Weekly Sprint Checkpoints (Hybrid: NTU The Arc / Discord / Telegram)  

---

## Meeting 1: Project Kickoff & Domain Scoping
* **Date & Time:** Week 2, Friday, 14:00 – 16:00
* **Location:** The Arc, NTU Learning Hub North
* **Attendees:** All team members
* **Agenda:**
  1. Team role allocation and communication channels setup.
  2. Problem domain selection: Vector-borne diseases (Dengue) vs general pest control.
  3. Analysis of course rubrics and Lab 1 deliverables.
* **Key Decisions:**
  - Selected D-Fence: Smart Nation Vector & Pest Control platform addressing municipal fragmentation between resident reporting and field dispatch.
  - Adopted strict Clean Architecture / Boundary-Control-Entity (BCE) design philosophy.
  - Setup GitHub organization and branch management protocols (`main`, `dev`, feature branches).
* **Action Items:**
  - Yen Kit: Draft initial Software Requirements Specification (SRS) structure and data dictionary.
  - Dung & Team: Review NEA Dengue cluster and weather API availability on data.gov.sg.

---

## Meeting 2: SRS Specification & Requirements Analysis (Lab 1 Gate)
* **Date & Time:** Week 3, Wednesday, 15:30 – 17:30
* **Location:** Discord Voice / Virtual
* **Attendees:** All team members
* **Agenda:**
  1. Review of atomic requirement drafting (SRS v0.1–v0.5).
  2. Structuring functional vs non-functional requirements.
  3. Formalisation of the mathematical priority scoring formula.
* **Key Decisions:**
  - Decided on 694 atomic, uniquely identified requirements to prevent duplicate or vague specs.
  - Structured the priority score as a multi-criteria weighted sum: premises vulnerability, case counts, 72-hour rainfall history, and historical treatment decay.
  - Finalized Lab 1 submission package (`REQUIREMENTS.md`, `DATA-DICTIONARY.md`).
* **Action Items:**
  - Dung: Upload Lab 1 submission to course GitHub.
  - All: Prepare for Lab 2 Use Case modelling.

---

## Meeting 3: Use Case Modelling & BCE Class Derivation
* **Date & Time:** Week 5, Thursday, 14:00 – 16:30
* **Location:** The Hive, NTU
* **Attendees:** All team members
* **Agenda:**
  1. Mapping user stories to UML Use Cases (Actors: Resident, Manager, Crew, External Feeds).
  2. Derivation of 48 use case descriptions following the Wiegers template.
  3. Boundary-Control-Entity (BCE) class diagram drafting.
* **Key Decisions:**
  - Adopted 3 human actors (`Resident`, `Operations Manager`, `Cleaning Crew Member`) inheriting from abstract `Registered User`.
  - Derived 27 interactive screens and 7 external gateways as Boundary classes.
  - Separated `DispatchController` (assignment) from `WorkOrderLifecycleController` (state transitions) to ensure single-responsibility lifecycle enforcement.
* **Action Items:**
  - Yen Kit: Complete PlantUML diagrams (`class-diagram-entity.puml`, `class-diagram-boundary-control.puml`, `use-case-diagram.puml`).
  - Dung & Team: Draft UI Dialog Map and screen layout wireframes.

---

## Meeting 4: BCE Analysis Review & Refinement (Lab 2 Gate)
* **Date & Time:** Week 6, Friday, 16:00 – 18:00
* **Location:** Discord Voice / Virtual
* **Attendees:** All team members
* **Agenda:**
  1. Internal peer review of Lab 2 deliverables against TA feedback.
  2. Review of spatial clustering and complete-link deduplication.
  3. Finalisation of `USE-CASE-DESCRIPTIONS.md` and `ANALYSIS-MODEL.md`.
* **Key Decisions:**
  - Added `ReportSpatialGroup` entity and `ReportSpatialClustering` control class for 100m deduplication.
  - Enforced standing lockstep rule: `lab2/USE-CASE-DESCRIPTIONS.md` and `lab3/USE-CASE-DESCRIPTIONS.md` must remain strictly byte-identical.
  - Approved Lab 2 deliverable package for submission.
* **Action Items:**
  - Team: Archive Lab 2 package and begin technical prototyping of the React + Express stack.

---

## Meeting 5: Detailed Design & Design Patterns Selection
* **Date & Time:** Week 8, Tuesday, 14:00 – 16:00
* **Location:** The Arc, NTU
* **Attendees:** All team members
* **Agenda:**
  1. Transition from Analysis BCE to Detailed Design Model.
  2. Selection and justification of GoF Design Patterns.
  3. Database schema design with PostgreSQL and PostGIS.
* **Key Decisions:**
  - Selected 4 GoF patterns directly solving core architectural problems:
    1. **Factory Method (`NormalisationFactory`)**: Encapsulates normalisation across heterogenous sensor feeds.
    2. **Strategy Pattern (`ClusterTrendStrategy`)**: Dynamically selects clustering/scoring strategies.
    3. **Adapter Pattern (`OneMapGateway`, `NEAFeedGateway`, `PestVisionGateway`)**: Decouples external API schemas from internal domain entities.
    4. **State Machine (`WorkOrderLifecycleController`)**: Enforces legal state transitions via an immutable transition table.
  - Configured Supabase PostgreSQL with PostGIS extensions for spatial radius queries (`ST_DWithin`, `ST_Contains`).
* **Action Items:**
  - Yen Kit: Author `DESIGN-MODEL.md` and `DESIGN-PATTERNS.md`.
  - Dung & Team: Scaffold React frontend and Tailwind CSS styling system.

---

## Meeting 6: System Implementation & Sprint Review (Lab 3 Gate)
* **Date & Time:** Week 9, Friday, 15:00 – 17:30
* **Location:** Discord Voice / Virtual
* **Attendees:** All team members
* **Agenda:**
  1. Review of implemented frontend screens and backend REST API endpoints.
  2. Verification of Lab 3 submission deliverables.
  3. Integration of Singapore OneMap authentication and routing.
* **Key Decisions:**
  - Enforced road-only verified driving routing: offshore or non-road-accessible points are rejected with explicit feedback rather than falling back to straight-line Euclidean approximations.
  - Finalized Lab 3 deliverables (`DESIGN-MODEL.md`, `DESIGN-PATTERNS.md`, PUML design diagrams).
* **Action Items:**
  - All: Transition into core testing phase for Lab 4.

---

## Meeting 7: Quality Assurance, EP/BVA & Basis Path Testing (Lab 4 Gate)
* **Date & Time:** Week 11, Wednesday, 14:00 – 17:00
* **Location:** The Hive, NTU
* **Attendees:** All team members
* **Agenda:**
  1. Design of Black-Box Equivalence Partitioning (EP) and Boundary Value Analysis (BVA) test suites.
  2. Design of White-Box Basis Path Testing for `WorkOrderLifecycleController.isTransitionPermitted()`.
  3. Construction of Cyclomatic Complexity $V(G)$ control flow graphs.
* **Key Decisions:**
  - Selected `PriorityScoringEngine` for EP/BVA: boundary thresholds at 40.0 (Medium/Low) and 70.0 (High/Medium) tested with $x \pm 0.01$ precision.
  - Calculated Cyclomatic Complexity $V(G) = 11$ for the work order state machine; derived 11 linearly independent test paths covering 100% statement and branch coverage.
  - Reached 1,258 automated unit tests passing across 90 test files in Vitest.
* **Action Items:**
  - Yen Kit: Complete `TEST-PLAN.md` and automated webdriver scripts.
  - Dung & Team: Author `DEMO-SCRIPT.md` detailing cue sheets and fallbacks.

---

## Meeting 8: Multi-Vehicle Fleet Dispatch & AI Multimodal Integration
* **Date & Time:** Week 12, Monday, 16:00 – 18:30
* **Location:** Discord Voice / Virtual
* **Attendees:** All team members
* **Agenda:**
  1. Addition of Multi-Vehicle Dispatch editor in the operations dashboard.
  2. Introduction of vehicle entity, capacity tracking, and `isFixed` pin locking.
  3. Integration of Google AI Studio Gemini Multimodal Vision API.
* **Key Decisions:**
  - Added interactive multi-vehicle fleet tabs (Van-1 Soon Lee West Depot, Van-2 Central Depot).
  - Implemented `isFixed` pin locking: allows operations managers to lock critical emergency tasks at stop 1 while remaining stops re-optimize automatically.
  - Deployed Gemini Vision structured outputs in `PestVisionGateway` for automated resident image classification and report pre-fill.
* **Action Items:**
  - Yen Kit: Implement backend fleet dispatch services and Gemini API integration.
  - Dung & Team: Update frontend UI with multi-vehicle tabs and photo upload preview chips.

---

## Meeting 9: Live Rehearsal, Cloud Deployment & Video Walkthrough
* **Date & Time:** Week 13, Tuesday, 13:00 – 16:00
* **Location:** The Arc, NTU
* **Attendees:** All team members
* **Agenda:**
  1. Production deployment on Azure App Service (`dfence-sc2006`, Malaysia West).
  2. Rehearsal of live 15-minute presentation script (`presentation-w13/D-Fence-W13-v4.pptx`).
  3. Automated Playwright video walkthrough execution (`w13_video_walkthrough_webdriver.py`).
* **Key Decisions:**
  - Verified zero-defect production run: 11/11 live demo checks and 12/12 video walkthrough checks passing against production Azure endpoint.
  - Recorded 5–7 minute walkthrough video covering citizen intake, AI screening, manager dispatch editing, and field completion.
  - Cleaned up database seeding scripts to ensure repeatable demo execution.
* **Action Items:**
  - Yen Kit: Generate automated video recording and finalize script notes.
  - Team: Review slide deck animations and speaker notes.

---

## Meeting 10: Final Lab 5 Submission Sign-Off & Viva Readiness
* **Date & Time:** Week 13, Friday, 15:00 – 17:00
* **Location:** Discord Voice / Virtual
* **Attendees:** All team members
* **Agenda:**
  1. Final review of the full deliverable package across Labs 1 through 5.
  2. Verification of Requirements Traceability Matrix (`TRACEABILITY-MATRIX.md`).
  3. Individual peer review submission confirmation.
* **Key Decisions:**
  - Confirmed 100% completion of all Lab 5 requirements (Master Index, Traceability Matrix, Demo Video Script, Submission Checklist, Meeting Minutes).
  - Executed git commit and pushed to team submission repository (`Dung-CS/SC2006.git`).
  - Signed off on equal team contribution and submitted peer assessment forms.
* **Action Items:**
  - All: Ready for final viva demonstration and examiner Q&A!
