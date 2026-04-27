-- AlterTable
ALTER TABLE "Element" ADD COLUMN     "diagramId" UUID;

-- AlterTable
ALTER TABLE "Relation" ADD COLUMN     "diagramId" UUID;

-- CreateTable
CREATE TABLE "Diagram" (
    "id" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Diagram_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Diagram_branchId_idx" ON "Diagram"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "Diagram_branchId_name_key" ON "Diagram"("branchId", "name");

-- CreateIndex
CREATE INDEX "Element_diagramId_idx" ON "Element"("diagramId");

-- CreateIndex
CREATE INDEX "Relation_diagramId_idx" ON "Relation"("diagramId");

-- AddForeignKey
ALTER TABLE "Diagram" ADD CONSTRAINT "Diagram_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Element" ADD CONSTRAINT "Element_diagramId_fkey" FOREIGN KEY ("diagramId") REFERENCES "Diagram"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Relation" ADD CONSTRAINT "Relation_diagramId_fkey" FOREIGN KEY ("diagramId") REFERENCES "Diagram"("id") ON DELETE SET NULL ON UPDATE CASCADE;
