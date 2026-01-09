import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json();

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "メッセージが必要です" },
        { status: 400 }
      );
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "あなたは栄養士のアシスタントです。食事に関する質問に答え、カロリーやPFC（タンパク質・脂質・炭水化物）の情報を提供してください。",
        },
        {
          role: "user",
          content: message,
        },
      ],
      max_tokens: 1000,
    });

    const reply = completion.choices[0]?.message?.content || "回答を生成できませんでした";

    return NextResponse.json({ reply });
  } catch (error) {
    console.error("OpenAI API error:", error);
    return NextResponse.json(
      { error: "AIからの応答取得に失敗しました" },
      { status: 500 }
    );
  }
}



