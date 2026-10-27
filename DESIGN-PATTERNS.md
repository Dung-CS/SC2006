# D-Fence design patterns mapped to SC2006

This document maps the patterns visible in the current D-Fence source to the SC2006 lecture topics named below. A class name alone does not prove a pattern. Each mapping states the participants, the design purpose and any limits in the current implementation. The lecture numbers and slide references follow the SC2006 course brief supplied for this project.

## Pattern map

| SC2006 topic | D-Fence participants | Status |
|---|---|---|
| Lecture 15: BCE / MVC | Boundary: `src/boundary/http/`, `src/boundary/gateways/`, `client/src/screens/`; Control: `src/control/`; Entity: `src/entity/` | Implemented as a layered BCE structure. MVC is a useful view of the client, not a strict server-wide MVC claim. |
| Lectures 13–15: Strategy | Pest vision, routing, normalisation and notification implementations | Implemented where multiple interchangeable behaviours share a port or interface. |
| Lecture 14: Factory Method / Abstract Factory | `DataStoreFactory`, `PestVisionStrategyFactory`, `RouteStrategyFactory`, `NormalisationFactory`, ingestion job construction | Simple factories are present. Do not call each one Abstract Factory: the repository does not show a single factory creating coordinated families of related products. |
| Lectures 13, 15: Observer | `WorkOrderSubject`, `ReportSubject`, `ClusterSubject`, `IObserver<T>`, `Subject<T>` | Implemented: typed domain event publishers for work orders, resident reports, and cluster priority updates with async notification. |
| Lecture 14: Adapter | External gateways in `src/boundary/gateways/` | Implemented where a gateway translates a provider protocol into a project port. |
| Lecture 14: Template Method | `AbstractIngestionJob` and concrete ingestion jobs | Implemented: the base class fixes the ingestion sequence and subclasses supply steps. |
| Lecture 14, slides 15–20: Façade | `DengueSystemFacade` and `AppConfigurator` | Implemented as a reusable lifecycle and service-resolution facade. The production entry point in `src/server.ts` still composes its own graph. |
| Lectures 13–14: Singleton | `Database`, `ConfigLoader` | Not implemented as GoF Singletons. `Database` caches a pool per instance; `ConfigLoader` exposes static functions. |
| Lecture 15: Composite | `CompositeObservationJob`; React component tree | Implemented in ingestion. React's nested component composition is structural composition; do not claim the GoF Composite interface unless leaves and composites are used uniformly. |

## 1. BCE and MVC — Lecture 15

BCE separates an application into Boundary, Control and Entity responsibilities. In D-Fence, HTTP routes and external-facing gateways form the server boundaries. React screens form the user-facing boundary. Controllers in `src/control/` coordinate application actions. Domain data and rules live in `src/entity/`.

The flow is: a screen or HTTP route receives an interaction, a controller applies the use case, and entity objects hold domain state and rules. Gateways and repositories keep transport and storage details at the edges. This is a BCE mapping, not a claim that every class follows a perfect three-layer boundary.

MVC is most useful for the client: screens render the view, route and screen controllers coordinate interaction, and API-backed state supplies the model. The client does not use one formal MVC framework. In a viva, describe it as MVC-like separation within the broader BCE architecture.

## 2. Strategy — Lectures 13, 14 and 15

Strategy defines a common operation for a family of behaviours. A caller can select or replace the behaviour without changing its own workflow.

| Strategy family | Contract and concrete strategies | Why it fits |
|---|---|---|
| Pest vision | `IPestVisionStrategy`; `GeminiVisionStrategy`, `MockVisionStrategy` | Recognition code can use the same `analyze` operation with a real provider or a deterministic mock. `PestVisionStrategyFactory` selects based on configuration. |
| Route calculation | `IRouteStrategy`; `OneMapRoadRoutingStrategy`, `DirectDistanceRoutingStrategy` | Dispatch can calculate a route through OneMap or use direct distance through a shared contract. `RouteStrategyFactory` selects the available route behaviour. |
| Score normalisation | `NormalisationStrategy`; `CappedLinearNormalisation`, `LogScaleNormalisation`, `MinMaxNormalisation`, `PremisesMixNormalisation`, `RecencyDecayNormalisation` | The scoring engine can apply driver-specific transformations through a common strategy contract. `NormalisationFactory` binds each driver to a strategy. The current factory uses log, capped-linear, premises-mix and recency-decay implementations; verify whether `MinMaxNormalisation` is still referenced before claiming it is active. |
| Notification delivery | `INotificationChannelStrategy`; `TelegramChannelStrategy`, `InAppAlertChannelStrategy`, `RecordingChannelStrategy` | Notification delivery strategies decoupled from alert dispatch logic. `NotificationChannelFactory` instantiates the appropriate channel based on user preference or environment. |

The pattern is strongest when the caller depends on the abstraction. A factory by itself does not make a class a Strategy; the common operation and interchangeable implementations do.

## 3. Factory Method and Abstract Factory — Lecture 14

Factories centralise object selection and construction. They reduce coupling to concrete constructors and keep configuration decisions at a composition boundary.

| Factory | Products and selection |
|---|---|
| `DataStoreFactory` | Selects persistent or in-memory store implementations. This is a simple factory unless a caller uses a family of related stores created as one coordinated product family. |
| `PestVisionStrategyFactory` | Builds the configured vision strategy, with a mock fallback when the provider or key is unavailable. |
| `RouteStrategyFactory` | Selects OneMap road routing when a gateway exists, otherwise direct-distance routing. |
| `NormalisationFactory` | Builds and binds normalisation strategies to every scoring driver. It validates missing or duplicate bindings. |
| `IngestionJobFactory` | Resolves and instantiates the appropriate `IIngestionStrategy` given a `SourceKind` (Clusters, Rainfall, Forecast, Gravitrap, Observations). |

**Factory Method** lets a creator decide which product implementation to return. **Abstract Factory** exposes operations for creating related products that should work together. D-Fence has several simple/static factories. The evidence does not support claiming a full Abstract Factory implementation across the persistence, gateway and controller graph.

## 4. Observer — Lectures 13 and 15

Observer allows a subject to notify registered observers when an event occurs, without the subject naming the concrete response classes.

`src/control/observer/WorkOrderObserver.ts` implements this directly:

- `WorkOrderSubject` stores `IWorkOrderObserver` instances.
- `register` and `unregister` manage subscriptions.
- `notify` sends a `WorkOrderEvent` to each observer.
- `AuditLogObserver` and `CrewNotificationObserver` adapt callbacks to the observer contract.

`src/control/observer/` implements typed Observer patterns across domain lifecycle events:

- `src/control/observer/IObserver.ts`: Generic `ISubject<TEvent>` and `IObserver<TEvent>` base contracts with `attach()`, `detach()`, and `notify()`.
- `WorkOrderSubject` (`WorkOrderObserver.ts`): Stores `IWorkOrderObserver` instances, notifying `AuditLogObserver` and `CrewNotificationObserver` on dispatch/completion.
- `ReportSubject` (`ReportObserver.ts`): Emits typed `ReportEvent` notifications when reports are submitted, verified, or moderated.
- `ClusterSubject` (`ClusterObserver.ts`): Emits typed `ClusterEvent` notifications when cluster scores change or priority tiers transition.

`DomainEventPublisher` exists as an application-wide event bus interface, delegating event types to specialized domain subjects.

## 5. Adapter — Lecture 14

An Adapter translates one interface or protocol into the interface the application expects. D-Fence gateways isolate external services from controls and ports.

| Adapter | Adapted service or contract |
|---|---|
| `OneMapGateway` | OneMap geocoding and route services into project gateway contracts. |
| `NEAFeedGateway` | NEA/data.gov.sg dengue feeds into the cluster-source contract. |
| `TelegramGateway` | Telegram Bot API calls into notification and bot-update operations. |
| `PestVisionGateway` | Vision-provider HTTP calls into the provider interface used by the vision strategy. |
| `RainfallGateway`, `ForecastGateway`, `GravitrapGateway`, `INaturalistGateway`, `VCORegistryGateway`, Supabase gateways | External feed, storage or identity protocols into D-Fence ports. |

The gateway is an Adapter when it translates a provider-specific protocol into a project-facing contract. A wrapper that only forwards calls without translation may be better described as a gateway or client wrapper.

## 6. Template Method — Lecture 14

`AbstractIngestionJob.run()` defines the shared algorithm: record start, decide whether to fetch, fetch, parse, persist, record outcome and handle failure. Concrete ingestion jobs provide the source-specific steps. This keeps failure and run-recording rules consistent while allowing each source to vary its fetch and parsing work.

`CompositeObservationJob` overrides `run()` to aggregate several observation jobs. It is a specialised case and does not use the base algorithm unchanged. State this exception if asked whether every job follows the template exactly.

## 7. Façade — Lecture 14, slides 15–20

The GoF Façade provides a higher-level interface to a subsystem. `DengueSystemFacade` presents four simple operations:

- `boot()` loads configuration and runs registered module registrations.
- `resolveController<T>(name)` resolves a registered service without exposing the container.
- `getHealth()` reports lifecycle and optional database readiness.
- `shutdown()` closes the owned database resource and is safe to call again.

`AppConfigurator` performs the configuration and dependency-registration work behind the façade. Modules register factories before boot. Boot loads `ConfigSet`, creates the optional database service and then invokes the module registrations.

This facade is an available composition API. `src/server.ts` remains the current production composition root and does not yet delegate its full controller graph to `DengueSystemFacade`. Therefore, the facade demonstrates the pattern but does not replace or unify every production wiring path yet. This distinction is important in a viva.

## 8. Singleton — Lectures 13 and 14

The current `Database` class is **not** a GoF Singleton. Each instance owns its own lazily created PostgreSQL pool. The `ConfigLoader` class is also **not** a Singleton: static methods do not enforce one instance or one shared state. Calling either a Singleton would be inaccurate.

The system does use process-level composition in `src/server.ts`, which creates one database and shares it among repositories for that running server. This is one shared instance by wiring convention, not a Singleton implementation. That choice also permits tests to create isolated database instances.

## 9. Composite — Lecture 15

`CompositeObservationJob` aggregates several `ObservationIngestionJob` objects and exposes them as one `AbstractIngestionJob` to `IngestionController`. The caller can run the composite through the same job abstraction as a leaf job. It combines outcomes and counts from its children. This is the clearest GoF Composite example in the backend.

The React client also builds nested components from smaller components. This is composition in React. Call it the GoF Composite only if the explanation identifies the shared component interface and shows that leaf and composite objects are used uniformly. The presence of nested JSX alone is not sufficient evidence.

## Viva summary

Lead with the design purpose, then name the participants and show the substitution or collaboration in code. Separate implemented patterns from intended patterns. In particular, describe the factories as simple factories where appropriate, the work-order subject as the working Observer, `DomainEventPublisher` as unfinished, the database/config loader as non-Singletons, and the new façade as separate from the existing production composition root.
