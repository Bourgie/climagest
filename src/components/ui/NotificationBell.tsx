"use client";

import { useState, useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Bell, BellOff, X, Loader2 } from "lucide-react";

export function NotificationBell() {
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState<Array<{
    id: string;
    type: string;
    title: string;
    body: string | null;
    is_read: boolean;
    created_at: string;
    related_table: string | null;
    related_id: string | null;
  }>>([]);
  const [loading, setLoading] = useState(true);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  async function fetch() {
    const { data } = await supabase
      .from("notifications")
      .select("id,type,title,body,is_read,created_at,related_table,related_id")
      .is("recipient_user_id", null)
      .or("target_role.is.null,target_role.eq.(SELECT role FROM memberships WHERE user_id = auth.uid() AND status = 'active' LIMIT 1)")
      .order("created_at", { ascending: false })
      .limit(20);
    if (data) {
      setNotifs(data);
      setCount(data.filter((n) => !n.is_read).length);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetch();
    const ch = supabase
      .channel("notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        () => fetch(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [supabase]);

  async function markRead(id: string) {
    const { error } = await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    if (!error) {
      setNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
      setCount((c) => Math.max(0, c - 1));
    }
  }

  async function markAllRead() {
    const unread = notifs.filter((n) => !n.is_read).map((n) => n.id);
    if (!unread.length) return;
    await supabase.from("notifications").update({ is_read: true }).in("id", unread);
    setNotifs((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setCount(0);
  }

  if (loading) return <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative rounded-md p-2 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
        aria-label={count > 0 ? `${count} notificaciones` : "Notificaciones"}
      >
        {count > 0 ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
        {count > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-semibold text-white">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-md border border-zinc-200 bg-white py-2 shadow-lg dark:border-zinc-800 dark:bg-zinc-900 z-50">
          <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-200 dark:border-zinc-800">
            <h3 className="font-medium">Notificaciones</h3>
            {count > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
              >
                Marcar todas leídas
              </button>
            )}
          </div>

          {notifs.length === 0 ? (
            <p className="px-3 py-4 text-sm text-zinc-500 text-center">Sin notificaciones</p>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              {notifs.map((n) => (
                <button
                  key={n.id}
                  onClick={() => !n.is_read && markRead(n.id)}
                  className={`w-full px-3 py-2 text-left text-sm border-b border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800 ${
                    !n.is_read ? "bg-blue-50 dark:bg-blue-900/20 font-medium" : ""
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="truncate">{n.title}</p>
                      {n.body && <p className="text-xs text-zinc-500 truncate">{n.body}</p>}
                      <p className="text-[10px] text-zinc-400 mt-1">
                        {new Date(n.created_at).toLocaleString("es-AR")}
                      </p>
                    </div>
                    {!n.is_read && <span className="flex-shrink-0 h-2 w-2 rounded-full bg-blue-500 mt-1" />}
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className="border-t border-zinc-200 dark:border-zinc-800 p-2">
            <button
              onClick={() => (window.location.href = "/notificaciones")}
              className="w-full text-center text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
            >
              Ver todas
            </button>
          </div>
        </div>
      )}
    </div>
  );
}