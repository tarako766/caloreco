import { createClient } from "@supabase/supabase-js";

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} が設定されていません。`);
  }
  return value;
}

/** Browser / client components 用 */
export function createBrowserSupabaseClient() {
  return createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")
  );
}

/** Node.js スクリプト・Route Handler からの接続確認用 */
export function createServerSupabaseClient() {
  return createBrowserSupabaseClient();
}
