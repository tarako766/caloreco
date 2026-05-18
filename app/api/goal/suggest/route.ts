import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  ACTIVITY_LABEL,
  BODY_GOAL_LABEL,
  coerceGoalPlan,
  isActivityLevel,
  isBodyGoal,
  type ActivityLevel,
  type BodyGoal,
  type GoalPlan,
} from "@/lib/goal";

type SuggestInput = {
  targetWeightKg: number;
  bodyGoal: BodyGoal;
  activityLevel: ActivityLevel;
  note?: string;
};

function parseInput(body: unknown): { ok: true; value: SuggestInput } | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "リクエストボディが不正です。" };
  }
  const o = body as Record<string, unknown>;

  const targetWeightKg = Number(o.targetWeightKg);
  if (!Number.isFinite(targetWeightKg) || targetWeightKg < 25 || targetWeightKg > 250) {
    return { ok: false, error: "目標体重は 25〜250 kg の範囲で入力してください。" };
  }
  if (!isBodyGoal(o.bodyGoal)) {
    return { ok: false, error: "目指す体型を選択してください。" };
  }
  if (!isActivityLevel(o.activityLevel)) {
    return { ok: false, error: "活動量を選択してください。" };
  }
  const note = typeof o.note === "string" ? o.note.trim().slice(0, 400) : undefined;

  return {
    ok: true,
    value: {
      targetWeightKg,
      bodyGoal: o.bodyGoal,
      activityLevel: o.activityLevel,
      note: note || undefined,
    },
  };
}

function genderLabel(g: string): string {
  if (g === "male") return "男性";
  if (g === "female") return "女性";
  if (g === "other") return "その他";
  return "未回答";
}

function buildPrompt(args: {
  age: number;
  gender: string;
  heightCm: number;
  weightKg: number;
  input: SuggestInput;
}): string {
  const { age, gender, heightCm, weightKg, input } = args;
  return [
    "あなたはスポーツ栄養士です。以下のユーザーに、1 日あたりの推奨摂取カロリー(kcal)と PFC バランス(g) を提案してください。",
    "",
    "計算手順（必ずこの順序で内部的に行うこと、最終出力は JSON のみ）:",
    "1. Mifflin-St Jeor 式で BMR を算出する（性別 unspecified の場合は男女平均を使う）。",
    "2. 活動係数を掛けて TDEE を求める。係数: sedentary=1.2, light=1.375, moderate=1.55, active=1.725。",
    "3. 目標タイプに応じて目標摂取カロリーを決める:",
    "   - lose: TDEE から 300〜500 kcal 引く（極端な減量はしない）。",
    "   - maintain: TDEE と同等。",
    "   - gain: TDEE に 250〜400 kcal 足す。",
    "4. PFC を以下の目安で配分する（合計 kcal にほぼ一致させる, 1g=P:4 / F:9 / C:4 kcal）:",
    "   - lose: タンパク質 = 目標体重 × 2.0g、脂質 = 総 kcal の 25%、残りを炭水化物。",
    "   - maintain: タンパク質 = 目標体重 × 1.6g、脂質 = 総 kcal の 25〜30%、残りを炭水化物。",
    "   - gain: タンパク質 = 目標体重 × 1.8g、脂質 = 総 kcal の 25%、残りを炭水化物。",
    "5. すべて整数 g / 整数 kcal に丸める。",
    "",
    "ユーザー情報:",
    `- 性別: ${genderLabel(gender)}`,
    `- 年齢: ${age} 歳`,
    `- 身長: ${heightCm} cm`,
    `- 現在の体重: ${weightKg} kg`,
    `- 目標体重: ${input.targetWeightKg} kg`,
    `- 目指す体型: ${BODY_GOAL_LABEL[input.bodyGoal]}（${input.bodyGoal}）`,
    `- 活動量: ${ACTIVITY_LABEL[input.activityLevel]}（${input.activityLevel}）`,
    input.note ? `- 補足: ${input.note}` : "",
    "",
    "出力フォーマット（このキーのみ・Markdown禁止・コードフェンス禁止）:",
    "{",
    '  "assistantMessage": "ユーザー向けの説明。日本語 2〜4 文。なぜこの数字なのかを簡潔に。",',
    '  "plan": {',
    '    "targetKcal": 数値(kcal),',
    '    "targetProteinG": 数値(g),',
    '    "targetFatG": 数値(g),',
    '    "targetCarbsG": 数値(g),',
    '    "rationale": "計算根拠の要約 (1〜2 文)"',
    "  }",
    "}",
  ]
    .filter(Boolean)
    .join("\n");
}

function extractText(result: {
  response: { text: () => string; candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
}): string {
  try {
    const t = result.response.text();
    if (t?.trim()) return t;
  } catch {
    /* fallthrough */
  }
  const parts = result.response.candidates?.[0]?.content?.parts;
  return parts?.map((p) => p.text ?? "").join("") ?? "";
}

function tryParseSuggestion(raw: string): { assistantMessage: string; plan: GoalPlan } | null {
  const trimmed = raw.trim();
  let obj: unknown;
  try {
    obj = JSON.parse(trimmed);
  } catch {
    obj = null;
  }
  if (obj === null) {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        obj = JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        obj = null;
      }
    }
  }
  if (!obj || typeof obj !== "object") return null;
  const o = obj as Record<string, unknown>;
  const plan = coerceGoalPlan(o.plan);
  if (!plan) return null;
  const am = o.assistantMessage;
  const assistantMessage =
    typeof am === "string" && am.trim()
      ? am.trim()
      : "目標体重・体型から、推奨の 1 日カロリーと PFC を算出しました。内容を確認して保存してください。";
  return { assistantMessage, plan };
}

export async function POST(req: NextRequest) {
  const isDev = process.env.NODE_ENV === "development";

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY が設定されていません。" },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON ボディの解析に失敗しました。" }, { status: 400 });
  }

  const parsed = parseInput(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { age: true, gender: true, heightCm: true, weightKg: true },
  });
  if (!user) {
    return NextResponse.json({ error: "ユーザーが見つかりません" }, { status: 404 });
  }

  const prompt = buildPrompt({
    age: user.age,
    gender: user.gender,
    heightCm: user.heightCm,
    weightKg: user.weightKg,
    input: parsed.value,
  });

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json" },
    });

    const raw = extractText(result);
    const parsedResult = tryParseSuggestion(raw);
    if (!parsedResult) {
      return NextResponse.json(
        {
          error: "AI からの提案を解析できませんでした。もう一度お試しください。",
          ...(isDev ? { raw } : {}),
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      assistantMessage: parsedResult.assistantMessage,
      plan: parsedResult.plan,
      input: parsed.value,
    });
  } catch (error) {
    console.error("goal suggest error:", error);
    const details = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        error: "AI からの応答取得に失敗しました。",
        ...(isDev ? { details } : {}),
      },
      { status: 500 }
    );
  }
}
