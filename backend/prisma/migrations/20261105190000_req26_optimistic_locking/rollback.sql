-- Manual rollback for the isolated REQ-26 migration rehearsal.
-- Rolling back discards runtime revision counters but not business payload columns.
ALTER TABLE "Diagram" DROP COLUMN "version";
ALTER TABLE "ConnectionInstance" DROP COLUMN "version";
ALTER TABLE "ComponentInstance" DROP COLUMN "version";
ALTER TABLE "ArchitectureModel" DROP COLUMN "revision";
ALTER TABLE "Company" DROP COLUMN "dataRevision";
