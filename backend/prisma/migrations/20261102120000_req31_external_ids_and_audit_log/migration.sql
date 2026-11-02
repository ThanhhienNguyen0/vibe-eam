-- AlterTable
ALTER TABLE "ComponentInstance" ADD COLUMN     "externalId" TEXT;

-- AlterTable
ALTER TABLE "ConnectionInstance" ADD COLUMN     "externalId" TEXT;

-- CreateTable
CREATE TABLE "AuditLogEntry" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT,
    "userEmail" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "details" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLogEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditLogEntry_companyId_createdAt_idx" ON "AuditLogEntry"("companyId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ComponentInstance_companyId_externalId_key" ON "ComponentInstance"("companyId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "ConnectionInstance_companyId_externalId_key" ON "ConnectionInstance"("companyId", "externalId");

-- AddForeignKey
ALTER TABLE "AuditLogEntry" ADD CONSTRAINT "AuditLogEntry_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

