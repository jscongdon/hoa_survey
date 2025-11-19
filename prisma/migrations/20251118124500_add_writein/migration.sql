-- Add writeIn boolean column to Question
PRAGMA foreign_keys=off;
BEGIN TRANSACTION;
ALTER TABLE "Question" ADD COLUMN "writeIn" INTEGER NOT NULL DEFAULT 0;
COMMIT;
PRAGMA foreign_keys=on;
