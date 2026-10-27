import { AccountStore, AuditStore, ClusterStore, PriorityScoreStore, RainfallStore, ReportStore, WorkOrderStore } from '../ports/Stores';
import { Database } from './Database';
import { AccountRepository } from './AccountRepository';
import { AuditRepository } from './AuditRepository';
import { ClusterRepository } from './ClusterRepository';
import { PriorityScoreRepository } from './PriorityScoreRepository';
import { RainfallRepository } from './RainfallRepository';
import { ReportRepository } from './ReportRepository';
import { WorkOrderRepository } from './WorkOrderRepository';
import { InMemoryAccountStore } from './memory/InMemoryAccountStores';
import { InMemoryAuditStore, InMemoryClusterStore, InMemoryPriorityScoreStore, InMemoryRainfallStore } from './memory/InMemoryStores';
import { InMemoryReportStore } from './memory/InMemoryReportStores';
import { InMemoryWorkOrderStore } from './memory/InMemoryWorkOrderStores';

/** Creates a store backed by Postgres, or its in-memory counterpart when no database is configured. */
export class DataStoreFactory {
  static createAccountStore(db: Database | null): AccountStore {
    return db === null ? new InMemoryAccountStore() : new AccountRepository(db);
  }

  static createWorkOrderStore(db: Database | null): WorkOrderStore {
    return db === null ? new InMemoryWorkOrderStore() : new WorkOrderRepository(db);
  }

  static createClusterStore(db: Database | null): ClusterStore {
    return db === null ? new InMemoryClusterStore() : new ClusterRepository(db);
  }

  static createReportStore(db: Database | null): ReportStore {
    return db === null ? new InMemoryReportStore() : new ReportRepository(db);
  }

  static createAuditStore(db: Database | null): AuditStore {
    return db === null ? new InMemoryAuditStore() : new AuditRepository(db);
  }

  static createRainfallStore(db: Database | null): RainfallStore {
    return db === null ? new InMemoryRainfallStore() : new RainfallRepository(db);
  }

  static createPriorityScoreStore(db: Database | null): PriorityScoreStore {
    return db === null ? new InMemoryPriorityScoreStore() : new PriorityScoreRepository(db);
  }
}
