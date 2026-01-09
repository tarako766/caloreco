"use client";

import { useState } from "react";

export default function Home() {
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    if (!message.trim()) return;

    setIsLoading(true);
    setReply("");

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
        setReply(data.reply);
      } else {
        setReply(`エラー: ${data.error}`);
      }
    } catch (error) {
      setReply("通信エラーが発生しました");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white p-6">
      {/* 入力部分 */}
      <div className="max-w-2xl mx-auto mb-8">
        <h1 className="text-3xl font-bold text-blue-600 mb-4">AI 食事記録</h1>
        <textarea
          className="w-full p-4 border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 shadow-sm"
          rows={3}
          placeholder="ここに食事内容や質問を入力"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <button
          onClick={handleSubmit}
          disabled={isLoading || !message.trim()}
          className="mt-3 bg-blue-500 text-white px-6 py-2 rounded-lg shadow hover:bg-blue-600 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {isLoading ? "送信中..." : "送信"}
        </button>

        {/* AIの回答表示 */}
        {reply && (
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="text-lg font-semibold text-blue-600 mb-2">AIの回答</h3>
            <p className="text-gray-700 whitespace-pre-wrap">{reply}</p>
          </div>
        )}
      </div>

      {/* 1ヶ月分のカロリー・PFCテーブル */}
      <div className="max-w-5xl mx-auto">
        <h2 className="text-2xl font-semibold text-blue-600 mb-4">1ヶ月の記録</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse shadow-lg rounded-lg overflow-hidden">
            <thead className="bg-blue-500 text-white">
              <tr>
                <th className="px-6 py-3 text-left font-medium">日付</th>
                <th className="px-6 py-3 text-right font-medium">カロリー</th>
                <th className="px-6 py-3 text-right font-medium">タンパク質</th>
                <th className="px-6 py-3 text-right font-medium">脂質</th>
                <th className="px-6 py-3 text-right font-medium">炭水化物</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 30 }).map((_, idx) => (
                <tr
                  key={idx}
                  className="text-center even:bg-blue-50 hover:bg-blue-100 transition-colors"
                >
                  <td className="px-6 py-3 border-b">{idx + 1}日</td>
                  <td className="px-6 py-3 border-b text-right">2000 kcal</td>
                  <td className="px-6 py-3 border-b text-right">100 g</td>
                  <td className="px-6 py-3 border-b text-right">70 g</td>
                  <td className="px-6 py-3 border-b text-right">250 g</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
