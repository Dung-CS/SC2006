# LAB 5: Comprehensive Requirements Traceability Matrix (RTM)

**Module:** SC2006 / CZ2006 Software Engineering  
**Project:** D-Fence — Smart Nation Vector & Pest Control Platform  
**Live Production URL:** [https://dfence-sc2006.azurewebsites.net](https://dfence-sc2006.azurewebsites.net)  
**SRS Reference:** `REQUIREMENTS.md` (v0.11, 694 atomic requirements)  
**Use Case Reference:** `lab2/USE-CASE-DESCRIPTIONS.md` & `lab3/USE-CASE-DESCRIPTIONS.md` (48 Use Cases)  
**Analysis Model Reference:** `lab2/ANALYSIS-MODEL.md` (BCE Model)  
**Design Model Reference:** `lab3/DESIGN-MODEL.md` (Clean Architecture & Design Patterns)  
**Test Suite Reference:** `lab4/TEST-PLAN.md` (1,258 Passing Unit Tests across 90 test files)  

---

## 1. Executive Summary & Traceability Architecture

The D-Fence Requirements Traceability Matrix establishes end-to-end forward and backward traceability across the entire software development lifecycle (SDLC):

$$\text{Business Requirement (SRS)} \iff \text{Use Case (UML)} \iff \text{BCE Architecture} \iff \text{Source Implementation} \iff \text{Verification Test}$$

Every atomic functional requirement in `REQUIREMENTS.md` is realised by at least one Use Case, encapsulated within Boundary-Control-Entity classes, implemented in modular TypeScript code, and verified by automated unit and webdriver test suites.

```
+----------------------------------------------------------------------------------------------------+
|                                    FORWARD TRACEABILITY FLOW                                       |
+-------------------+      +-------------------+      +-------------------+      +-------------------+
|  SRS Requirement  | ---> |   UML Use Case    | ---> |  BCE Architecture | ---> | Implementation &  |
|  (v0.11 Atomic)   |      |   (48 Use Cases)  |      | (Boundary/Control/|      | Automated Tests   |
|                   |      |                   |      |     Entity)       |      | (1,258 Unit Tests)|
+-------------------+      +-------------------+      +-------------------+      +-------------------+
|                                   BACKWARD VERIFICATION FLOW                                      |
+----------------------------------------------------------------------------------------------------+
```

---

## 2. Master Traceability Matrix

### 2.1. Module 1: External Data Ingestion & Environmental Intelligence

| Req ID Range | Functional Area | Use Case | Boundary Class | Control Class | Entity / Value Object | Implementation Files | Test Suites |
|---|---|---|---|---|---|---|---|
| **1.1.1 – 1.1.9** | NEA Dengue Cluster Ingestion | UC 7.1 Fetch Clusters | `NEAFeedGateway` | `IngestionController`, `ClusterSyncService` | `Cluster`, `ClusterSnapshot` | `src/boundary/gateways/NEAFeedGateway.ts`, `src/control/ClusterSyncService.ts` | `tests/unit/control/ClusterSyncService.test.ts`, `tests/unit/boundary/NEAFeedGateway.test.ts` |
| **1.2.1 – 1.2.9** | Rainfall Telemetry Ingestion | UC 7.2 Fetch Rainfall | `RainfallGateway` | `IngestionController`, `RainfallService` | `RainfallStation`, `RainfallReading`, `ClusterRainfall` | `src/boundary/gateways/RainfallGateway.ts`, `src/control/RainfallService.ts` | `tests/unit/control/RainfallService.test.ts` |
| **1.3.1 – 1.3.7** | Meteorological 24h Forecast | UC 7.3 Fetch Forecast | `ForecastGateway` | `IngestionController`, `ForecastService` | `RegionForecast` | `src/boundary/gateways/ForecastGateway.ts`, `src/control/ForecastService.ts` | `tests/unit/control/ForecastService.test.ts` |
| **1.4.1 – 1.4.6** | Source Health & Degradation | UC 7.4 Monitor Health | `ExternalGateway` | `SourceHealthMonitor` | `SourceHealth` | `src/control/SourceHealthMonitor.ts` | `tests/unit/control/SourceHealthMonitor.test.ts` |
| **1.5.1 – 1.5.9** | Biodiversity Observation Feed | UC 7.8 Fetch Observations | `INaturalistGateway` | `ObservationIngestionJob` | `ObservationRecord` | `src/boundary/gateways/INaturalistGateway.ts`, `src/control/ObservationIngestionJob.ts` | `tests/unit/boundary/INaturalistGateway.test.ts` |
| **1.6.1 – 1.6.8** | Vector Control Operator Registry | UC 7.9 Fetch VCO Registry | `VCORegistryGateway` | `OperatorRegistryLoader` | `VectorControlOperator` | `src/boundary/gateways/VCORegistryGateway.ts`, `src/control/OperatorRegistryLoader.ts` | `tests/unit/boundary/VCORegistryGateway.test.ts` |

---

### 2.2. Module 2: Identity, Access Control & User Management

| Req ID Range | Functional Area | Use Case | Boundary Class | Control Class | Entity / Value Object | Implementation Files | Test Suites |
|---|---|---|---|---|---|---|---|
| **2.1.1 – 2.1.9** | Resident Registration & Sign In | UC 1.1 Register, UC 1.2 Sign In | `SignInScreen`, `RegisterScreen`, `SupabaseAuthGateway` | `AuthenticationController`, `AuthService` | `Account`, `Session`, `Role` | `src/control/AuthService.ts`, `client/src/screens/auth/SignInScreen.tsx` | `tests/unit/control/AuthService.test.ts`, `tools/w13_live_demo_webdriver.py` |
| **2.2.1 – 2.2.4** | Role-Based Authorization | UC 1.4 Manage Staff Accounts | `StaffAccountManagementUI` | `StaffAccountController`, `AccessControlService` | `Role` (Resident, Manager, Crew) | `src/control/AccessControlService.ts`, `src/boundary/http/middleware/auth.ts` | `tests/unit/control/AccessControlService.test.ts` |
| **2.3.1 – 2.3.8** | Server-Side Access Guards | Cross-cutting (All UCs) | `RouteGuard` | `AccessControlService` | `Account` | `src/control/AccessControlService.ts`, `client/src/components/RouteGuard.tsx` | `tests/unit/control/AccessControlService.test.ts` |
| **2.4.1 – 2.4.6** | Security Audit Trail | Cross-cutting (Audit) | `AuditLogUI` | `AuditService` | `AuditRecord` | `src/control/AuditService.ts`, `src/entity/AuditRecord.ts` | `tests/unit/control/AuditService.test.ts` |

---

### 2.3. Module 3: Citizen Reporting, AI Multimodal Screening & Deduplication

| Req ID Range | Functional Area | Use Case | Boundary Class | Control Class | Entity / Value Object | Implementation Files | Test Suites |
|---|---|---|---|---|---|---|---|
| **5.1.1 – 5.1.8** | Report Submission & Geocoding | UC 3.1 Submit Pest Report, UC 8.1 Geocode Address | `ReportSiteScreen`, `OneMapGateway` | `ReportController`, `GeocodingService` | `Report`, `ReportPhoto`, `PestType` | `src/control/ReportService.ts`, `src/boundary/gateways/OneMapGateway.ts` | `tests/unit/control/ReportService.test.ts` |
| **5.1.9 – 5.1.14** | Spatial-Temporal Deduplication | UC 3.2 Check Duplicate | `ReportSiteScreen` | `ReportController`, `DeduplicationService` | `Report`, `ReportSpatialGroup` | `src/control/DeduplicationService.ts`, `src/control/ReportSpatialClustering.ts` | `tests/unit/control/DeduplicationService.test.ts`, `tests/unit/control/ReportSpatialClustering.test.ts` |
| **5.1.15 – 5.1.20** | Gemini Vision Auto-Fill & Screening | UC 3.1 Submit Report | `ReportSiteScreen`, `PestVisionGateway` | `PestRecognitionService` | `PestProfile`, `EvidenceTier` | `src/boundary/gateways/PestVisionGateway.ts`, `src/control/PestRecognitionService.ts` | `tests/unit/boundary/PestVisionGateway.test.ts` |
| **5.2.1 – 5.2.8** | Report Lifecycle & Tracking | UC 3.3 View Submissions | `ReportHistoryScreen` | `ReportController` | `Report`, `ReportStatus` | `client/src/screens/resident/ReportHistoryScreen.tsx`, `src/control/ReportService.ts` | `tests/unit/control/ReportService.test.ts` |
| **5.3.1 – 5.3.7** | Operations Moderation | UC 3.4 Moderate Report | `ModerationQueueScreen` | `ModerationController` | `Report`, `ModerationReason` | `client/src/screens/operations/ModerationQueueScreen.tsx` | `tests/unit/control/ReportService.test.ts` |

---

### 2.4. Module 4: Multi-Pest Priority Scoring & Risk Engine

| Req ID Range | Functional Area | Use Case | Boundary Class | Control Class | Entity / Value Object | Implementation Files | Test Suites |
|---|---|---|---|---|---|---|---|
| **4.1.1 – 4.1.26** | Multi-Criteria Driver Weights | UC 7.5 Calculate Priority | `ClusterDetailsScreen`, `OperationsDashboardScreen` | `PriorityScoringEngine`, `UrgencyCalculator` | `PriorityScore`, `DriverContribution` | `src/control/PriorityScoringEngine.ts`, `src/control/UrgencyCalculator.ts` | `tests/unit/control/PriorityScoringEngine.test.ts` |
| **4.2.1 – 4.2.9** | Cross-Pest Generalisation | UC 8.5 Register Pest Profile | `PestProfileScreen` | `PestProfileRegistry`, `PestPriorityCalculator` | `PestProfile`, `PestClass` | `src/control/PestProfileRegistry.ts`, `src/control/PestPriorityCalculator.ts` | `tests/unit/control/PestProfileRegistry.test.ts` |
| **4.3.1 – 4.3.7** | Spatio-Temporal Spatial Clustering | UC 7.5 Cluster Scoring | `OperationsDashboardScreen` | `ReportSpatialClustering` | `ReportSpatialGroup` | `src/control/ReportSpatialClustering.ts` | `tests/unit/control/ReportSpatialClustering.test.ts` |
| **4.4.1 – 4.4.9** | Rule 4.4.7 Critical Life-Safety Override | UC 7.10 Evaluate Critical Override | `OperationsDashboardScreen` | `CriticalOverrideEvaluator` | `PriorityTier` (Critical, High, Medium, Low) | `src/control/CriticalOverrideEvaluator.ts` | `tests/unit/control/CriticalOverrideEvaluator.test.ts` |

---

### 2.5. Module 5: Operations Management, Multi-Vehicle Dispatch & Fleet Routing

| Req ID Range | Functional Area | Use Case | Boundary Class | Control Class | Entity / Value Object | Implementation Files | Test Suites |
|---|---|---|---|---|---|---|---|
| **7.1.1 – 7.5.8** | Operations Dashboard & Risk Surfaces | UC 5.1–5.4 Dashboard & Map | `OperationsDashboardScreen`, `UnifiedOpsScreen` | `DashboardController`, `MapViewController` | `Cluster`, `PriorityScore`, `Report` | `client/src/screens/operations/UnifiedOpsScreen.tsx`, `src/control/DashboardService.ts` | `tests/unit/control/DashboardService.test.ts` |
| **8.1.1 – 8.1.18** | Work Order Creation & Referral | UC 6.1 Create Work Order, UC 6.10 Refer External | `WorkOrderCreateModal`, `ReferralModal` | `DispatchController`, `ReferralController` | `WorkOrder`, `Referral`, `TaskType` | `src/control/WorkOrderService.ts`, `src/control/ReferralController.ts` | `tests/unit/control/WorkOrderService.test.ts` |
| **8.2.1 – 8.2.12** | TSP Dispatch Optimization & Road Routing | UC 6.2 Optimize Dispatch Route | `DispatchProposalScreen` | `RouteOptimizationService`, `OneMapRoadRoutingStrategy` | `Vehicle`, `DispatchAssignment` | `src/control/RouteOptimizationService.ts`, `src/control/OneMapRoadRoutingStrategy.ts` | `tests/unit/control/RouteOptimizationService.test.ts` |
| **8.2.13 – 8.2.22** | Multi-Vehicle Dispatch & Pin Locking (`isFixed`) | UC 6.9 Edit Dispatch Plan | `DispatchProposalScreen` | `DispatchPlanService`, `DispatchAssignmentService` | `Vehicle`, `SingaporePlate`, `HqLocation` | `src/control/DispatchPlanService.ts`, `src/control/DispatchAssignmentService.ts` | `tests/unit/control/DispatchPlanService.test.ts`, `tests/unit/control/DispatchAssignmentService.test.ts` |
| **8.3.1 – 8.3.14** | Table-Driven 8-State Lifecycle Machine | UC 6.5 Accept Job, UC 6.6 Complete Job, UC 6.8 Verify Work | `MyJobsScreen`, `JobDetailScreen`, `WorkOrderVerifyModal` | `WorkOrderLifecycleController` | `WorkOrder`, `WorkOrderStatus`, `CompletionEvidence`, `TreatmentRecord` | `src/control/WorkOrderLifecycleController.ts` | `tests/unit/control/WorkOrderLifecycleController.test.ts` (Basis Path Suite) |
| **8.4.1 – 8.4.10** | Field Officer Mobile Working View | UC 6.4 View Assigned Jobs, UC 6.7 Flag Issue | `MyJobsScreen`, `FlagIssueModal` | `WorkOrderLifecycleController` | `WorkOrder`, `CompletionEvidence` | `client/src/screens/crew/MyJobsScreen.tsx` | `tests/unit/control/WorkOrderLifecycleController.test.ts`, `tools/w13_video_walkthrough_webdriver.py` |
| **8.5.1 – 8.5.8** | Closing the Feedback Loop | UC 6.8 Verify Completed Work, UC 8.4 Record Treatment | `WorkOrderVerifyModal` | `WorkOrderLifecycleController`, `PriorityScoringEngine` | `TreatmentRecord` | `src/control/WorkOrderLifecycleController.ts`, `src/control/PriorityScoringEngine.ts` | `tests/unit/control/WorkOrderLifecycleController.test.ts` |

---

### 2.6. Module 6: Saved Locations, Alert Subscriptions & Telegram Gateway

| Req ID Range | Functional Area | Use Case | Boundary Class | Control Class | Entity / Value Object | Implementation Files | Test Suites |
|---|---|---|---|---|---|---|---|
| **3.1.1 – 3.1.10** | Saved Locations & Exposure Radius | UC 2.1 Add Location, UC 2.4 Evaluate Exposure | `SavedLocationsScreen`, `OneMapGateway` | `SavedLocationController`, `ExposureService` | `SavedLocation`, `ExposureStatus` (IN_CLUSTER, WITHIN_150M, CLEAR) | `src/control/SavedLocationService.ts`, `client/src/screens/resident/SavedLocationsScreen.tsx` | `tests/unit/control/SavedLocationService.test.ts` |
| **6.1.1 – 6.1.8** | Alert Triggering & Growth Evaluation | UC 7.6 Evaluate Alert Triggers | `NotificationController` | `AlertTriggerEvaluator` | `Alert`, `AlertTrigger` | `src/control/AlertTriggerEvaluator.ts` | `tests/unit/control/AlertTriggerEvaluator.test.ts` |
| **6.2.1 – 6.2.9** | Telegram Notification Delivery | UC 4.3 Deliver Notification | `TelegramGateway` | `NotificationController` | `AlertSubscription`, `Alert` | `src/boundary/gateways/TelegramGateway.ts`, `src/control/NotificationService.ts` | `tests/unit/boundary/TelegramGateway.test.ts` |

---

### 2.7. Module 7: Non-Functional Requirements & Architecture Standards

| Req ID Range | Requirement Area | Standard / Metric | Architectural Realisation | Verification Evidence |
|---|---|---|---|---|
| **10.1.1 – 10.1.6** | Performance | API latency $< 200\text{ ms}$; Map load $< 1.5\text{ s}$ | PostGIS spatial indexing (`gist(boundary)`, `gist(location)`), HTTP ETags, Prisma connection pooling. | Vitest performance benchmarks; Azure App Service response timings. |
| **10.2.1 – 10.2.6** | Reliability & Availability | 99.9% uptime; Zero data loss on external API drops | Fallback caches on `NEAFeedGateway` and `RainfallGateway`; exponential backoff retry policies. | `tests/unit/boundary/NEAFeedGateway.test.ts` (Fault Injection). |
| **10.3.1 – 10.3.8** | Security | OWASP Top 10 compliance; Zero SQL injection; JWT authentication | Supabase row-level security (RLS); bcrypt password hashing; strict input validation schemas. | Security audit suite; Sonar/ESLint security scans. |
| **10.4.1 – 10.4.5** | Privacy & PDPA Compliance | Zero public display of citizen names or phone numbers | Citizen reports sanitized; exact GPS dithered on public map view; coordinates visible only to dispatchers. | `tests/unit/control/ReportService.test.ts`. |
| **10.5.1 – 10.5.8** | Usability & Responsiveness | WCAG 2.1 AA contrast; Mobile-first responsive layouts | Tailwind CSS design system; 48px touch targets; color-blind safe priority palette. | `client/src/screens/` responsive audit; Playwright cross-device tests. |
| **10.6.1 – 10.6.7** | Maintainability | Clean BCE Architecture; GoF Design Patterns | Strict layering: Boundary never accesses Entity directly; Control classes contain all business logic. | Architecture compliance check; TypeScript compiler typecheck (`npm run typecheck`). |

---

## 3. Verification & Compliance Confirmation

```
========================================================================================
TRACEABILITY COMPLIANCE SUMMARY
========================================================================================
Total Atomic Requirements (SRS v0.11):          694
Fully Mapped & Realised Requirements:          694 (100.0%)
Use Cases Specified (UML Model):                48 (48 realised)
Boundary Classes (Screens + External Gateways): 36 (27 screens + 9 gateways)
Control Classes (Services & State Engines):     22
Entity & Value Object Models:                   34
Total Automated Unit Tests Passing:             1,258 (90 test files)
Automated Webdriver Live Production Suites:     2 (23 end-to-end checks passing)
========================================================================================
STATUS: ALL REQUIREMENTS FULLY TRACEABLE AND VERIFIED PASSING.
```
