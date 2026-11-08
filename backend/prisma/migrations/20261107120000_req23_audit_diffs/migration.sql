-- REQ-23 extends the existing REQ-31 audit table. Runtime revisions, metamodel
-- versions and model-file schema versions remain separate from audit data.
ALTER TABLE "AuditLogEntry"
  ADD COLUMN "actorType" TEXT NOT NULL DEFAULT 'legacy',
  ADD COLUMN "actorLabel" TEXT,
  ADD COLUMN "entityId" TEXT,
  ADD COLUMN "changes" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "batchId" TEXT,
  ADD COLUMN "occurredAt" TIMESTAMP(3);

-- Existing REQ-31 rows already have a trustworthy server timestamp. Actor
-- data is not invented: only rows with a stored user snapshot become users.
UPDATE "AuditLogEntry"
SET "occurredAt" = "createdAt",
    "actorType" = CASE WHEN "userId" IS NULL THEN 'legacy' ELSE 'user' END,
    "actorLabel" = "userEmail";

-- Preserve the historical ArchitectureModel JSONB audit path in the canonical
-- relational history. Old entries did not contain reliable actors or field
-- diffs, so actor/occurredAt stay unknown and changes stay empty. The exact
-- legacy timestamp and payload remain in details; the source JSONB is untouched.
INSERT INTO "AuditLogEntry" (
  "id", "companyId", "userId", "userEmail", "actorType", "actorLabel",
  "action", "entityType", "entityId", "summary", "changes", "details",
  "batchId", "occurredAt", "createdAt"
)
SELECT
  'legacy-' || md5(model."companyId" || ':' || entry.ordinality::text || ':' || COALESCE(entry.item->>'id', '')),
  model."companyId",
  NULL,
  NULL,
  'legacy',
  NULL,
  COALESCE(NULLIF(entry.item->>'action', ''), 'legacy.unknown'),
  'legacy-model',
  NULLIF(entry.item->>'entityId', ''),
  COALESCE(NULLIF(entry.item->>'description', ''), 'Historischer Audit-Eintrag.'),
  '[]'::jsonb,
  jsonb_build_object(
    'origin', 'architecture-model-jsonb',
    'migration', 'REQ-23-legacy-backfill',
    'originalTimestamp', entry.item->'timestamp',
    'legacyEntry', entry.item
  ),
  NULL,
  NULL,
  model."createdAt" + (entry.ordinality - 1) * interval '1 microsecond'
FROM "ArchitectureModel" model
CROSS JOIN LATERAL jsonb_array_elements(
  CASE WHEN jsonb_typeof(model."auditLog") = 'array' THEN model."auditLog" ELSE '[]'::jsonb END
) WITH ORDINALITY AS entry(item, ordinality)
ON CONFLICT ("id") DO NOTHING;

CREATE INDEX "AuditLogEntry_companyId_occurredAt_id_idx"
  ON "AuditLogEntry"("companyId", "occurredAt", "id");
CREATE INDEX "AuditLogEntry_companyId_userId_occurredAt_idx"
  ON "AuditLogEntry"("companyId", "userId", "occurredAt");
CREATE INDEX "AuditLogEntry_companyId_entityType_entityId_occurredAt_idx"
  ON "AuditLogEntry"("companyId", "entityType", "entityId", "occurredAt");

-- Application/runtime connections may append evidence but cannot rewrite or
-- delete it, even through direct SQL/Prisma calls. A database owner or
-- superuser can deliberately drop/disable this trigger; that administrative
-- boundary is documented and is not presented as cryptographic WORM storage.
CREATE OR REPLACE FUNCTION "req23_prevent_audit_log_mutation"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION USING
    ERRCODE = '55000',
    MESSAGE = 'REQ-23: AuditLogEntry is append-only; UPDATE and DELETE are forbidden.';
END;
$$;

CREATE TRIGGER "AuditLogEntry_append_only"
BEFORE UPDATE OR DELETE ON "AuditLogEntry"
FOR EACH ROW
EXECUTE FUNCTION "req23_prevent_audit_log_mutation"();
