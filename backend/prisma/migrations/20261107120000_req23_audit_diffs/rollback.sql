-- Manual rollback for the disposable REQ-23 migration rehearsal.
DELETE FROM "AuditLogEntry"
WHERE "details"->>'migration' = 'REQ-23-legacy-backfill';

DROP INDEX IF EXISTS "AuditLogEntry_companyId_entityType_entityId_occurredAt_idx";
DROP INDEX IF EXISTS "AuditLogEntry_companyId_userId_occurredAt_idx";
DROP INDEX IF EXISTS "AuditLogEntry_companyId_occurredAt_id_idx";

ALTER TABLE "AuditLogEntry"
  DROP COLUMN "occurredAt",
  DROP COLUMN "batchId",
  DROP COLUMN "changes",
  DROP COLUMN "entityId",
  DROP COLUMN "actorLabel",
  DROP COLUMN "actorType";
