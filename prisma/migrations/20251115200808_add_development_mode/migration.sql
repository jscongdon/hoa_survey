-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SystemConfig" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'system',
    "setupCompleted" BOOLEAN NOT NULL DEFAULT false,
    "developmentMode" BOOLEAN NOT NULL DEFAULT true,
    "hoaName" TEXT,
    "hoaLogoUrl" TEXT,
    "smtpHost" TEXT,
    "smtpPort" INTEGER,
    "smtpUser" TEXT,
    "smtpPass" TEXT,
    "smtpFrom" TEXT,
    "appUrl" TEXT,
    "jwtSecret" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_SystemConfig" ("appUrl", "createdAt", "hoaLogoUrl", "hoaName", "id", "jwtSecret", "setupCompleted", "smtpFrom", "smtpHost", "smtpPass", "smtpPort", "smtpUser", "updatedAt") SELECT "appUrl", "createdAt", "hoaLogoUrl", "hoaName", "id", "jwtSecret", "setupCompleted", "smtpFrom", "smtpHost", "smtpPass", "smtpPort", "smtpUser", "updatedAt" FROM "SystemConfig";
DROP TABLE "SystemConfig";
ALTER TABLE "new_SystemConfig" RENAME TO "SystemConfig";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
