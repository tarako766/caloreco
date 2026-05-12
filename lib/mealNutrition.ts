export type NutritionJson = {
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

/** DBやAIの揺れを吸収して、表表示・保存用に揃える */
export function coerceNutrition(result: unknown): NutritionJson {
  const emptyTotal = { kcal: 0, p: 0, f: 0, c: 0 };
  if (!result || typeof result !== "object") {
    return { foods: [], total: emptyTotal };
  }
  const obj = result as Record<string, unknown>;

  const totalSrc = obj.total;
  const total =
    totalSrc && typeof totalSrc === "object"
      ? {
          kcal: Number((totalSrc as Record<string, unknown>).kcal) || 0,
          p: Number((totalSrc as Record<string, unknown>).p) || 0,
          f: Number((totalSrc as Record<string, unknown>).f) || 0,
          c: Number((totalSrc as Record<string, unknown>).c) || 0,
        }
      : emptyTotal;

  const foodsRaw = Array.isArray(obj.foods) ? obj.foods : [];
  const foods = foodsRaw.map((item) => {
    if (!item || typeof item !== "object") {
      return { name: "?", kcal: 0, p: 0, f: 0, c: 0 };
    }
    const row = item as Record<string, unknown>;
    const amount = row.amount;
    return {
      name: String(row.name ?? "?"),
      amount: amount === undefined || amount === null ? undefined : String(amount),
      kcal: Number(row.kcal) || 0,
      p: Number(row.p) || 0,
      f: Number(row.f) || 0,
      c: Number(row.c) || 0,
    };
  });

  const notes = obj.notes;
  return {
    foods,
    total,
    notes: typeof notes === "string" && notes.trim() ? notes : undefined,
  };
}

export function formatFoodsSummary(n: NutritionJson): string {
  if (!n.foods.length) return "—";
  return n.foods
    .map((food) => {
      const amt = food.amount ? ` (${food.amount})` : "";
      return `${food.name}${amt}`;
    })
    .join(" · ");
}