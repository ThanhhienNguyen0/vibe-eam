-- REQ-31: user defined catalogs (additive).
ALTER TABLE "Company" ADD COLUMN "catalogsInitialized" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "Catalog" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "kind" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Catalog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Catalog_companyId_sortOrder_idx" ON "Catalog"("companyId", "sortOrder");

ALTER TABLE "Catalog" ADD CONSTRAINT "Catalog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
