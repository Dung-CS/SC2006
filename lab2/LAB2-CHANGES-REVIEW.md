# LAB 2 — AI CRITIQUE CHANGES REVIEW & DISPOSITION REPORT

**Project:** D-Fence (NTU SC2006 / CZ2006)  
**Deliverable Area:** Lab 2 Use Case Model & Analysis Documentation  
**Source Document:** `Lab2ChangesToBeMade.docx`  
**Date:** 2026-09-24  
**Author:** Y. K. Chow (reviewed with Alfred)

---

## 1. Executive Summary

This report reviews each proposed change in `Lab2ChangesToBeMade.docx` (derived from the AI critique of the use case model). Each proposed change is evaluated against UML 2.5 standards, Fox textbook guidelines (pp. 126–130), NTU SC2006 assessment criteria, and the D-Fence system requirements (`../REQUIREMENTS.md`).

| # | Suggested Change | Source in Critique | Decision | Disposition Summary |
|---|---|---|---|---|
| **1** | **Improvement on Actor Model** ("Registered User" is ambiguous) | Section 1 (Images rId5–7, rId11) | **Option A: REJECTED**<br>**Option B: APPLIED** | **Rejected** removing `Registered User` (would duplicate associations and discard graded OO actor generalization). **Applied** explicit `{abstract}` stereotype and restored full Actor Taxonomy Table in `USE-CASE-DESCRIPTIONS.md`. |
| **2** | **Missing Extend Relationship** (Add `<<extend>>` from 6.7 to 6.5 & 6.6) | Section 2 (Images rId8–10, rId11) | **REJECTED** | Semantically invalid under UML rules and violates Requirement 8.3.8 ("at any time before completion"). Direct association from `Cleaning Crew Member` remains the only sound model. |
| **3** | **Too Many Crossing Association Lines** (Diagram clutter / 4 views) | Section 3 (Images rId11–12) | **APPLIED** | Modularized role views into 4 focused diagrams (A: Resident, B: Operations, C: Cleaning Crew, D: Automated System Services) and cleaned up PlantUML layout to eliminate looping/crossing lines. |
| **4** | **Make Supporting Use Cases Visually Secondary** (8.1–8.5 technical use cases) | Section 4 (Images rId13–15) | **APPLIED** | Grouped Use Cases 8.1–8.5 inside a styled `Supporting Services (Reusable / Included)` box (`#F4F6F9`) and added an architectural preamble clarifying they are factored sub-functions, not standalone user goals. |
| **5** | **Resolve Scheduler / 7.6 Inconsistency** | Priority 4 (Image rId11) | **APPLIED** | Corrected `use-case-diagram-resident.puml` so Scheduler triggers `7.6 Evaluate Alert Triggers` before including `4.3 Notify Resident`, aligning with the written specification. |

---

## 2. Detailed Reports for Each Suggested Change

### Change 1: Improvement on Actor Model ("Registered User" Ambiguity)

* **Source:** `Lab2ChangesToBeMade.docx` §1 (Images rId5, rId6, rId7, and Priority 2 in rId11).
* **Stated Problem:** The critique notes that markers may find `Registered User` ambiguous, questioning whether it constitutes an uninstantiated fourth concrete user role or an unclarified actor.
* **Proposed Solution in Document:**
  * *Option A (Recommended by critique):* Remove `Registered User` entirely and connect common use cases (`1.2 Sign In`, `1.3 Reset Password`, `1.5 Sign Out`) directly to `Resident`, `Operations Manager`, and `Cleaning Crew Member`.
  * *Option B:* Keep `Registered User` and model it as an explicit actor superclass.
* **Decision:**
  * **Option A is REJECTED.**
  * **Option B is APPLIED.**
* **Justification for Rejecting Option A:**
  1. *Grading Rubric Penalties:* In NTU SC2006, demonstrating proper actor generalization (`ConcreteActor --|> SuperActor`) is an explicit grading item for object-oriented analysis. Removing it regresses the model to a flat, un-factored structure.
  2. *Visual Clutter:* Direct connections from all three concrete human actors to `1.2`, `1.3`, and `1.5` would add 9 redundant crossing association lines to the master diagram, defeating the goal of improving readability.
  3. *Domain Architecture:* An abstract super-actor accurately mirrors the system's identity and access layer where all authenticated users inherit identical credential-management capabilities.
* **What Was Changed (Option B Applied):**
  1. In `USE-CASE-DESCRIPTIONS.md` §1, inserted an **Actor Taxonomy Table** explicitly defining `A0 Registered User` as an **Abstract Actor** (`<<abstract>>`) that is never directly instantiated and is inherited by `Resident`, `Operations Manager`, and `Cleaning Crew Member`.
  2. In `use-case-diagram.puml` and all role-scoped diagrams (`use-case-diagram-resident.puml`, `use-case-diagram-operations.puml`, `use-case-diagram-crew.puml`), updated the actor label to `Registered User\n{abstract}`.

---

### Change 2: Missing Extend Relationship (Add `<<extend>>` from 6.7 to 6.5 & 6.6)

* **Source:** `Lab2ChangesToBeMade.docx` §2 (Images rId8, rId9, rId10, and Priority 1 in rId10, rId11).
* **Stated Problem:** The critique suggests that `6.7 Raise Issue on Job` should have a clear second `<<extend>>` relationship to `6.5 Accept and Start Job` while retaining `<<extend>>` to `6.6 Complete Job with Evidence`.
* **Decision: REJECTED.**
* **Justification for Rejection:**
  1. *UML Semantic Rules:* In UML 2.5, an `<<extend>>` relationship specifies that the extending use case's behavior is inserted at a declared extension point *within* the execution flow of the base use case.
  2. *Violation of Requirement 8.3.8:* Requirement 8.3.8 explicitly dictates that an issue may be raised *"at any time before completion"* (i.e., whenever the work order status is `Assigned`, `Accepted`, or `In Progress`).
  3. *Failure on Base 6.5:* If `6.7` extends `6.5 Accept and Start Job`, it can only execute while acknowledging/starting the job. Once the crew arrives on site and starts the job, `6.5` has concluded. A crew member encountering an obstruction hours later while performing work (`In Progress`) would have no active base use case to extend.
  4. *Failure on Base 6.6:* If `6.7` extends `6.6 Complete Job with Evidence`, it forces the operative to enter the job completion flow in order to report an obstruction — yet an obstruction means the job *cannot* be completed. (This exact contradiction was caught and documented in Lab 1's adversarial review).
  5. *Correct Representation:* `6.7 Raise Issue on Job` is an independent, primary user goal initiated directly by `Cleaning Crew Member` from their job view, guarded by precondition `status ∈ {Assigned, Accepted, In Progress}`. Direct association is the only semantically sound and requirement-compliant model.
* **Documentation Note Added:** Updated the *Notes and Issues* section of `USE-CASE-DESCRIPTIONS.md` (Use Case 6.7) to formally record why extending 6.5 and 6.6 was rejected.

---

### Change 3: Too Many Crossing Association Lines (Diagram Layout & Readability)

* **Source:** `Lab2ChangesToBeMade.docx` §3 (Images rId11, rId12, and Priorities 3 & 5 in rId11).
* **Stated Problem:** Long curved association lines looped around the boundary box, cluttering the view and hindering readability.
* **Proposed Solution in Document:** Separate into 4 distinct, legible diagrams (Diagram A: Resident, Diagram B: Operations Manager, Diagram C: Cleaning Crew, Diagram D: Automated/System Services), and route lines cleanly.
* **Decision: APPLIED.**
* **What Was Changed:**
  1. *Created Diagram C & Diagram D:* Created dedicated diagram sources:
     - `use-case-diagram-crew.puml` → `D-Fence-Crew.png` / `svg` (Diagram C: Cleaning Crew Field Work).
     - `use-case-diagram-system.puml` → `D-Fence-System.png` / `svg` (Diagram D: Automated System Ingestion & Processing).
     - Maintained `use-case-diagram-crew-system.puml` for backwards compatibility.
  2. *Eliminated Looping Lines in Diagram A (Resident):* In `use-case-diagram-resident.puml`, relocated secondary external actors (`Telegram Service`, `OneMap`) to the right margin adjacent to their associated use cases (`4.3`, `8.1`), and reordered use cases vertically, removing bottom-wrapping loops.
  3. *Eliminated Crossings in Diagram B (Operations):* In `use-case-diagram-operations.puml`, aligned dispatch and work order use cases directly with the manager actor.
  4. *Updated Diagram Index:* Updated the diagram inventory in `README.md` and re-rendered all PNG and SVG assets with PlantUML 1.2024.7.

---

### Change 4: Make Supporting Use Cases Visually Secondary (8.1–8.5 Technical Use Cases)

* **Source:** `Lab2ChangesToBeMade.docx` §4 (Images rId13, rId14, rId15, and Priority 6 in rId11).
* **Stated Problem:** Use cases 8.1–8.5 (Geocode Address, View Driver Breakdown, Link Verified Reports, Record Treatment, Apply Pest Severity Profile) are reusable sub-functions invoked via `<<include>>`. If styled identically to primary use cases, examiners may perceive them as an anti-pattern (functional decomposition / non-goal "technical" use cases).
* **Proposed Solution in Document:** Visually distinguish them as "Supporting/reusable use cases" rather than primary user goals.
* **Decision: APPLIED.**
* **What Was Changed:**
  1. *Visual Styling in Diagrams:* In `use-case-diagram.puml` and the role diagrams, enclosed 8.1–8.5 inside a dedicated rectangle:
     ```plantuml
     rectangle "Supporting Services (Reusable / Included)" <<supporting>> { ... }
     ```
     configured with a distinct neutral background (`#F4F6F9`) and subdued border (`#8C9BA5`).
  2. *Architectural Clarification in Documentation:* In `USE-CASE-DESCRIPTIONS.md` §8, prefixed the section with an architectural note confirming that these use cases represent reusable sub-functions invoked strictly via `<<include>>` and are never direct user-initiated entry points.

---

### Change 5: Resolve Scheduler / 7.6 Inconsistency

* **Source:** `Lab2ChangesToBeMade.docx` Priority 4 (Image rId11).
* **Stated Problem:** Inconsistency existed between the resident diagram and written specifications regarding who/what triggers `7.6 Evaluate Alert Triggers` and `4.3 Notify Resident`.
* **Identified Defect:** In `use-case-diagram-resident.puml`, `Scheduler` was previously linked directly to `4.3 Notify Resident` (`SCH -- UC43`), bypassing `7.6 Evaluate Alert Triggers` and contradicting the written specification where Scheduler triggers 7.6, which then includes 4.3.
* **Decision: APPLIED.**
* **What Was Changed:**
  1. In `use-case-diagram-resident.puml`, replaced `SCH -- UC43` with `SCH -- UC76` and `UC76 ..> UC43 : <<include>>`.
  2. Verified that all descriptions in `USE-CASE-DESCRIPTIONS.md` (UC 7.6 and UC 4.3) and the diagrams consistently demonstrate that `Scheduler` initiates periodic trigger evaluation (`7.6`), which evaluates alert conditions before dispatching notifications (`4.3`).

---

## 3. Summary of Updated Files & Artifacts

All diagrams have been re-rendered to PNG and SVG using PlantUML 1.2024.7:

- **Documentation:**
  - `LAB2-CHANGES-REVIEW.md` (this review and decision report)
  - `USE-CASE-DESCRIPTIONS.md` (updated with Actor taxonomy table and Section 8 architecture preamble)
  - `README.md` (updated diagram directory)
- **Diagrams:**
  - `use-case-diagram.puml` → `D-Fence-UseCases.png`, `D-Fence-UseCases.svg` (Master)
  - `use-case-diagram-resident.puml` → `D-Fence-Resident.png`, `D-Fence-Resident.svg` (Diagram A: Resident)
  - `use-case-diagram-operations.puml` → `D-Fence-Operations.png`, `D-Fence-Operations.svg` (Diagram B: Operations Manager)
  - `use-case-diagram-crew.puml` → `D-Fence-Crew.png`, `D-Fence-Crew.svg` (Diagram C: Cleaning Crew)
  - `use-case-diagram-system.puml` → `D-Fence-System.png`, `D-Fence-System.svg` (Diagram D: System & Automated Behaviour)
  - `use-case-diagram-crew-system.puml` → `D-Fence-Crew-and-System.png`, `D-Fence-Crew-and-System.svg` (Combined view)
