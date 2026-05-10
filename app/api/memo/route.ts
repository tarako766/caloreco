import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const logs = await prisma.mealLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  return NextResponse.json({ logs });
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

    const created = await prisma.mealLog.create({
      data: {
        rawInput: rawInput.trim(),
        result,
      },
    });

    return NextResponse.json({ log: created }, { status: 201 });
  } catch (error) {
    console.error("memo POST error:", error);
    return NextResponse.json({ error: "保存に失敗しました" }, { status: 500 });
  }
}

