import { NextRequest, NextResponse } from "next/server";
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

