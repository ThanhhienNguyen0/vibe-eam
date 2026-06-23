-- CreateTable
CREATE TABLE "Metamodel" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "version" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Metamodel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComponentType" (
    "id" TEXT NOT NULL,
    "metamodelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "layer" TEXT,
    "category" TEXT,
    "color" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "shape" TEXT,
    "customPropertyKeys" JSONB NOT NULL DEFAULT '[]',
    "isRequiredInViewpoint" BOOLEAN,
    "allowedInViewpointIds" JSONB NOT NULL DEFAULT '[]',
    "isAbstract" BOOLEAN NOT NULL DEFAULT false,
    "isStakeholderRelevant" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ComponentType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConnectionType" (
    "id" TEXT NOT NULL,
    "metamodelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "directionDescription" TEXT,
    "color" TEXT NOT NULL,
    "lineStyle" TEXT NOT NULL,
    "semanticCategory" TEXT,
    "category" TEXT,
    "allowedSourceTypeIds" JSONB NOT NULL DEFAULT '[]',
    "allowedTargetTypeIds" JSONB NOT NULL DEFAULT '[]',
    "requiredForSourceTypes" JSONB NOT NULL DEFAULT '[]',
    "requiredForTargetTypes" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "ConnectionType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConnectionRule" (
    "id" TEXT NOT NULL,
    "metamodelId" TEXT NOT NULL,
    "sourceComponentTypeId" TEXT NOT NULL,
    "connectionTypeId" TEXT NOT NULL,
    "targetComponentTypeId" TEXT NOT NULL,
    "allowed" BOOLEAN NOT NULL DEFAULT true,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "severity" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "rationale" TEXT NOT NULL DEFAULT '',
    "viewpointIds" JSONB NOT NULL DEFAULT '[]',
    "minOccurrences" INTEGER,
    "maxOccurrences" INTEGER,

    CONSTRAINT "ConnectionRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Viewpoint" (
    "id" TEXT NOT NULL,
    "metamodelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "stakeholderRole" TEXT NOT NULL DEFAULT '',
    "purpose" TEXT NOT NULL DEFAULT '',
    "visibleLayerIds" JSONB NOT NULL DEFAULT '[]',
    "allowedComponentTypeIds" JSONB NOT NULL DEFAULT '[]',
    "allowedConnectionTypeIds" JSONB NOT NULL DEFAULT '[]',
    "requiredComponentTypeIds" JSONB NOT NULL DEFAULT '[]',
    "requiredConnectionTypeIds" JSONB NOT NULL DEFAULT '[]',
    "requiredConnectionRuleIds" JSONB NOT NULL DEFAULT '[]',
    "maxVisibleLayers" INTEGER,

    CONSTRAINT "Viewpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ViewpointRule" (
    "id" TEXT NOT NULL,
    "metamodelId" TEXT NOT NULL,
    "viewpointId" TEXT NOT NULL,
    "allowedComponentTypeIds" JSONB NOT NULL DEFAULT '[]',
    "allowedConnectionTypeIds" JSONB NOT NULL DEFAULT '[]',
    "allowedConnectionRuleIds" JSONB NOT NULL DEFAULT '[]',
    "requiredComponentTypeIds" JSONB NOT NULL DEFAULT '[]',
    "requiredConnectionTypeIds" JSONB NOT NULL DEFAULT '[]',
    "requiredConnectionRuleIds" JSONB NOT NULL DEFAULT '[]',
    "editableComponentTypeIds" JSONB NOT NULL DEFAULT '[]',
    "visibleComponentTypeIds" JSONB NOT NULL DEFAULT '[]',
    "description" TEXT,
    "severity" TEXT,

    CONSTRAINT "ViewpointRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ValidationRule" (
    "id" TEXT NOT NULL,
    "metamodelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "scope" TEXT NOT NULL,
    "viewpointId" TEXT,
    "sourceComponentTypeId" TEXT,
    "requiredConnectionTypeId" TEXT,
    "targetComponentTypeId" TEXT,
    "direction" TEXT NOT NULL,
    "minOccurrences" INTEGER NOT NULL DEFAULT 0,
    "severity" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ValidationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Diagram" (
    "id" TEXT NOT NULL,
    "metamodelId" TEXT NOT NULL,
    "viewpointId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Diagram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComponentInstance" (
    "id" TEXT NOT NULL,
    "diagramId" TEXT,
    "componentTypeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "properties" JSONB NOT NULL DEFAULT '{}',
    "position" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "ComponentInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConnectionInstance" (
    "id" TEXT NOT NULL,
    "diagramId" TEXT,
    "connectionTypeId" TEXT NOT NULL,
    "sourceComponentId" TEXT NOT NULL,
    "targetComponentId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "properties" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "ConnectionInstance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Metamodel_isActive_idx" ON "Metamodel"("isActive");

-- CreateIndex
CREATE INDEX "ComponentType_metamodelId_idx" ON "ComponentType"("metamodelId");

-- CreateIndex
CREATE INDEX "ConnectionType_metamodelId_idx" ON "ConnectionType"("metamodelId");

-- CreateIndex
CREATE INDEX "ConnectionRule_metamodelId_idx" ON "ConnectionRule"("metamodelId");

-- CreateIndex
CREATE UNIQUE INDEX "ConnectionRule_metamodelId_sourceComponentTypeId_connection_key" ON "ConnectionRule"("metamodelId", "sourceComponentTypeId", "connectionTypeId", "targetComponentTypeId");

-- CreateIndex
CREATE INDEX "Viewpoint_metamodelId_idx" ON "Viewpoint"("metamodelId");

-- CreateIndex
CREATE INDEX "ViewpointRule_metamodelId_idx" ON "ViewpointRule"("metamodelId");

-- CreateIndex
CREATE UNIQUE INDEX "ViewpointRule_metamodelId_viewpointId_key" ON "ViewpointRule"("metamodelId", "viewpointId");

-- CreateIndex
CREATE INDEX "ValidationRule_metamodelId_idx" ON "ValidationRule"("metamodelId");

-- CreateIndex
CREATE INDEX "Diagram_metamodelId_idx" ON "Diagram"("metamodelId");

-- CreateIndex
CREATE INDEX "Diagram_viewpointId_idx" ON "Diagram"("viewpointId");

-- CreateIndex
CREATE INDEX "ComponentInstance_diagramId_idx" ON "ComponentInstance"("diagramId");

-- CreateIndex
CREATE INDEX "ComponentInstance_componentTypeId_idx" ON "ComponentInstance"("componentTypeId");

-- CreateIndex
CREATE INDEX "ConnectionInstance_diagramId_idx" ON "ConnectionInstance"("diagramId");

-- CreateIndex
CREATE INDEX "ConnectionInstance_connectionTypeId_idx" ON "ConnectionInstance"("connectionTypeId");

-- CreateIndex
CREATE INDEX "ConnectionInstance_sourceComponentId_idx" ON "ConnectionInstance"("sourceComponentId");

-- CreateIndex
CREATE INDEX "ConnectionInstance_targetComponentId_idx" ON "ConnectionInstance"("targetComponentId");

-- AddForeignKey
ALTER TABLE "ComponentType" ADD CONSTRAINT "ComponentType_metamodelId_fkey" FOREIGN KEY ("metamodelId") REFERENCES "Metamodel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectionType" ADD CONSTRAINT "ConnectionType_metamodelId_fkey" FOREIGN KEY ("metamodelId") REFERENCES "Metamodel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectionRule" ADD CONSTRAINT "ConnectionRule_metamodelId_fkey" FOREIGN KEY ("metamodelId") REFERENCES "Metamodel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectionRule" ADD CONSTRAINT "ConnectionRule_sourceComponentTypeId_fkey" FOREIGN KEY ("sourceComponentTypeId") REFERENCES "ComponentType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectionRule" ADD CONSTRAINT "ConnectionRule_connectionTypeId_fkey" FOREIGN KEY ("connectionTypeId") REFERENCES "ConnectionType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectionRule" ADD CONSTRAINT "ConnectionRule_targetComponentTypeId_fkey" FOREIGN KEY ("targetComponentTypeId") REFERENCES "ComponentType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Viewpoint" ADD CONSTRAINT "Viewpoint_metamodelId_fkey" FOREIGN KEY ("metamodelId") REFERENCES "Metamodel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ViewpointRule" ADD CONSTRAINT "ViewpointRule_metamodelId_fkey" FOREIGN KEY ("metamodelId") REFERENCES "Metamodel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ViewpointRule" ADD CONSTRAINT "ViewpointRule_viewpointId_fkey" FOREIGN KEY ("viewpointId") REFERENCES "Viewpoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValidationRule" ADD CONSTRAINT "ValidationRule_metamodelId_fkey" FOREIGN KEY ("metamodelId") REFERENCES "Metamodel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValidationRule" ADD CONSTRAINT "ValidationRule_viewpointId_fkey" FOREIGN KEY ("viewpointId") REFERENCES "Viewpoint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValidationRule" ADD CONSTRAINT "ValidationRule_sourceComponentTypeId_fkey" FOREIGN KEY ("sourceComponentTypeId") REFERENCES "ComponentType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValidationRule" ADD CONSTRAINT "ValidationRule_requiredConnectionTypeId_fkey" FOREIGN KEY ("requiredConnectionTypeId") REFERENCES "ConnectionType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValidationRule" ADD CONSTRAINT "ValidationRule_targetComponentTypeId_fkey" FOREIGN KEY ("targetComponentTypeId") REFERENCES "ComponentType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Diagram" ADD CONSTRAINT "Diagram_metamodelId_fkey" FOREIGN KEY ("metamodelId") REFERENCES "Metamodel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Diagram" ADD CONSTRAINT "Diagram_viewpointId_fkey" FOREIGN KEY ("viewpointId") REFERENCES "Viewpoint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComponentInstance" ADD CONSTRAINT "ComponentInstance_diagramId_fkey" FOREIGN KEY ("diagramId") REFERENCES "Diagram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComponentInstance" ADD CONSTRAINT "ComponentInstance_componentTypeId_fkey" FOREIGN KEY ("componentTypeId") REFERENCES "ComponentType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectionInstance" ADD CONSTRAINT "ConnectionInstance_diagramId_fkey" FOREIGN KEY ("diagramId") REFERENCES "Diagram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectionInstance" ADD CONSTRAINT "ConnectionInstance_connectionTypeId_fkey" FOREIGN KEY ("connectionTypeId") REFERENCES "ConnectionType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectionInstance" ADD CONSTRAINT "ConnectionInstance_sourceComponentId_fkey" FOREIGN KEY ("sourceComponentId") REFERENCES "ComponentInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectionInstance" ADD CONSTRAINT "ConnectionInstance_targetComponentId_fkey" FOREIGN KEY ("targetComponentId") REFERENCES "ComponentInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
