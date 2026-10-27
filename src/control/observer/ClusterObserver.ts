import { PriorityTier } from '../../entity/enums';
import { Uuid } from '../../entity/valueTypes';
import { IObserver, Subject } from './IObserver';

export interface ClusterEvent {
  clusterId: Uuid;
  locality: string;
  score: number;
  tier: PriorityTier;
  previousTier: PriorityTier | null;
  kind: 'priority-transition' | 'priority-updated';
  occurredAt: Date;
}

export interface IClusterObserver extends IObserver<ClusterEvent> {}

export class ClusterSubject extends Subject<ClusterEvent> {}
