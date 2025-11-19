-- Add writeInCount column to Question for MULTI_MULTI write-in slots
ALTER TABLE "Question" ADD COLUMN "writeInCount" INTEGER NOT NULL DEFAULT 0;
