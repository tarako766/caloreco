"use client";

import { Fragment, type Dispatch, type SetStateAction } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  coerceNutrition,
  formatFoodsSummary,
  formatFoodItemLine,
} from "@/lib/mealNutrition";
import { formatJstDateLabel, formatJstTime, toJstDateString } from "@/lib/jstDate";

type MealLog = {
  id: number;
  rawInput: string;
  result: unknown;
  createdAt: string;
};

type RowDraft = {
  rawInput: string;
  foodsLine: string;
  kcal: string;
  p: string;
  f: string;
  c: string;
  createdAt: string;
};

const inputClass =
  "w-full rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400";

type MealLogDiaryListProps = {
  logs: MealLog[];
  dbError: string | null;
  selected: Set<number>;
  editing: Set<number>;
  drafts: Record<number, RowDraft>;
  expandedFoodRows: Set<number>;
  allSelected: boolean;
  onToggleSelectAll: () => void;
  onToggleSelect: (id: number) => void;
  onToggleFoodDetail: (id: number) => void;
  onCancelRowEdit: (id: number) => void;
  setDrafts: Dispatch<SetStateAction<Record<number, RowDraft>>>;
};

function groupLogsByJstDate(logs: MealLog[]): Array<{ dateKey: string; logs: MealLog[] }> {
  const map = new Map<string, MealLog[]>();
  for (const log of logs) {
    const key = toJstDateString(log.createdAt);
    const group = map.get(key) ?? [];
    group.push(log);
    map.set(key, group);
  }
  return [...map.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([dateKey, dayLogs]) => ({ dateKey, logs: dayLogs }));
}

function dayTotalKcal(logs: MealLog[]): number {
  return logs.reduce((sum, log) => sum + coerceNutrition(log.result).total.kcal, 0);
}

export function MealLogDiaryList({
  logs,
  dbError,
  selected,
  editing,
  drafts,
  expandedFoodRows,
  allSelected,
  onToggleSelectAll,
  onToggleSelect,
  onToggleFoodDetail,
  onCancelRowEdit,
  setDrafts,
}: MealLogDiaryListProps) {
  if (!logs.length) {
    return (
      <p className="rounded-lg border border-neutral-200 bg-white px-4 py-6 text-sm text-neutral-500">
        {dbError
          ? "上記の手順でDBを起動・マイグレーションすると、ここに記録が表示されます。"
          : "まだ記録がありません。食事を送信し、確認画面から記録してください。"}
      </p>
    );
  }

  const groups = groupLogsByJstDate(logs);

  return (
    <div className="space-y-4">
      <label className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-700">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-neutral-400"
          checked={allSelected}
          onChange={onToggleSelectAll}
          aria-label="すべて選択"
        />
        すべて選択
      </label>

      {groups.map(({ dateKey, logs: dayLogs }) => (
        <section key={dateKey} className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
          <div className="flex items-baseline justify-between gap-2 border-b border-neutral-200 bg-neutral-100 px-3 py-2.5">
            <h3 className="text-sm font-semibold text-neutral-900">{formatJstDateLabel(dateKey)}</h3>
            <span className="shrink-0 text-sm tabular-nums text-neutral-600">
              {dayTotalKcal(dayLogs).toLocaleString()} kcal
            </span>
          </div>

          <ul className="divide-y divide-neutral-200">
            {dayLogs.map((log) => {
              const n = coerceNutrition(log.result);
              const isEditing = editing.has(log.id);
              const draft = drafts[log.id];
              const hasFoods = n.foods.length > 0;
              const detailOpen = expandedFoodRows.has(log.id);
              const isSelected = selected.has(log.id);

              return (
                <Fragment key={log.id}>
                  <li
                    className={cn(
                      "px-3 py-3",
                      isSelected && "bg-sky-50/50",
                      isEditing && "bg-amber-50/60"
                    )}
                  >
                    {isEditing && draft ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <label className="flex items-center gap-2 text-sm text-neutral-600">
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-neutral-400"
                              checked={isSelected}
                              onChange={() => onToggleSelect(log.id)}
                              aria-label={`行 ${log.id} を選択`}
                            />
                            編集中
                          </label>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 text-xs"
                            onClick={() => onCancelRowEdit(log.id)}
                          >
                            取消
                          </Button>
                        </div>
                        <div className="space-y-2">
                          <label className="block text-xs font-medium text-neutral-600">日時</label>
                          <input
                            type="datetime-local"
                            className={inputClass}
                            value={draft.createdAt}
                            onChange={(e) =>
                              setDrafts((prev) => ({
                                ...prev,
                                [log.id]: { ...prev[log.id]!, createdAt: e.target.value },
                              }))
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="block text-xs font-medium text-neutral-600">内容</label>
                          <Textarea
                            rows={3}
                            className="text-sm"
                            value={draft.rawInput}
                            onChange={(e) =>
                              setDrafts((prev) => ({
                                ...prev,
                                [log.id]: { ...prev[log.id]!, rawInput: e.target.value },
                              }))
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="block text-xs font-medium text-neutral-600">内訳（食品）</label>
                          <Textarea
                            rows={2}
                            className="text-sm"
                            value={draft.foodsLine}
                            onChange={(e) =>
                              setDrafts((prev) => ({
                                ...prev,
                                [log.id]: { ...prev[log.id]!, foodsLine: e.target.value },
                              }))
                            }
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                          {(
                            [
                              ["kcal", "カロリー"],
                              ["p", "P"],
                              ["f", "F"],
                              ["c", "C"],
                            ] as const
                          ).map(([key, label]) => (
                            <div key={key} className="space-y-1">
                              <label className="block text-xs font-medium text-neutral-600">{label}</label>
                              <input
                                type="number"
                                inputMode="decimal"
                                className={cn(inputClass, "text-right")}
                                value={draft[key]}
                                onChange={(e) =>
                                  setDrafts((prev) => ({
                                    ...prev,
                                    [log.id]: { ...prev[log.id]!, [key]: e.target.value },
                                  }))
                                }
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start gap-2">
                          <input
                            type="checkbox"
                            className="mt-0.5 h-4 w-4 shrink-0 rounded border-neutral-400"
                            checked={isSelected}
                            onChange={() => onToggleSelect(log.id)}
                            aria-label={`行 ${log.id} を選択`}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <time
                                className="shrink-0 text-sm tabular-nums text-neutral-500"
                                dateTime={log.createdAt}
                              >
                                {formatJstTime(log.createdAt)}
                              </time>
                              <span className="shrink-0 text-sm font-medium tabular-nums text-neutral-900">
                                {n.total.kcal} kcal
                              </span>
                            </div>
                            <p className="mt-1 text-sm leading-snug text-neutral-900">{log.rawInput}</p>
                            {formatFoodsSummary(n) ? (
                              <p className="mt-1 text-xs leading-snug text-neutral-600">
                                {formatFoodsSummary(n)}
                              </p>
                            ) : null}
                            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500">
                              <span>
                                P {n.total.p}g · F {n.total.f}g · C {n.total.c}g
                              </span>
                              {hasFoods ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-xs text-neutral-600"
                                  aria-expanded={detailOpen}
                                  onClick={() => onToggleFoodDetail(log.id)}
                                >
                                  {detailOpen ? "品目を閉じる" : "品目を見る"}
                                </Button>
                              ) : null}
                            </div>
                          </div>
                        </div>
                        {detailOpen && hasFoods ? (
                          <div className="mt-3 rounded-md bg-neutral-50 px-3 py-2">
                            <p className="mb-1.5 text-xs font-semibold text-neutral-600">
                              食品ごとの内訳（AI 推定）
                            </p>
                            <ul className="space-y-1 text-xs leading-relaxed text-neutral-800">
                              {n.foods.map((food, idx) => (
                                <li key={`${log.id}-f-${idx}`} className="font-mono">
                                  {formatFoodItemLine(food)}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                      </>
                    )}
                  </li>
                </Fragment>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
