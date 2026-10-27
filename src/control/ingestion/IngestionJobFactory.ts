import { SourceKind } from '../../entity/enums';
import { IIngestionStrategy } from './IIngestionStrategy';

/** Resolves a source kind to its configured ingestion strategy. */
export class IngestionJobFactory {
  constructor(private readonly jobs: ReadonlyMap<SourceKind, IIngestionStrategy>) {}

  create(source: SourceKind): IIngestionStrategy {
    const job = this.jobs.get(source);
    if (!job) {
      throw new Error(`no ingestion job configured for source '${source}'`);
    }
    return job;
  }
}
