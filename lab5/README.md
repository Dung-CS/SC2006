# LAB 5: Final Project Demonstration & Deliverables Index

**Module:** SC2006 / CZ2006 Software Engineering  
**Project:** D-Fence — Smart Nation Vector & Pest Control Platform  
**Live Production URL:** [https://dfence-sc2006.azurewebsites.net](https://dfence-sc2006.azurewebsites.net)  
**Deployment Region:** Azure App Service (`dfence-sc2006`, B1 Linux Always-On) in **Malaysia West**  
**Cloud Database:** Supabase PostgreSQL (`ap-southeast-1` Singapore) with PostGIS & 17 applied schema migrations  
**Demo Credentials:** `resident`/`resident`, `manager`/`manager`, `crew`/`crew`

---

## 1. Master Navigation Index across All Lab Deliverables

| Deliverable | Lab Stage | Location / File Path | Description |
|---|---|---|---|
| **Software Requirements Specification (SRS)** | Lab 1 & 5 | `lab1/REQUIREMENTS.md` & `REQUIREMENTS.md` | Complete v0.11 specification: 694 atomic requirements, zero duplicate IDs, covering cross-pest scoring, multi-vehicle dispatch, and Gemini Vision. |
| **Use Case Model & Diagrams** | Lab 1 & 2 & 5 | `lab2/USE-CASE-DESCRIPTIONS.md`, `lab2/use-case-diagram.puml` | 48 fully specified use cases across Resident, Manager, Field Officer, and Automated System triggers. |
| **BCE Analysis Model** | Lab 2 | `lab2/ANALYSIS-MODEL.md`, `lab2/class-diagram-entity.puml`, `lab2/class-diagram-boundary-control.puml` | 23 entity classes, 24 screen boundaries, 5 external gateways, 14 control classes. |
| **Detailed Design Model & Architecture** | Lab 3 | `lab3/DESIGN-MODEL.md`, `lab3/architecture.puml`, `lab3/class-diagram-design-*.puml` | Layered Clean Architecture (Boundary-Control-Entity), TypeScript interfaces, Prisma/PostGIS mappings, and GoF patterns. |
| **Design Patterns Documentation** | Lab 3 | `lab3/DESIGN-PATTERNS.md` | Factory Method (`NormalisationFactory`), Strategy (`ClusterTrendStrategy`), Adapter (`OneMapGateway`, `NEAFeedGateway`, `PestVisionGateway`), State Pattern. |
| **UI State Machine / Dialog Map** | Lab 2 & 3 | `lab2/dialog-map.puml`, `lab3/dialog-map-design.puml` | 27 interactive client screens mapped across 3 authenticated user roles with route guards. |
| **Test Plan & Acceptance Suite** | Lab 4 | `lab4/TEST-PLAN.md` | Comprehensive EP/BVA and basis path testing: **1,258 unit tests passing (90 test files)**, 100% core logic coverage. |
| **Demo Script & Live Rehearsal** | Lab 4 | `lab4/DEMO-SCRIPT.md`, `presentation-w13/LIVE_DEMO_AND_VIDEO_INSTRUCTIONS.md` | 20-minute live demonstration script with cue sheets and fallbacks. |
| **Automated Webdriver Test Suites** | Lab 4 & 5 | `tools/w13_live_demo_webdriver.py`, `tools/w13_video_walkthrough_webdriver.py` | Headless/headed Playwright scripts executing 11/11 live demo checks and 12/12 video walkthrough checks with automated DB cleanup. |
| **Presentation Deck** | Lab 5 | `presentation-w13/D-Fence-W13-v4.pptx` | 18 executive slides covering business value, BCE architecture, design patterns, automated CI/CD, and live demo walkthrough. |
| **Demo Video Walkthrough Script** | Lab 5 | `lab5/DEMO-VIDEO-AND-SCRIPT.md` & `presentation-w13/DEMO_VIDEO_WALKTHROUGH_SCRIPT.md` | 5–7 minute narrative walkthrough covering citizen reporting, automated replanning, manager dispatch editing, and crew job completion. |
| **SDLC Traceability Matrix** | Lab 5 | `lab5/TRACEABILITY-MATRIX.md` | Direct forward/backward traceability from Requirements $\to$ Use Cases $\to$ BCE Classes $\to$ Implementation $\to$ Tests. |
| **Meeting Minutes** | Lab 5 | `lab5/MEETING-MINUTES.md` | Detailed record of team sprint planning, technical checkpoints, and rehearsal sessions (Weeks 2–13). |
| **Peer Review Checklist** | Lab 5 | `lab5/SUBMISSION-CHECKLIST.md` | Individual accountability verification and peer review confirmation. |

---

## 2. Key Software Engineering Practices & Architectural Patterns

### 2.1. Boundary-Control-Entity (BCE) & Clean Architecture
- **Boundary**: Strict separation of presentation. React/Tailwind frontend screens (`ReportSiteScreen`, `DispatchProposalScreen`, `MyJobsScreen`) interact exclusively with server control endpoints via strongly-typed API gateways.
- **Control**: Centralised business logic services (`DispatchPlanService`, `PriorityScoringEngine`, `PestRecognitionService`, `WorkOrderLifecycleService`) enforce operational rules and database transactions.
- **Entity**: Persistent database models backed by PostgreSQL/PostGIS (`Report`, `WorkOrder`, `Vehicle`, `DispatchAssignment`, `ClusterSnapshot`).

### 2.2. Design Patterns Implemented in Production Code
1. **Factory Method (`NormalisationFactory`)**: Encapsulates normalisation logic across divergent sensor feeds (NEA rainfall stations, Dengue clusters, citizen geo-reports).
2. **Strategy Pattern (`ClusterTrendStrategy`)**: Dynamic priority scoring and spatio-temporal clustering algorithms selected at runtime based on pest species and rain thresholds.
3. **Adapter Pattern (`PestVisionGateway`, `OneMapGateway`)**: Wraps Google AI Studio Gemini Multimodal Vision API and Singapore OneMap routing APIs behind internal domain interfaces.
4. **Table-Driven State Machine (`WorkOrderStateMachine`)**: Enforces deterministic state transitions (`Pending` $\to$ `Assigned` $\to$ `InProgress` $\to$ `Resolved` / `Actioned`) preventing illegal state leaps.

### 2.3. Automated Quality Assurance & Testing Rigour
- **1,258 Unit Tests Passing**: Full coverage of boundary values, equivalence partitioning, and lifecycle regressions (`npx vitest run`).
- **End-to-End Live Webdriver Automation**: Automated browser walkthroughs executed directly against production Azure infrastructure to verify zero-defect live behaviour before submission.

---

## 3. How to Run and Verify the Deliverables

```bash
# 1. Install dependencies
npm install

# 2. Run the complete unit test suite (1,258 tests)
npm test

# 3. Typecheck the entire codebase
npm run typecheck

# 4. Execute the automated live production demo walkthrough
python tools/w13_live_demo_webdriver.py --headed

# 5. Execute the automated video recording walkthrough with clean teardown
python tools/w13_video_walkthrough_webdriver.py --headed --pause 2.0
```
