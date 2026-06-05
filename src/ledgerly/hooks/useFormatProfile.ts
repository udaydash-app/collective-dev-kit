import { useEffect } from "react";
import { supabase } from "@/ledgerly/integrations/supabase/client";
import { useAuth } from "@/ledgerly/contexts/AuthContext";
import { setFormatSettings } from "@/ledgerly/lib/format";

/**
 * Loads the user's profile once and primes the global format settings
 * so formatMoney/formatNumber render in the user's currency & locale.
 *
 * Also listens for realtime updates on the profile row so changes made
 * in Settings are reflected app-wide without a reload.
 */
export const useFormatProfile = () => {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("currency_symbol, currency_position, number_format, decimal_places, base_currency, date_format")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled || !data) return;
      setFormatSettings(data as any);
    })();

    const channel = supabase
      .channel(`profile-format-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles", filter: `user_id=eq.${user.id}` },
        (payload) => {
          if (payload.new) setFormatSettings(payload.new as any);
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [user]);
};
