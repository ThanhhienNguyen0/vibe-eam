-- REQ-24: preserve architecture access; elect a deterministic bootstrap admin per company.
-- Unknown legacy values require operator remediation, never implicit privilege grants.
BEGIN;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "User" WHERE "role" NOT IN ('member', 'Admin', 'Architect', 'Viewer')) THEN
    RAISE EXCEPTION 'REQ-24: unknown legacy role; review users before retrying migration';
  END IF;
END $$;

WITH ranked AS (
  SELECT "id", "companyId", ROW_NUMBER() OVER (PARTITION BY "companyId" ORDER BY "createdAt", "id") AS position
  FROM "User" WHERE "role" = 'member'
)
UPDATE "User" u SET "role" = CASE
  WHEN r.position = 1 AND NOT EXISTS (
    SELECT 1 FROM "User" a WHERE a."companyId" = r."companyId" AND a."role" = 'Admin'
  ) THEN 'Admin' ELSE 'Architect' END
FROM ranked r WHERE u."id" = r."id";

CREATE TYPE "Role" AS ENUM ('Admin', 'Architect', 'Viewer');
ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "Role" USING ("role"::"Role");
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'Viewer';
COMMIT;
