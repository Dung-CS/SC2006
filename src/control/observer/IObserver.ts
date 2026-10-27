/** Observer contract for typed domain events. */
export interface IObserver<TEvent> {
  update(event: TEvent): Promise<void>;
}

export interface ISubject<TEvent> {
  attach(observer: IObserver<TEvent>): void;
  detach(observer: IObserver<TEvent>): void;
  notify(event: TEvent): Promise<void>;
}

/** Snapshot subscribers so attach/detach during an update applies to the next event. */
export abstract class Subject<TEvent> implements ISubject<TEvent> {
  private readonly observers = new Set<IObserver<TEvent>>();

  attach(observer: IObserver<TEvent>): void { this.observers.add(observer); }
  detach(observer: IObserver<TEvent>): void { this.observers.delete(observer); }

  async notify(event: TEvent): Promise<void> {
    for (const observer of [...this.observers]) await observer.update(event);
  }
}
