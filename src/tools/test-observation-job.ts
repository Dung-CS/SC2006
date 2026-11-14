import { ConfigLoader } from '../config/ConfigLoader';
import { Database } from '../persistence/Database';
import { ClusterRepository, PostgresClusterLocator } from '../persistence/ClusterRepository';
import { ObservationRepository } from '../persistence/PestReferenceRepositories';
import { IngestionRunRepository } from '../persistence/IngestionRunRepository';
import { INaturalistGateway } from '../boundary/gateways/INaturalistGateway';
import { HttpClient } from '../boundary/gateways/HttpClient';
import { ObservationIngestionJob } from '../control/ingestion/ObservationIngestionJob';
import { EvidenceTier } from '../entity/enums';
import { CompositeObservationJob } from '../control/ingestion/CompositeObservationJob';

async function main() {
  const config = ConfigLoader.load();
  const db = new Database(config.get('DATABASE_URL'));
  const http = new HttpClient();
  const clusters = new ClusterRepository(db);
  const locator = new PostgresClusterLocator(clusters);
  const observations = new ObservationRepository(db);
  const runs = new IngestionRunRepository(db);

  try {
    const active = await clusters.findActive();
    console.log(`Active clusters count: ${active.length}`);
    active.forEach(c => console.log(` - ${c.id}: ${c.locality}`));

    const observationJobs = [...config.pestProfiles.values()]
      .filter((p) => p.evidenceTier === EvidenceTier.B && p.observationTaxonId !== null)
      .map((profile) => new ObservationIngestionJob(
        new INaturalistGateway(http),
        runs,
        observations,
        locator,
        profile,
      ));

    console.log(`Initialized ${observationJobs.length} observation jobs for Tier B pests:`,
      observationJobs.map(j => (j as any).profile.pestType)
    );

    const composite = new CompositeObservationJob(observationJobs, runs);
    console.log('Running composite observation ingestion job...');
    const result = await composite.run('MANUAL');
    console.log('Composite job completed:', {
      outcome: result.outcome,
      acceptedCount: result.acceptedCount,
      rejectedCount: result.rejectedCount,
      startedAt: result.startedAt,
      endedAt: result.endedAt,
    });

    const obsCount = await db.query(
      'SELECT pest_type, locality_id, count(*) FROM observation_record GROUP BY pest_type, locality_id'
    );
    console.log('New observation distribution in DB:', obsCount);

  } finally {
    await db.close();
  }
}

main().catch(console.error);
