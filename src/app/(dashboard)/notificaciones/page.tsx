import Link from "next/link";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/server/auth";
import { X } from "lucide-react";

export default async function NotificacionesPage() {
  const user = await requireUser();
  if (user.isSuperuser || !user.companyId) redirect("/");
  if (user.forcePasswordChange) redirect("/cambiar-password");

  const admin = createAdminClient();
  const { data: notifs } = await admin
    .from("notifications")
    .select("id,type,title,body,is_read,created_at,related_table,related_id")
    .eq("company_id", user.companyId)
    .or(
      `target_role.is.null,target_role.eq.${user.role},recipient_user_id.eq.${user.id}`,
    )
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-6 px-6 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Notificaciones</h1>
        <Link href="/" className="text-sm text-zinc-500 underline">
          ← Inicio
        </Link>
      </div>

      {notifs && notifs.length > 0 ? (
        <div className="flex flex-col gap-3">
          {notifs.map((n) => (
            <div
              key={n.id}
              className={`rounded-md border p-4 ${
                !n.is_read ? "border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-900/20" : "border-zinc-200 dark:border-zinc-800"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className={`font-medium ${!n.is_read ? "text-zinc-900 dark:text-white" : "text-zinc-700 dark:text-zinc-300"}`}>
                    {n.title}
                  </p>
                  {n.body && (
                    <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{n.body}</p>
                  )}
                  <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-500">
                    {new Date(n.created_at).toLocaleString("es-AR")}
                    {n.related_table && n.related_id && (
                      <>
                        {" — "}
                        <Link
                          href={
                            n.related_table === "appointments"
                              ? "/agenda"
                              : n.related_table === "quotes"
                              ? `/presupuestos/${n.related_id}`
                              : n.related_table === "service_requests"
                              ? "/pedidos"
                              : n.related_table === "work_orders"
                              ? `/ordenes/${n.related_id}`
                              : n.related_table === "clients"
                              ? `/clientes/${n.related_id}`
                              : n.related_table === "equipment"
                              ? `/equipos/${n.related_id}`
                              : n.related_table === "payments"
                              ? `/cuenta-corriente/${n.related_id}`
                              : "#"
                          }
                          className="underline"
                        >
                          {n.related_table}
                        </Link>
                      </>
                    )}
                  </p>
                </div>
                {!n.is_read && (
                  <form action="/notificaciones/marcar-leida" method="post" className="flex-shrink-0">
                    <input type="hidden" name="id" value={n.id} />
                    <button type="submit" className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200" aria-label="Marcar como leída">
                      <X className="h-5 w-5" />
                    </button>
                  </form>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-md border border-zinc-200 p-8 text-center dark:border-zinc-800">
          <p className="text-zinc-500">Sin notificaciones</p>
        </div>
      )}

      <Link href="/" className="text-sm text-zinc-500 underline">
        ← Volver al inicio
      </Link>
    </main>
  );
}