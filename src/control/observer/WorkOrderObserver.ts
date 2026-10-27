export interface WorkOrderEvent {
  type: 'created' | 'dispatched';
  workOrderId: string;
  occurredAt: Date;
}

export interface IWorkOrderObserver {
  onWorkOrderEvent(event: WorkOrderEvent): Promise<void> | void;
}

export class WorkOrderSubject {
  private readonly observers = new Set<IWorkOrderObserver>();
  register(observer: IWorkOrderObserver): void { this.observers.add(observer); }
  unregister(observer: IWorkOrderObserver): void { this.observers.delete(observer); }
  async notify(event: WorkOrderEvent): Promise<void> {
    for (const observer of this.observers) await observer.onWorkOrderEvent(event);
  }
}

/** Callback adapters keep audit and notification infrastructure outside the subject. */
export class AuditLogObserver implements IWorkOrderObserver {
  constructor(private readonly append: (event: WorkOrderEvent) => Promise<void> | void) {}
  onWorkOrderEvent(event: WorkOrderEvent): Promise<void> | void { return this.append(event); }
}

export class CrewNotificationObserver implements IWorkOrderObserver {
  constructor(private readonly send: (event: WorkOrderEvent) => Promise<void> | void) {}
  onWorkOrderEvent(event: WorkOrderEvent): Promise<void> | void { return this.send(event); }
}
