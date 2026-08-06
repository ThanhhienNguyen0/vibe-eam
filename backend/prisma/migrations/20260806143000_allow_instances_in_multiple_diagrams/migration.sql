-- Preserve existing diagram memberships while allowing the same component or
-- connection instance to be displayed in more than one diagram.
CREATE TABLE "DiagramComponentMembership" (
    "diagramId" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "position" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "DiagramComponentMembership_pkey" PRIMARY KEY ("diagramId", "componentId")
);

CREATE TABLE "DiagramConnectionMembership" (
    "diagramId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,

    CONSTRAINT "DiagramConnectionMembership_pkey" PRIMARY KEY ("diagramId", "connectionId")
);

INSERT INTO "DiagramComponentMembership" ("diagramId", "componentId", "position")
SELECT "diagramId", "id", "position"
FROM "ComponentInstance"
WHERE "diagramId" IS NOT NULL;

INSERT INTO "DiagramConnectionMembership" ("diagramId", "connectionId")
SELECT "diagramId", "id"
FROM "ConnectionInstance"
WHERE "diagramId" IS NOT NULL;

CREATE INDEX "DiagramComponentMembership_componentId_idx"
ON "DiagramComponentMembership"("componentId");

CREATE INDEX "DiagramConnectionMembership_connectionId_idx"
ON "DiagramConnectionMembership"("connectionId");

ALTER TABLE "DiagramComponentMembership"
ADD CONSTRAINT "DiagramComponentMembership_diagramId_fkey"
FOREIGN KEY ("diagramId") REFERENCES "Diagram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DiagramComponentMembership"
ADD CONSTRAINT "DiagramComponentMembership_componentId_fkey"
FOREIGN KEY ("componentId") REFERENCES "ComponentInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DiagramConnectionMembership"
ADD CONSTRAINT "DiagramConnectionMembership_diagramId_fkey"
FOREIGN KEY ("diagramId") REFERENCES "Diagram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DiagramConnectionMembership"
ADD CONSTRAINT "DiagramConnectionMembership_connectionId_fkey"
FOREIGN KEY ("connectionId") REFERENCES "ConnectionInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ComponentInstance" DROP CONSTRAINT "ComponentInstance_diagramId_fkey";
ALTER TABLE "ConnectionInstance" DROP CONSTRAINT "ConnectionInstance_diagramId_fkey";

DROP INDEX "ComponentInstance_diagramId_idx";
DROP INDEX "ConnectionInstance_diagramId_idx";

ALTER TABLE "ComponentInstance" DROP COLUMN "diagramId", DROP COLUMN "position";
ALTER TABLE "ConnectionInstance" DROP COLUMN "diagramId";
