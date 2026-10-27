import { ReportStatus, ReportType } from '../../entity/enums';
import { Uuid } from '../../entity/valueTypes';
import { IObserver, Subject } from './IObserver';

export type ReportEvent =
  | { type: 'submitted'; reportId: Uuid; reportType: ReportType; occurredAt: Date }
  | { type: 'verified'; reportId: Uuid; from: ReportStatus; occurredAt: Date }
  | { type: 'moderated'; reportId: Uuid; from: ReportStatus; to: ReportStatus; moderatorId: Uuid; occurredAt: Date };

export interface IReportObserver extends IObserver<ReportEvent> {}

export class ReportSubject extends Subject<ReportEvent> {}
