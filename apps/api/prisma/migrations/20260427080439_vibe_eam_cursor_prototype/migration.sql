-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'MODELER', 'VIEWER');

-- CreateEnum
CREATE TYPE "BranchStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'MERGE');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'MODELER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Branch" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "status" "BranchStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "forkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "baseBranchId" UUID,
    "createdById" UUID NOT NULL,

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Element" (
    "id" UUID NOT NULL,
    "key" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "archiType" TEXT NOT NULL,
    "layer" TEXT NOT NULL,
    "documentation" TEXT,
    "attributes" JSONB NOT NULL DEFAULT '{}',
    "x" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "y" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "startDate" TIMESTAMP(3),
    "endOfLife" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Element_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Relation" (
    "id" UUID NOT NULL,
    "key" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "sourceKey" UUID NOT NULL,
    "targetKey" UUID NOT NULL,
    "attributes" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Relation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "actorUserId" UUID NOT NULL,
    "action" "AuditAction" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityKey" UUID,
    "before" JSONB,
    "after" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Branch_baseBranchId_idx" ON "Branch"("baseBranchId");

-- CreateIndex
CREATE UNIQUE INDEX "Branch_name_key" ON "Branch"("name");

-- CreateIndex
CREATE INDEX "Element_branchId_idx" ON "Element"("branchId");

-- CreateIndex
CREATE INDEX "Element_key_idx" ON "Element"("key");

-- CreateIndex
CREATE INDEX "Element_layer_idx" ON "Element"("layer");

-- CreateIndex
CREATE INDEX "Element_archiType_idx" ON "Element"("archiType");

-- CreateIndex
CREATE UNIQUE INDEX "Element_branchId_key_key" ON "Element"("branchId", "key");

-- CreateIndex
CREATE INDEX "Relation_branchId_idx" ON "Relation"("branchId");

-- CreateIndex
CREATE INDEX "Relation_sourceKey_idx" ON "Relation"("sourceKey");

-- CreateIndex
CREATE INDEX "Relation_targetKey_idx" ON "Relation"("targetKey");

-- CreateIndex
CREATE INDEX "Relation_type_idx" ON "Relation"("type");

-- CreateIndex
CREATE UNIQUE INDEX "Relation_branchId_key_key" ON "Relation"("branchId", "key");

-- CreateIndex
CREATE INDEX "AuditEvent_branchId_createdAt_idx" ON "AuditEvent"("branchId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_actorUserId_createdAt_idx" ON "AuditEvent"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_entityType_createdAt_idx" ON "AuditEvent"("entityType", "createdAt");

-- AddForeignKey
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_baseBranchId_fkey" FOREIGN KEY ("baseBranchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Element" ADD CONSTRAINT "Element_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Relation" ADD CONSTRAINT "Relation_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
