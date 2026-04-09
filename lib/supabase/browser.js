import { createClient } from "@supabase/supabase-js";
import { requireEnv } from "../env";

export function createBrowserSupabaseClient() {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = requireEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY");
  return createClient(url, key);
}

