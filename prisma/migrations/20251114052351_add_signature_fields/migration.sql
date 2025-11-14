-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Response" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "surveyId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "answers" TEXT NOT NULL,
    "submittedAt" DATETIME,
    "signed" BOOLEAN NOT NULL DEFAULT false,
    "signedAt" DATETIME,
    "signatureToken" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Response_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "Survey" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Response_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Response" ("answers", "createdAt", "id", "memberId", "submittedAt", "surveyId", "token") SELECT "answers", "createdAt", "id", "memberId", "submittedAt", "surveyId", "token" FROM "Response";
DROP TABLE "Response";
ALTER TABLE "new_Response" RENAME TO "Response";
CREATE UNIQUE INDEX "Response_token_key" ON "Response"("token");
CREATE UNIQUE INDEX "Response_signatureToken_key" ON "Response"("signatureToken");
CREATE UNIQUE INDEX "Response_surveyId_memberId_key" ON "Response"("surveyId", "memberId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
