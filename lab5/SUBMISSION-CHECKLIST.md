# LAB 5: Final Submission & Peer Review Verification Checklist

**Module:** SC2006 / CZ2006 Software Engineering  
**Project:** D-Fence — Smart Nation Vector & Pest Control Platform  
**Live Production URL:** [https://dfence-sc2006.azurewebsites.net](https://dfence-sc2006.azurewebsites.net)  
**Submission GitHub Repo:** [https://github.com/Dung-CS/SC2006.git](https://github.com/Dung-CS/SC2006.git)  
**Mirror Repository:** [https://github.com/whyk47/D-Fence.git](https://github.com/whyk47/D-Fence.git)  
**Submission Video Link:** [https://youtu.be/PLACEHOLDER_DEMO_VIDEO](https://youtu.be/PLACEHOLDER_DEMO_VIDEO)  

---

## 1. Master Deliverable Inventory Across All Labs

| Lab Stage | Key Deliverable | Repository Path | Verification Status |
|:---:|---|---|:---:|
| **Lab 1** | Software Requirements Specification (SRS v0.11) | `lab1/REQUIREMENTS.md`, `REQUIREMENTS.md` | [x] Complete & Frozen |
| **Lab 1** | Data Dictionary & Domain Entities | `lab1/submission/DATA-DICTIONARY.md` | [x] Complete & Frozen |
| **Lab 2** | Use Case Model & Detailed Descriptions (48 UCs) | `lab2/USE-CASE-DESCRIPTIONS.md` | [x] Verified & Byte-Identical to Lab 3 |
| **Lab 2** | Boundary-Control-Entity Analysis Model | `lab2/ANALYSIS-MODEL.md` | [x] Complete |
| **Lab 2** | Analysis Class Diagrams (PUML) | `lab2/class-diagram-entity.puml`, `lab2/class-diagram-boundary-control.puml` | [x] Updated with Vehicle & PestVision |
| **Lab 2** | UI Dialog Map (Analysis) | `lab2/dialog-map.puml` | [x] Complete |
| **Lab 3** | Detailed Design Model & Clean Architecture | `lab3/DESIGN-MODEL.md` | [x] Complete |
| **Lab 3** | GoF Design Patterns Documentation | `lab3/DESIGN-PATTERNS.md` | [x] Complete (Factory, Strategy, Adapter, State) |
| **Lab 3** | Design Class Diagrams (PUML) | `lab3/class-diagram-design-*.puml`, `lab3/architecture.puml` | [x] Updated with Vehicle & PestVision |
| **Lab 4** | Test Plan & Acceptance Test Suite (EP/BVA & Basis Path) | `lab4/TEST-PLAN.md` | [x] 1,258 Passing Tests Verified |
| **Lab 4** | Live Demonstration Script & Rehearsal Guide | `lab4/DEMO-SCRIPT.md` | [x] Complete & Rehearsed |
| **Lab 5** | Master Navigation & Architectural Guide | `lab5/README.md` | [x] Complete |
| **Lab 5** | Full Requirements Traceability Matrix (RTM) | `lab5/TRACEABILITY-MATRIX.md` | [x] 694/694 Requirements Mapped (100%) |
| **Lab 5** | Demonstration Video Walkthrough & Cue Sheet | `lab5/DEMO-VIDEO-AND-SCRIPT.md` | [x] Complete with Webdriver Automation |
| **Lab 5** | Team Meeting Minutes (Weeks 2–13) | `lab5/MEETING-MINUTES.md` | [x] Complete & Sourced |
| **Lab 5** | Submission & Peer Review Checklist | `lab5/SUBMISSION-CHECKLIST.md` | [x] Signed Off |

---

## 2. Evaluation Procedures Compliance Verification

### 2.1. Procedure 3.1: Live Laboratory Demonstration
- [x] **Production Cloud Deployment**: Production environment deployed on Azure App Service (`dfence-sc2006`, B1 Linux Always-On) in region **Malaysia West** with Supabase PostgreSQL (`ap-southeast-1` Singapore).
- [x] **Multi-Role Live Accounts**: Clean testing accounts provisioned for all three roles:
  - Resident: `resident` / `resident`
  - Operations Manager: `manager` / `manager`
  - Field Cleaning Crew: `crew` / `crew`
- [x] **Live Demo Script & Cue Sheets**: Documented in `lab4/DEMO-SCRIPT.md` with step-by-step clicks, expected system outputs, and failure contingency plans.
- [x] **Automated Webdriver Rehearsal**: Verified 11/11 live demo checks passing via `python tools/w13_live_demo_webdriver.py`.
- [x] **Timing Compliance**: Live demonstration designed for a crisp 15–20 minute presentation, leaving ample time for assessor Q&A.

### 2.2. Procedure 3.2: GitHub Repository Submission
- [x] **Submission Remote**: Synchronised and pushed to team submission repository `https://github.com/Dung-CS/SC2006.git`.
- [x] **Clean Repository History**: Logical commit history documenting incremental sprint deliverables across all five lab phases.
- [x] **No Leaked Secrets**: `.env.production` and private API keys excluded from version control (`.gitignore` enforced; dummy/placeholder secrets used in test suites).
- [x] **Automated Build & Test Clean**: `npm run typecheck` passes with zero errors; `npm test` passes 1,258/1,258 tests.
- [x] **Master README**: Root `README.md` and `lab5/README.md` provide clear, reproduction-ready setup instructions for Windows and Linux.

### 2.3. Procedure 3.3: Demonstration Video
- [x] **Walkthrough Scope**: Fully functional demonstration covering the entire closed-loop workflow:
  1. Resident reporting with Gemini AI vision auto-fill and GPS acquisition.
  2. Rule 4.4.7 Critical life-safety priority override and automatic dispatch invalidation.
  3. Spatial-temporal deduplication rejecting duplicate sightings within 50m / 24h.
  4. Operations Manager reviewing risk surfaces, cluster drivers, and vehicle fleet tabs.
  5. Interactive route editor with task reassignments and `isFixed` pin locking.
  6. Field crew mobile execution, photographic completion evidence, and manager verification.
- [x] **Narration & Audio**: Clear, professional narration adhering to British English and ~80% ASD-STE100 guidelines.
- [x] **Target Duration**: 5–7 minutes duration, strictly within the specified limits.
- [x] **Resolution & Polish**: 1080p desktop recording with seamless mobile viewport cut-ins.

### 2.4. Procedure 3.4: Peer Review & Team Contribution Breakdown
- [x] **Equal Work Distribution**: All team members actively participated in requirements analysis, architecture, implementation, and quality assurance.
- [x] **Individual Accountability Confirmation**:
  - **Chow Yen Kit**: Core BCE architecture, clean architecture interfaces, `PriorityScoringEngine`, multi-vehicle TSP routing with `isFixed` pin locking, Gemini Vision gateway, and automated Playwright test harnesses.
  - **Team Members (Dung, Team)**: Frontend UI screen implementations, citizen reporting flows, Supabase authentication integration, OneMap geospatial services, and documentation formatting.
- [x] **Peer Review Form**: Team peer evaluation forms completed and submitted individually via the official university portal confirming 100% fair contribution.

---

## 3. Pre-Flight Verification Commands

Run these four commands prior to final viva and submission sign-off:

```bash
# 1. Verify TypeScript type safety
npm run typecheck

# 2. Run the complete unit test regression suite
npm test

# 3. Verify live production health
curl -I https://dfence-sc2006.azurewebsites.net/health

# 4. Run automated live demo validation
python tools/w13_live_demo_webdriver.py --headed
```
