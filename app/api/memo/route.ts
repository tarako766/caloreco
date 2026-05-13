import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { coerceNutrition } from "@/lib/mealNutrition";

function dbUnavailableMessage(error: unknown): string | null {
  const msg = error instanceof Error ? error.message : String(error);
  if (
    msg.includes("Can't reach database server") ||
    msg.includes("ECONNREFUSED") ||
    msg.includes("P1001")
  ) {
    return "PostgreSQL に接続できません。Docker Desktop を起動し、`docker compose up -d db` のあと `npx prisma migrate deploy`（または `migrate dev`）を実行してください。";
  }
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2021"
  ) {
    return "DB にテーブルがありません（マイグレーション未適用の可能性）。`DATABASE_URL` が指す PostgreSQL に `npx prisma migrate deploy` を実行してスキーマを作成してください。";
  }
  return null;
}

export async function GET() {
  try {
    const logs = await prisma.mealLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
    });

    return NextResponse.json({ logs });
  } catch (error) {
    console.error("memo GET error:", error);
    const hint = dbUnavailableMessage(error);
    return NextResponse.json(
      {
        error: hint ?? "一覧の取得に失敗しました",
        logs: [],
      },
      { status: hint ? 503 : 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawInput = body?.rawInput;
    const result = body?.result;

    if (typeof rawInput !== "string" || !rawInput.trim()) {
      return NextResponse.json({ error: "rawInput が必要です" }, { status: 400 });
    }
    if (typeof result !== "object" || result === null) {
      return NextResponse.json({ error: "result(JSON) が必要です" }, { status: 400 });
    }

    const normalized = coerceNutrition(result);

    const created = await prisma.mealLog.create({
      data: {
        rawInput: rawInput.trim(),
        result: normalized,
        totalKcal: normalized.total.kcal,
        totalP: normalized.total.p,
        totalF: normalized.total.f,
        totalC: normalized.total.c,
      },
    });

    return NextResponse.json({ log: created }, { status: 201 });
  } catch (error) {
    console.error("memo POST error:", error);
    const hint = dbUnavailableMessage(error);
    return NextResponse.json(
      { error: hint ?? "保存に失敗しました" },
      { status: hint ? 503 : 500 }
    );
  }
}

const DELETE_MAX_IDS = 100;

export async function DELETE(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as { ids?: unknown } | null;
    const idsRaw = body?.ids;
    if (!Array.isArray(idsRaw) || idsRaw.length === 0) {
      return NextResponse.json(
        { error: "ids（非空の配列）が必要です。例: { \"ids\": [1, 2, 3] }" },
        { status: 400 }
      );
    }

    const parsed: number[] = [];
    for (const x of idsRaw) {
      if (typeof x !== "number" || !Number.isInteger(x) || x < 1) {
        return NextResponse.json(
          { error: "ids の各要素は 1 以上の整数にしてください" },
          { status: 400 }
        );
      }
      parsed.push(x);
    }

    const unique = [...new Set(parsed)];
    if (unique.length > DELETE_MAX_IDS) {
      return NextResponse.json(
        { error: `一度に削除できるのは最大 ${DELETE_MAX_IDS} 件までです` },
        { status: 400 }
      );
    }

    const result = await prisma.mealLog.deleteMany({
      where: { id: { in: unique } },
    });

    return NextResponse.json({ deleted: result.count });
  } catch (error) {
    console.error("memo DELETE error:", error);
    const hint = dbUnavailableMessage(error);
    return NextResponse.json(
      { error: hint ?? "削除に失敗しました" },
      { status: hint ? 503 : 500 }
    );
  }
}
