import { IngestionRun } from '../../entity/IngestionRun';

/** Result recorded for one ingestion strategy execution. */
export type IngestionOutcome = IngestionRun;

/** Strategy contract shared by source-specific ingestion jobs. */
export interface IIngestionStrategy {
  execute(): Promise<IngestionOutcome>;
}
