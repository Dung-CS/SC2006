# DESIGN PATTERNS — D-Fence

Lab 3 design patterns catalogue. Records the GoF and architectural patterns applied in the design
class model and explains the decision for each.

---

## 1. Strategy — Normalisation

**Where:** `NormalisationStrategy` interface → `MinMaxNormalisation`, `LogScaleNormalisation`,
`CappedLinearNormalisation`, `RecencyDecayNormalisation`, `PremisesMixNormalisation`.
**Realised by:** `UrgencyCalculator`, bound via `NormalisationFactory`.

Requirement 4.1.4 obliges one normalisation method per driver but does not name them. Encoding each
method as a concrete strategy allows the engine to pick the right one at construction time rather than
branching inside `computeUrgency()`. Adding a driver adds one class; the engine is unchanged.
`NormalisationFactory` asserts that all eleven drivers resolve — two did not during Lab 2 review,
which a scoring cycle would have discovered at run time.

---

## 2. Strategy — Road Routing

**Where:** `RoadRoutingStrategy` interface → `OneMapRoadRoutingStrategy`.
**Realised by:** `RouteOptimizationService`.

`RouteOptimizationService.plan()` accepts a `RoadRoutingStrategy` dependency. The only concrete
implementation is `OneMapRoadRoutingStrategy`, which calls the OneMap Routing API to obtain a
verified driving route between two geo-points.

**Enforcement rule:** `OneMapRoadRoutingStrategy.getRoute()` raises `RouteUnavailableError` when
a geo-point cannot be reached by road (e.g. offshore islands, non-mainland locations). The planner
marks those tasks `unplanned` and excludes them from the dispatch route. **Direct-distance
(straight-line) fallback is prohibited.** There is no silent degradation: a route that cannot be
driven is not approximated by a straight line.

This is a deliberate correctness constraint, not a limitation. A straight-line estimate for a water-
separated point would produce a route a crew vehicle cannot follow, potentially causing missed tasks
without an auditable reason.

---

## 3. Template Method — Ingestion jobs

**Where:** `AbstractIngestionJob` → `ClusterIngestionJob`, `RainfallIngestionJob`,
`ForecastIngestionJob`, `ObservationIngestionJob`.

`run()` is fixed: record start, fetch, parse, persist, record outcome, publish event, and on failure
mark the source stale (10.2.2) without losing stored data (10.2.4). The four sources differ only in
`fetch()`, `parse()` and `persist()`, so the lifecycle is implemented once.

---

## 4. Observer — Domain events

**Where:** `DomainEventPublisher` → `DomainEventSubscriber` → `AlertTriggerEvaluator`,
`PestPriorityCalculator`.

Ingestion must trigger rescoring and alert evaluation without the jobs knowing who listens. Adding a
subscriber at Lab 5 extensibility time touches no existing job.

---

## 5. Table-driven state machine — Work-order lifecycle

**Where:** `WorkOrderTransitionTable` → `TransitionRule[]` → `WorkOrderLifecycleController`.

GoF State would spread eight transitions across eight classes; the constraint in 8.3.2 would then be
true of the set but visible in no single place. The table keeps `isTransitionPermitted()` as one
method with a bounded branch structure — the Lab 4 basis-path test subject.

---

## 6. Startup / DI container

**Where:** `AppConfigurator` → `ServiceContainer`.

All repositories, gateways and controllers are registered in one place and resolved by token. No
class reaches for a global or constructs its own dependency. This is what allows Lab 4 tests to
substitute fakes for gateways.
