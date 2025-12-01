-- Migration: add logLevel column to SystemConfig
-- Adds an optional TEXT column `logLevel` which can be: 'debug'|'info'|'warn'|'error'

PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;

-- Add the new column to the SystemConfig table with a default of 'warn' (least verbose)
ALTER TABLE "SystemConfig" ADD COLUMN "logLevel" TEXT DEFAULT 'warn';

-- Ensure any existing rows explicitly have the least verbose log level set
UPDATE "SystemConfig" SET "logLevel" = 'warn' WHERE "logLevel" IS NULL;

COMMIT;
PRAGMA foreign_keys=ON;
