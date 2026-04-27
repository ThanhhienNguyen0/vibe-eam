-- CreateTable
CREATE TABLE "DiagramNode" (
    "id" UUID NOT NULL,
    "diagramId" UUID NOT NULL,
    "elementKey" UUID NOT NULL,
    "x" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "y" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiagramNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiagramEdge" (
    "id" UUID NOT NULL,
    "diagramId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "sourceKey" UUID NOT NULL,
    "targetKey" UUID NOT NULL,
    "attributes" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiagramEdge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DiagramNode_diagramId_idx" ON "DiagramNode"("diagramId");

-- CreateIndex
CREATE INDEX "DiagramNode_elementKey_idx" ON "DiagramNode"("elementKey");

-- CreateIndex
CREATE UNIQUE INDEX "DiagramNode_diagramId_elementKey_key" ON "DiagramNode"("diagramId", "elementKey");

-- CreateIndex
CREATE INDEX "DiagramEdge_diagramId_idx" ON "DiagramEdge"("diagramId");

-- CreateIndex
CREATE INDEX "DiagramEdge_sourceKey_idx" ON "DiagramEdge"("sourceKey");

-- CreateIndex
CREATE INDEX "DiagramEdge_targetKey_idx" ON "DiagramEdge"("targetKey");

-- CreateIndex
CREATE INDEX "DiagramEdge_type_idx" ON "DiagramEdge"("type");

-- AddForeignKey
ALTER TABLE "DiagramNode" ADD CONSTRAINT "DiagramNode_diagramId_fkey" FOREIGN KEY ("diagramId") REFERENCES "Diagram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagramEdge" ADD CONSTRAINT "DiagramEdge_diagramId_fkey" FOREIGN KEY ("diagramId") REFERENCES "Diagram"("id") ON DELETE CASCADE ON UPDATE CASCADE;
