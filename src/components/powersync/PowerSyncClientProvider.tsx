"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PowerSyncProvider } from "@/lib/powersync/PowerSyncProvider";

export function PowerSyncClientProvider({ children }: { children: React.ReactNode }) {
  const [hasSession, setHasSession] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setHasSession(!!session);
      setLoading(false);
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setHasSession(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return <>{children}</>;
  }

  if (!hasSession) {
    return <>{children}</>;
  }

  return <PowerSyncProvider>{children}</PowerSyncProvider>;
}