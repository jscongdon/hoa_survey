-- Add requireSignature boolean column to Survey
PRAGMA foreign_keys=off;
BEGIN TRANSACTION;
ALTER TABLE "Survey" ADD COLUMN "requireSignature" INTEGER NOT NULL DEFAULT 1;
COMMIT;
PRAGMA foreign_keys=on;
