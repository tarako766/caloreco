import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { coerceGoalPlan, isActivityLevel, isBodyGoal } from "@/lib/goal";

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON ボディの解析に失敗しました。" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "リクエストボディが不正です。" }, { status: 400 });
  }
  const o = body as Record<string, unknown>;

  const targetWeightKg = Number(o.targetWeightKg);
  if (!Number.isFinite(targetWeightKg) || targetWeightKg < 25 || targetWeightKg > 250) {
    return NextResponse.json(
      { error: "目標体重は 25〜250 kg の範囲で入力してください。" },
      { status: 400 }
    );
  }
  if (!isBodyGoal(o.bodyGoal)) {
    return NextResponse.json({ error: "目指す体型が不正です。" }, { status: 400 });
  }
  if (!isActivityLevel(o.activityLevel)) {
    return NextResponse.json({ error: "活動量が不正です。" }, { status: 400 });
  }
  const plan = coerceGoalPlan(o.plan);
  if (!plan) {
    return NextResponse.json(
      { error: "PFC プラン（kcal / P / F / C）が不正です。" },
      { status: 400 }
    );
  }

  try {
    const updated = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        targetWeightKg,
        bodyGoal: o.bodyGoal,
        activityLevel: o.activityLevel,
        targetKcal: plan.targetKcal,
        targetProteinG: plan.targetProteinG,
        targetFatG: plan.targetFatG,
        targetCarbsG: plan.targetCarbsG,
        pfcSetAt: new Date(),
      },
      select: {
        targetWeightKg: true,
        bodyGoal: true,
        activityLevel: true,
        targetKcal: true,
        targetProteinG: true,
        targetFatG: true,
        targetCarbsG: true,
        pfcSetAt: true,
      },
    });

    return NextResponse.json({ user: updated });
  } catch (error) {
    console.error("goal save error:", error);
    return NextResponse.json({ error: "目標の保存に失敗しました。" }, { status: 500 });
  }
}
