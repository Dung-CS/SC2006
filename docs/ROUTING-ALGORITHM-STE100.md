# How D-Fence plans dispatch routes

Date: 30 October 2026. Application source: `5fde789`.

Style: ASD-STE100 principles, with technical terms defined below. This file has no formal STE100 compliance certification.

## 1. Purpose

The planner puts eligible tasks into crew routes.
Each route starts and ends at the crew's headquarters (HQ).
The planner checks staff, vehicles, road access and total time.

The method is **priority-first greedy insertion with bounded local search**.
Greedy insertion means that the planner adds one task at a time.
Local search means that the planner tests changes to routes that it has already built.
Bounded means that the planner stops these checks at set limits.

The planner does not prove that its result is the shortest possible plan.
It can leave a task unassigned when its search limit stops further checks.

## 2. Select the tasks

The planner reads work orders, eligible Verified or Actioned reports, and daily proposals.
It uses the task's scheduled date to decide when the task can enter a plan.
It includes overdue work that remains eligible.

A non-mosquito proposal needs a verified source report.
A pest score alone cannot create that dispatch task.
Official mosquito cluster proposals can use the cluster boundary as a service area.
A service area is a mapped region where the task can start.

When the verified source report is available, the planner preserves its recorded location.
It does not move that task to a more convenient cluster centre.

The planner checks for repeated task and report identities.
It also groups some nearby reports before it builds route tasks.
Reports in one group must have the same pest, report type and task type.
Each report pair must meet the distance limit.
The default limit is 100 metres; the configured value can differ.
The planner keeps the original reports and their identities.

Different pest types or task types can remain separate tasks at the same site.
The planner can put these tasks on the same route.

The planner excludes existing committed work from new allocation.
Committed states include Assigned, Accepted, In Progress and Rejected.
Rejected work needs review of its existing assignment.
The dashboard keeps committed work separate from new route proposals.

## 3. Find staff and vehicles

The planner groups eligible staff by HQ, capability, availability and on-call delay.
A capability is the recorded type of work that a staff member can do.
The planner requires active crew accounts with a recorded HQ and capability.
It accepts Available or On Call status.

The planner removes known committed assignees from free staff capacity.
The current model does not identify all supporting crew members on existing work orders.
Thus, this reservation cannot account for unknown supporting staff.

Each new route uses a count of staff from one group.
When the planner adds a task, it increases that count if the task needs more staff.
It reserves the additional staff from the group's remaining count.
It can create another route if the group has enough staff and another suitable vehicle.

Wildlife, designated bird cases and bee or wasp cases require the recorded Authority Response capability.
These cases use the same dispatch process as other work.
General inspection capability does not qualify a crew for these cases.

The route needs an available vehicle from the same HQ.
The vehicle must have enough seats, payload capacity and cargo space.
Each equipment item must fit the cargo dimensions in an allowed orientation.
The planner reserves a different vehicle for each simultaneous route.

The cargo check uses equipment and load estimates.
It does not calculate the exact placement of all items inside the vehicle.

## 4. Put tasks in priority order

The planner considers Critical tasks first, then High, Medium and Low tasks.

Within the same priority level, it applies these rules in order:

1. Prefer the task with fewer capability-compatible staff groups.
2. Prefer the lower product of estimated work time and required staff count.
3. Prefer the task with the higher priority score.

After an allocation, the planner starts again at the highest remaining priority level.
The first tie-break counts matching capabilities, not the remaining staff in each group.
A lower-priority task can still enter a route when a higher-priority task cannot fit.
Thus, a high priority does not guarantee an allocation.

Task order inside each route must also preserve priority.
A lower-priority task cannot precede a higher-priority task.
This rule can increase travel time.

## 5. Test where to put the next task

For each task, the planner checks compatible staff groups.
It considers their existing routes and the option to start a new route.
It tests insertion positions that preserve priority order.
An insertion position is a gap before, between or after the existing tasks.

The planner first checks staff, vehicles, cargo and any configured stop limit.
It rejects a candidate when work time plus on-call delay exceeds four hours.
It checks the full time limit after it obtains route evidence.
It then ranks the remaining candidates with a straight-line travel estimate.
This estimate includes departure from HQ and return to HQ.
It estimates urban travel at about 35 kilometres per hour.
For a separate leg of at least 10 metres, it uses a minimum of three minutes.
A leg is the travel between two consecutive stops.

This estimate only orders the candidate list.
It does not prove that a road connects the stops.

For each task attempt, the planner checks up to six candidate routes through the road strategy.
The road strategy uses OneMap route data.
Among the checked candidates, the planner selects the smallest accepted increase in verified travel time.
This travel time includes driving and walking.
For an existing route, it subtracts that route's previous travel time.
For a new route, it uses the full circuit travel time.

The planner does not require a task to use the nearest HQ.
A farther HQ can supply the selected crew if that candidate passes the checks and wins this comparison.
The limited candidate list also affects this choice.

## 6. Verify road and walking access

The road strategy obtains directed driving legs from OneMap.
Directed means that travel from A to B can differ from travel from B to A.
The strategy checks that the legs join into one continuous circuit.
It rejects missing or unusable route evidence.

For an exact task location, direct road access needs an endpoint within 25 metres.
If the endpoint is farther away, the strategy requests two walking paths.
One path goes from the vehicle access point to the task.
The other path returns to the vehicle.
Each path must take no more than ten minutes.
Each walking endpoint must also meet the 25-metre location tolerance.

For an eligible area task, a verified road point inside the service area can supply access.
This rule does not prove that one stop serves the whole area.
An exact report location does not receive this area exception.

HQ locations represent depot centres.
The road strategy allows a separate 250-metre tolerance for depot road access.
This depot tolerance does not apply to exact task locations.

The application uses the OneMap road strategy for executable routes.
A straight-line estimate cannot replace failed road verification in an executable route.

## 7. Apply the four-hour limit

The planner calculates total route time as follows:

**Total time = driving time + both walking times + task work time + on-call delay + explicit return handling time.**

Total time must not exceed four hours, including the final return to HQ.
An explicit intermediate return adds its travel and 20 minutes of handling time.
The planner does not add intermediate returns from pest type alone.

Work times and staff requirements include provisional planning defaults.
For example, fogging uses 45 work minutes, and inspection uses 30 work minutes.
Pest-specific defaults can take precedence over task defaults.
These values are estimates, not measured completion times or approved staffing standards.

## 8. Try small route improvements

After initial allocation, the planner uses the remaining search time for local changes.
It can reverse a section of one route when all tasks in that section have the same priority.
It can exchange equal-priority tasks between two routes.
It can also move a task from one route to another.

Each accepted change must reduce verified travel time and preserve the route constraints.
A moved task must fit the destination crew's capability, staff count and vehicle.
The source route must remain non-empty.

The current search allows up to 64 within-route checks and 136 cross-route checks.
It stops after the first accepted cross-route improvement.
It does not retry unassigned tasks after this improvement stage.
Thus, a route improvement does not guarantee that the planner fills all released capacity.

## 9. Plan up to seven days

The planner processes dates from the first selected day to the last.
It carries eligible unassigned tasks forward to later days.
It prevents the same task or represented report from entering another new route in that horizon.
It also keeps committed identities out of later new allocations.

Future plans reuse current staff and vehicle availability as a planning assumption.
The preview does not book staff or vehicles.
The model does not provide a confirmed future roster.

One horizon calculation has a shared 30-second planning budget.
The service divides the remaining time among the remaining days.
It keeps a small allowance to publish accepted results.
Each daily planner also has a default road-search budget of 30 seconds.
The horizon can give that day less time.
A candidate route check has a maximum default wait of five seconds.
The planner can shorten that wait when it already has an accepted alternative.

The service calculates plans in the background and serves saved results to the dashboard.
It can retain the last complete plan during an update.
An initial calculation can publish partial days.
Failed verification can trigger a retry after 30 seconds.
Unchanged plans can remain reusable for five minutes.

The road strategy also saves directed leg results for five minutes.
It limits concurrent leg requests to four per strategy instance.
These limits control search work and waiting.
They do not guarantee that every active network request ends within the planning budget.

## 10. Read an unassigned result

An unassigned task can have two main explanations.
The planner could not verify a complete route during the search.
Or no checked combination met the capability, staff, vehicle, cargo and four-hour constraints.

A provider failure or an expired search budget can leave access unverified.
An unverified result does not prove that the site is unreachable.
The planner does not guarantee an allocation for every high-priority task.

The HQ and Job Type checkboxes change the displayed tasks and routes.
They do not change the allocation algorithm.
The map keeps the full verified geometry of each displayed route.

## 11. Example

Assume two eligible inspection tasks have the same priority.
Assume one crew can do both tasks and has a suitable vehicle.

The planner tests adding the second task to the existing route.
It also considers a new route if spare staff and a vehicle exist.
The planner compares verified travel increases for the checked candidates.
It accepts the candidate with the smallest increase that meets all limits.

For example, 50 travel minutes plus 60 work minutes gives a 110-minute route.
This example assumes no on-call delay, walking or intermediate return handling.
The 50 travel minutes include the final return to HQ.
The example explains the decision; it is not a measured live route.

## 12. Code references

| Subject | Source |
|---|---|
| Task sources, exact locations and staff groups | [DispatchRouteInputs.ts](../src/control/DispatchRouteInputs.ts) |
| Nearby report grouping | [ReportSpatialClustering.ts](../src/control/ReportSpatialClustering.ts) |
| Capability rules | [StaffRoutingPolicy.ts](../src/control/StaffRoutingPolicy.ts) |
| Task order, insertion, resource checks and local search | [RouteOptimizationService.ts](../src/control/RouteOptimizationService.ts) |
| One-to-seven-day plans, saved results and retry limits | [DispatchPlanService.ts](../src/control/DispatchPlanService.ts) |
| Driving and walking evidence | [OneMapRoadRoutingStrategy.ts](../src/control/routing/OneMapRoadRoutingStrategy.ts) |
| Final access checks | [IRouteStrategy.ts](../src/control/routing/IRouteStrategy.ts) |
| Vehicle load estimates | [LogisticsPolicy.ts](../src/control/LogisticsPolicy.ts) |
| Application route strategy | [RouteStrategyFactory.ts](../src/control/routing/RouteStrategyFactory.ts) |

This description records the current implementation.
It does not propose a new algorithm or change the application.
