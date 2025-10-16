import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

export const useAnalytics = () => {
  const trackEvent = async (
    eventType: string,
    eventData?: Record<string, any>
  ) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      await supabase.from("analytics_events").insert({
        user_id: user?.id || null,
        event_type: eventType,
        event_data: eventData,
        page_url: window.location.href,
        user_agent: navigator.userAgent,
      });
    } catch (error) {
      console.error("Analytics tracking error:", error);
    }
  };

  return { trackEvent };
};

export const usePageView = (pageName: string) => {
  const { trackEvent } = useAnalytics();

  useEffect(() => {
    trackEvent("page_view", { page: pageName });
  }, [pageName]);
};
