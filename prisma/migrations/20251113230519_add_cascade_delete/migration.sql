-- CreateTable
CREATE TABLE "Admin" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT,
    "role" TEXT NOT NULL DEFAULT 'FULL',
    "twoFactor" BOOLEAN NOT NULL DEFAULT false,
    "secret2FA" TEXT,
    "invitedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Admin_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "Admin" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MemberList" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Member" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lot" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "address" TEXT
);

-- CreateTable
CREATE TABLE "Survey" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "opensAt" DATETIME NOT NULL,
    "closesAt" DATETIME NOT NULL,
    "memberListId" TEXT NOT NULL,
    "showLive" BOOLEAN NOT NULL DEFAULT false,
    "showAfterClose" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Survey_memberListId_fkey" FOREIGN KEY ("memberListId") REFERENCES "MemberList" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "surveyId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "options" TEXT,
    "order" INTEGER NOT NULL,
    CONSTRAINT "Question_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "Survey" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Response" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "surveyId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "answers" TEXT NOT NULL,
    "submittedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Response_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "Survey" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Response_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Reminder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "surveyId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "sentAt" DATETIME NOT NULL,
    "reminderNum" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "_MemberListsOnMembers" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_MemberListsOnMembers_A_fkey" FOREIGN KEY ("A") REFERENCES "Member" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_MemberListsOnMembers_B_fkey" FOREIGN KEY ("B") REFERENCES "MemberList" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Admin_email_key" ON "Admin"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Response_token_key" ON "Response"("token");

-- CreateIndex
CREATE UNIQUE INDEX "Response_surveyId_memberId_key" ON "Response"("surveyId", "memberId");

-- CreateIndex
CREATE UNIQUE INDEX "_MemberListsOnMembers_AB_unique" ON "_MemberListsOnMembers"("A", "B");

-- CreateIndex
CREATE INDEX "_MemberListsOnMembers_B_index" ON "_MemberListsOnMembers"("B");
