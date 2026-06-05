// Dedicated Supabase client for the embedded Ledgerly sub-app.
// Points at the standalone Ledgerly Supabase project and uses an
// isolated localStorage key so it cannot collide with this app's
// main supabase session.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const SUPABASE_URL = "https://kfhebkuesbhztlqlvcux.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmaGVia3Vlc2JoenRscWx2Y3V4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0MTg2MTIsImV4cCI6MjA5MTk5NDYxMn0.PwKQ4xedsu3_KslZchLpA-FEyNsTt-2Kx9Fq-fxTvWY";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
    storageKey: "ledgerly-auth",
    persistSession: true,
    autoRefreshToken: true,
  },
});