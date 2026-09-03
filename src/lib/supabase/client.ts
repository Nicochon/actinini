"use client";

import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "@/lib/database.types";
import { supabaseEnv } from "@/lib/supabase/env";

/** Client Supabase côté navigateur (composants client uniquement). */
export function createClient() {
  const { url, key } = supabaseEnv();

  return createBrowserClient<Database>(
    url,
    key,
  );
}
