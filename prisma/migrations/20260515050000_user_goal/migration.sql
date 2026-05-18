-- AlterTable: 目標体重・体型・活動量を保存するカラムを追加
ALTER TABLE "User"
  ADD COLUMN "targetWeightKg" DOUBLE PRECISION,
  ADD COLUMN "bodyGoal" TEXT,
  ADD COLUMN "activityLevel" TEXT;
