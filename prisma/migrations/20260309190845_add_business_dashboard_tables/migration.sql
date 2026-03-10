-- CreateEnum
CREATE TYPE "FinancialMetricType" AS ENUM ('GROSS_PROFIT', 'REVENUE', 'NET_PROFIT');

-- CreateEnum
CREATE TYPE "FinancialPeriod" AS ENUM ('MONTH', 'YEAR');

-- CreateEnum
CREATE TYPE "ActionCategory" AS ENUM ('FINANCE', 'OPERATIONS', 'SALES_MARKETING', 'PEOPLE');

-- CreateEnum
CREATE TYPE "ActionStatus" AS ENUM ('PENDING', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ToolButtonType" AS ENUM ('DOWNLOAD', 'COMPLETE');

-- CreateEnum
CREATE TYPE "ToolStatus" AS ENUM ('COMPLETE', 'INCOMPLETE');

-- CreateTable
CREATE TABLE "FinancialMetric" (
    "id" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,
    "type" "FinancialMetricType" NOT NULL,
    "period" "FinancialPeriod" NOT NULL,
    "value" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "recordedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashFlow" (
    "id" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "includesVat" BOOLEAN NOT NULL DEFAULT true,
    "recordedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashFlow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductivityRecord" (
    "id" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,
    "percentage" DOUBLE PRECISION NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductivityRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NinetyDayAction" (
    "id" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,
    "category" "ActionCategory" NOT NULL,
    "description" TEXT NOT NULL,
    "targetDate" TIMESTAMP(3) NOT NULL,
    "status" "ActionStatus" NOT NULL DEFAULT 'PENDING',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NinetyDayAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActionTool" (
    "id" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "status" "ToolStatus" NOT NULL DEFAULT 'INCOMPLETE',
    "buttonType" "ToolButtonType" NOT NULL DEFAULT 'COMPLETE',
    "fileUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActionTool_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FinancialMetric_userEmail_idx" ON "FinancialMetric"("userEmail");

-- CreateIndex
CREATE INDEX "CashFlow_userEmail_idx" ON "CashFlow"("userEmail");

-- CreateIndex
CREATE INDEX "ProductivityRecord_userEmail_idx" ON "ProductivityRecord"("userEmail");

-- CreateIndex
CREATE INDEX "NinetyDayAction_userEmail_idx" ON "NinetyDayAction"("userEmail");

-- CreateIndex
CREATE INDEX "ActionTool_userEmail_idx" ON "ActionTool"("userEmail");

-- AddForeignKey
ALTER TABLE "FinancialMetric" ADD CONSTRAINT "FinancialMetric_userEmail_fkey" FOREIGN KEY ("userEmail") REFERENCES "User"("email") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashFlow" ADD CONSTRAINT "CashFlow_userEmail_fkey" FOREIGN KEY ("userEmail") REFERENCES "User"("email") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductivityRecord" ADD CONSTRAINT "ProductivityRecord_userEmail_fkey" FOREIGN KEY ("userEmail") REFERENCES "User"("email") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NinetyDayAction" ADD CONSTRAINT "NinetyDayAction_userEmail_fkey" FOREIGN KEY ("userEmail") REFERENCES "User"("email") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionTool" ADD CONSTRAINT "ActionTool_userEmail_fkey" FOREIGN KEY ("userEmail") REFERENCES "User"("email") ON DELETE RESTRICT ON UPDATE CASCADE;
