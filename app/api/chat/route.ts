import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

type NutritionJson = {
  foods: Array<{
    name: string;
    amount?: string;
    kcal: number;
    p: number;
    f: number;
    c: number;
  }>;
  total: { kcal: number; p: number; f: number; c: number };
  notes?: string;
};

function extractTextFromGeminiResponse(result: {
  response: {
    text: () => string;
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
      finishReason?: string;
    }>;
    promptFeedback?: { blockReason?: string };
  };
}): string {
  try {
    const t = result.response.text();
    if (t?.trim()) return t;
  } catch {
    // ブロックや候補なしのとき text() が throw することがある
  }

  const block = result.response.promptFeedback?.blockReason;
  if (block) {
    return `安全性フィルタにより応答できませんでした（理由: ${block}）。別の言い方で試してください。`;
  }

  const parts = result.response.candidates?.[0]?.content?.parts;
  const joined = parts?.map((p) => p.text ?? "").join("") ?? "";
  if (joined.trim()) return joined;

  const finish = result.response.candidates?.[0]?.finishReason;
  if (finish && finish !== "STOP") {
    return `回答を生成できませんでした（finishReason: ${finish}）。`;
  }

  return "回答を生成できませんでした。";
}

function formatUnknownError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return String(error);
}

function getUpstreamStatus(error: unknown): number | null {
  if (!error || typeof error !== "object") return null;
  const anyErr = error as { status?: unknown; cause?: unknown };
  if (typeof anyErr.status === "number") return anyErr.status;
  if (anyErr.cause && typeof anyErr.cause === "object") {
    const c = anyErr.cause as { status?: unknown };
    if (typeof c.status === "number") return c.status;
  }
  return null;
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

function tryParseNutritionJson(text: string): NutritionJson | null {
  const trimmed = text.trim();

  // まずは丸ごと JSON としてパース
  try {
    const obj = JSON.parse(trimmed) as NutritionJson;
    if (obj && typeof obj === "object" && "total" in obj && "foods" in obj) return obj;
  } catch {
    // ignore
  }

  // 余計な前後文が混じったときの救済（最初の { 〜 最後の }）
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    const sliced = trimmed.slice(start, end + 1);
    try {
      const obj = JSON.parse(sliced) as NutritionJson;
      if (obj && typeof obj === "object" && "total" in obj && "foods" in obj) return obj;
    } catch {
      // ignore
    }
  }

  return null;
}

export async function POST(request: NextRequest) {
  const isDev = process.env.NODE_ENV === "development";

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "GEMINI_API_KEY が設定されていません。プロジェクト直下の .env に GEMINI_API_KEY を書き、next dev を再起動してください。",
        },
        { status: 503 }
      );
    }

    const { message } = await request.json();

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "メッセージが必要です" },
        { status: 400 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
    });

    const prompt = [
      "あなたは栄養士のアシスタントです。",
      "ユーザーの食事内容からカロリーとPFC（タンパク質/脂質/炭水化物）を推定し、次のJSONのみを返してください（説明文やMarkdownは禁止）。",
      "",
      "必ず次の形にしてください:",
      "{",
      '  "foods": [',
      '    { "name": "食品名", "amount": "量(任意)", "kcal": 0, "p": 0, "f": 0, "c": 0 }',
      "  ],",
      '  "total": { "kcal": 0, "p": 0, "f": 0, "c": 0 },',
      '  "notes": "推定の前提や追加質問(任意)"',
      "}",
      "",
      "数値は概算でよいが、必ず number（文字列禁止）。単位は p/f/c は g、kcal は kcal。",
      "",
      "ユーザー入力:",
      message,
    ].join("\n");

    // 503(高負荷) は一時的なことが多いので少しだけリトライする
    const attempts = 3;
    let lastError: unknown = null;
    let result:
      | Awaited<ReturnType<typeof model.generateContent>>
      | null = null;

    for (let i = 0; i < attempts; i++) {
      try {
        result = await model.generateContent({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json" },
        });
        break;
      } catch (e) {
        lastError = e;
        const status = getUpstreamStatus(e);
        if (status === 503 && i < attempts - 1) {
          await sleep(300 * (i + 1));
          continue;
        }
        throw e;
      }
    }

    if (!result) {
      const details = formatUnknownError(lastError);
      return NextResponse.json(
        {
          error: "AIが混雑していて応答できませんでした。少し待って再試行してください。",
          ...(isDev ? { details } : {}),
        },
        { status: 503, headers: { "Retry-After": "5" } }
      );
    }

    const raw = extractTextFromGeminiResponse(result);
    const json = tryParseNutritionJson(raw);

    if (!json) {
      return NextResponse.json(
        {
          error: "JSONの生成に失敗しました（出力がJSONになっていません）",
          ...(isDev ? { raw } : {}),
        },
        { status: 502 }
      );
    }

    return NextResponse.json({ json });
  } catch (error) {
    console.error("Gemini API error:", error);
    const details = formatUnknownError(error);
    const status = getUpstreamStatus(error);
    if (status === 503) {
      return NextResponse.json(
        {
          error:
            "Gemini が混雑しています（503）。少し待ってからもう一度送信してください。",
          ...(isDev ? { details } : {}),
        },
        { status: 503, headers: { "Retry-After": "5" } }
      );
    }

    return NextResponse.json(
      {
        error: "AIからの応答取得に失敗しました",
        ...(isDev ? { details } : {}),
      },
      { status: 500 }
    );
  }
}



