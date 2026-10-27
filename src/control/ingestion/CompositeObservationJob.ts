/**
 * D-Fence — CompositeObservationJob.
 * Stereotype: <<control>>. Traces: 1.5.1, 1.5.8–1.5.14.
 *
 * Runs all taxon-specific observation jobs in sequence, aggregating accepted and rejected
 * counts and feature counts for the SourceKind.Observations run.
 */
import { AbstractIngestionJob, RunOutcome } from './AbstractIngestionJob';
import { ObservationIngestionJob } from './ObservationIngestionJob';
import { IngestionRunStore } from '../../ports/Stores';
import { SourceKind } from '../../entity/enums';
import { IngestionRun } from '../../entity/IngestionRun';
import { ExternalGateway } from '../../ports/ExternalGateway';
import { ParsedBatch, RawPayload } from '../../ports/types';

export class CompositeObservationJob extends AbstractIngestionJob {
  constructor(
    private readonly jobs: ObservationIngestionJob[],
    runs: IngestionRunStore,
  ) {
    super({} as ExternalGateway, runs);
  }

  override async run(trigger: 'SCHEDULED' | 'MANUAL' = 'SCHEDULED'): Promise<IngestionRun> {
    const run = await this.runs.recordStart(SourceKind.Observations, trigger);
    let accepted = 0;
    let rejected = 0;
    let featureCount = 0;
    try {
      for (const job of this.jobs) {
        const subRun = await job.run(trigger);
        accepted += subRun.acceptedCount ?? 0;
        rejected += subRun.rejectedCount ?? 0;
        featureCount += subRun.featureCount ?? 0;
      }
      run.acceptedCount = accepted;
      run.rejectedCount = rejected;
      run.pestType = null;
      return await this.runs.recordOutcome(run, RunOutcome.Success, featureCount);
    } catch {
      await this.runs.markStale(SourceKind.Observations);
      await this.runs.recordOutcome(run, RunOutcome.Failed, 0);
      return run;
    }
  }

  protected sourceKind(): SourceKind {
    return SourceKind.Observations;
  }

  protected fetch(): Promise<RawPayload> {
    return Promise.resolve({} as RawPayload);
  }

  protected parse(_raw: RawPayload): Promise<ParsedBatch> {
    return Promise.resolve([] as unknown as ParsedBatch);
  }

  protected persist(_batch: ParsedBatch): Promise<number> {
    return Promise.resolve(0);
  }
}
