-- REQ-26: runtime revisions are independent from file schema and metamodel versions.
ALTER TABLE "Company" ADD COLUMN "dataRevision" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ArchitectureModel" ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ComponentInstance" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "ConnectionInstance" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Diagram" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
