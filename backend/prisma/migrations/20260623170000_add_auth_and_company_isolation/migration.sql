-- Issue #18: application authentication and company-scoped EAM data.
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "companyId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ArchitectureModel" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "elements" JSONB NOT NULL DEFAULT '[]',
    "relations" JSONB NOT NULL DEFAULT '[]',
    "auditLog" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ArchitectureModel_pkey" PRIMARY KEY ("id")
);

INSERT INTO "Company" ("id", "name", "createdAt", "updatedAt")
VALUES ('company-default-demo', 'Default Demo Company', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

ALTER TABLE "Metamodel" ADD COLUMN "companyId" TEXT;
ALTER TABLE "Diagram" ADD COLUMN "companyId" TEXT;
ALTER TABLE "ComponentInstance" ADD COLUMN "companyId" TEXT;
ALTER TABLE "ConnectionInstance" ADD COLUMN "companyId" TEXT;

UPDATE "Metamodel" SET "companyId" = 'company-default-demo' WHERE "companyId" IS NULL;
UPDATE "Diagram" SET "companyId" = 'company-default-demo' WHERE "companyId" IS NULL;
UPDATE "ComponentInstance" SET "companyId" = 'company-default-demo' WHERE "companyId" IS NULL;
UPDATE "ConnectionInstance" SET "companyId" = 'company-default-demo' WHERE "companyId" IS NULL;

ALTER TABLE "Metamodel" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "Diagram" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "ComponentInstance" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "ConnectionInstance" ALTER COLUMN "companyId" SET NOT NULL;

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_companyId_idx" ON "User"("companyId");
CREATE UNIQUE INDEX "ArchitectureModel_companyId_key" ON "ArchitectureModel"("companyId");
CREATE INDEX "Metamodel_companyId_idx" ON "Metamodel"("companyId");
CREATE INDEX "Diagram_companyId_idx" ON "Diagram"("companyId");
CREATE INDEX "ComponentInstance_companyId_idx" ON "ComponentInstance"("companyId");
CREATE INDEX "ConnectionInstance_companyId_idx" ON "ConnectionInstance"("companyId");

ALTER TABLE "User" ADD CONSTRAINT "User_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ArchitectureModel" ADD CONSTRAINT "ArchitectureModel_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Metamodel" ADD CONSTRAINT "Metamodel_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Diagram" ADD CONSTRAINT "Diagram_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ComponentInstance" ADD CONSTRAINT "ComponentInstance_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConnectionInstance" ADD CONSTRAINT "ConnectionInstance_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
