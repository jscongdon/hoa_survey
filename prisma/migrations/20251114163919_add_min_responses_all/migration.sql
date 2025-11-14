-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Survey" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "opensAt" DATETIME NOT NULL,
    "closesAt" DATETIME NOT NULL,
    "memberListId" TEXT NOT NULL,
    "showLive" BOOLEAN NOT NULL DEFAULT false,
    "showAfterClose" BOOLEAN NOT NULL DEFAULT true,
    "minResponses" INTEGER,
    "minResponsesAll" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Survey_memberListId_fkey" FOREIGN KEY ("memberListId") REFERENCES "MemberList" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Survey" ("closesAt", "createdAt", "description", "id", "memberListId", "minResponses", "opensAt", "showAfterClose", "showLive", "title") SELECT "closesAt", "createdAt", "description", "id", "memberListId", "minResponses", "opensAt", "showAfterClose", "showLive", "title" FROM "Survey";
DROP TABLE "Survey";
ALTER TABLE "new_Survey" RENAME TO "Survey";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
