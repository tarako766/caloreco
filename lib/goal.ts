export const BODY_GOALS = ["lose", "maintain", "gain"] as const;
export type BodyGoal = (typeof BODY_GOALS)[number];

export const ACTIVITY_LEVELS = ["sedentary", "light", "moderate", "active"] as const;
export type ActivityLevel = (typeof ACTIVITY_LEVELS)[number];

export const BODY_GOAL_LABEL: Record<BodyGoal, string> = {
  lose: "減量（脂肪を落とす）",
  maintain: "維持（体型キープ）",
  gain: "増量（筋量アップ）",
};

export const ACTIVITY_LABEL: Record<ActivityLevel, string> = {
  sedentary: "座りがち（運動ほぼなし）",
  light: "軽い活動（週1〜2回の運動）",
  moderate: "中程度（週3〜4回の運動）",
  active: "活発（週5回以上 / 肉体労働）",
};

export function isBodyGoal(v: unknown): v is BodyGoal {
  return typeof v === "string" && (BODY_GOALS as readonly string[]).includes(v);
}

export function isActivityLevel(v: unknown): v is ActivityLevel {
  return typeof v === "string" && (ACTIVITY_LEVELS as readonly string[]).includes(v);
}

export type GoalPlan = {
  targetKcal: number;
  targetProteinG: number;
  targetFatG: number;
  targetCarbsG: number;
  rationale?: string;
};

/** AI 応答を厳しめに型ガードして clamp する */
export function coerceGoalPlan(v: unknown): GoalPlan | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const kcal = Number(o.targetKcal);
  const p = Number(o.targetProteinG);
  const f = Number(o.targetFatG);
  const c = Number(o.targetCarbsG);
  if (![kcal, p, f, c].every((n) => Number.isFinite(n) && n > 0)) return null;
  if (kcal < 800 || kcal > 6000) return null;
  if (p < 10 || p > 500) return null;
  if (f < 5 || f > 300) return null;
  if (c < 10 || c > 1000) return null;
  const rationaleRaw = o.rationale;
  const rationale =
    typeof rationaleRaw === "string" && rationaleRaw.trim()
      ? rationaleRaw.trim()
      : undefined;
  return {
    targetKcal: Math.round(kcal),
    targetProteinG: Math.round(p),
    targetFatG: Math.round(f),
    targetCarbsG: Math.round(c),
    rationale,
  };
}
