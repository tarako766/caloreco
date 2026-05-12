"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  coerceNutrition,
  formatFoodsSummary,
  type NutritionJson,
} from "@/lib/mealNutrition";

type MealLog = {
  id: number;
  rawInput: string;
  /** Prisma Json として返るため unknown */
  result: unknown;
  createdAt: string;
};

export default function Home() {
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [logs, setLogs] = useState<MealLog[]>([]);
  const [dbError, setDbError] = useState<string | null>(null);
  const [saveHint, setSaveHint] = useState<string | null>(null);

  const refreshLogs = useCallback(async () => {
    try {
      const res = await fetch("/api/memo", { cache: "no-store" });
      const data = (await res.json()) as { logs?: MealLog[]; error?: string };

      if (res.ok && Array.isArray(data.logs)) {
        setLogs(data.logs);
        setDbError(null);
        return;
      }

      setDbError(
        typeof data.error === "string"
          ? data.error
          : "記録一覧を読み込めませんでした。"
      );
      if (Array.isArray(data.logs)) setLogs(data.logs);
    } catch {
      setDbError("記録一覧の通信に失敗しました。");
    }
  }, []);

  useEffect(() => {
    void refreshLogs();
  }, [refreshLogs]);

  const handleSubmit = async () => {
    if (!message.trim()) return;

    setIsLoading(true);
    setReply("");
    setSaveHint(null);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message }),
      });

      const data = await response.json();

      if (response.ok) {
        const json = data.json as NutritionJson;
        setReply(JSON.stringify(json, null, 2));

        const memoRes = await fetch("/api/memo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rawInput: message, result: json }),
        });
        const memoData = (await memoRes.json()) as { error?: string };
        if (!memoRes.ok) {
          setSaveHint(null);
          setDbError(
            typeof memoData.error === "string"
              ? memoData.error
              : "DBへの保存に失敗しました。"
          );
        } else {
          setDbError(null);
          setSaveHint("記録テーブルに保存しました。");
        }

        await refreshLogs();
      } else {
        const detail =
          typeof data.details === "string" && data.details
            ? `\n\n（詳細）\n${data.details}`
            : "";
        const raw =
          typeof data.raw === "string" && data.raw ? `\n\n（raw）\n${data.raw}` : "";
        setReply(`エラー: ${data.error}${detail}${raw}`);
      }
    } catch {
      setReply("通信エラーが発生しました");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 p-6">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">
            Calreco
          </h1>
          <p className="mt-2 text-sm text-neutral-600">
            Gemini 2.5 Flash に食事内容を投げて、カロリー/PFCの推定を返します。
          </p>
        </div>

        {dbError ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            {dbError}
          </div>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>AI 食事記録</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              rows={4}
              placeholder="例: さば味噌定食（ご飯大盛り）を食べました。カロリーとPFCを推定して。"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            <div className="flex items-center gap-3">
              <Button onClick={handleSubmit} disabled={isLoading || !message.trim()}>
                {isLoading ? "送信中..." : "送信"}
              </Button>
              <span className="text-xs text-neutral-500">
                API: <code className="rounded bg-neutral-100 px-1 py-0.5">/api/chat</code>
              </span>
            </div>

            {reply && (
              <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4">
                <h3 className="text-sm font-semibold text-neutral-900">AIの回答</h3>
                <pre className="mt-2 whitespace-pre-wrap text-sm text-neutral-700">
                  {reply}
                </pre>
                {saveHint ? (
                  <p className="mt-2 text-sm font-medium text-emerald-700">{saveHint}</p>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle>記録（最新30件）</CardTitle>
              <Button variant="secondary" onClick={refreshLogs} disabled={isLoading}>
                再読み込み
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse overflow-hidden rounded-lg border border-neutral-200 bg-white">
                <thead className="bg-neutral-900 text-white">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-medium">日時</th>
                    <th className="px-6 py-3 text-left text-sm font-medium">内容</th>
                    <th className="px-6 py-3 text-left text-sm font-medium">内訳（食品）</th>
                    <th className="px-6 py-3 text-right text-sm font-medium">
                      カロリー
                    </th>
                    <th className="px-6 py-3 text-right text-sm font-medium">
                      タンパク質
                    </th>
                    <th className="px-6 py-3 text-right text-sm font-medium">脂質</th>
                    <th className="px-6 py-3 text-right text-sm font-medium">
                      炭水化物
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => {
                    const n = coerceNutrition(log.result);
                    return (
                    <tr
                      key={log.id}
                      className="text-center even:bg-neutral-50 hover:bg-neutral-100"
                    >
                      <td className="border-b border-neutral-200 px-6 py-3 text-left text-sm whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="border-b border-neutral-200 px-6 py-3 text-left text-sm max-w-[200px]">
                        <span className="line-clamp-2">{log.rawInput}</span>
                      </td>
                      <td className="border-b border-neutral-200 px-6 py-3 text-left text-sm max-w-xs">
                        <span className="line-clamp-2 text-neutral-700">
                          {formatFoodsSummary(n)}
                        </span>
                      </td>
                      <td className="border-b border-neutral-200 px-6 py-3 text-right text-sm">
                        {n.total.kcal} kcal
                      </td>
                      <td className="border-b border-neutral-200 px-6 py-3 text-right text-sm">
                        {n.total.p} g
                      </td>
                      <td className="border-b border-neutral-200 px-6 py-3 text-right text-sm">
                        {n.total.f} g
                      </td>
                      <td className="border-b border-neutral-200 px-6 py-3 text-right text-sm">
                        {n.total.c} g
                      </td>
                    </tr>
                    );
                  })}
                  {!logs.length && (
                    <tr>
                      <td
                        colSpan={7}
                        className="border-b border-neutral-200 px-6 py-6 text-left text-sm text-neutral-500"
                      >
                        {dbError
                          ? "上記の手順でDBを起動・マイグレーションすると、ここに記録が表示されます。"
                          : "まだ記録がありません。上のフォームから送信すると自動で保存されます。"}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
	);
}
