-- Add createdById column to Survey
PRAGMA foreign_keys=off;
BEGIN TRANSACTION;
ALTER TABLE "Survey" ADD COLUMN "createdById" TEXT;
COMMIT;
PRAGMA foreign_keys=on;
