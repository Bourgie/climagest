import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { LogoutButton } from "@/app/logout-button";
import { Header } from "@/components/layout/Header";

export default async function SeguridadPage() {
  const user = await getCurrentUser();
  if (!user || !user.isSuperuser) redirect("/login");

  const admin = createAdminClient();

  const { data: sessions } = await admin
    .from("audit_logs")
    .select("id, user_id, action, created_at")
    .eq("action", "users.login")
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-8">
      <Header user={{ role: "owner", isSuperuser: true, companyId: undefined }} />

      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Seguridad</h1>
        <p className="text-sm text-zinc-500 mt-1">Gestión de seguridad de la plataforma</p>
      </div>

      <div className="space-y-6">
        <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="text-lg font-semibold mb-4">Sesiones activas recientes</h2>
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-800">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800">
                  <th className="text-left p-3 font-medium text-zinc-500">Usuario</th>
                  <th className="text-left p-3 font-medium text-zinc-500">Acción</th>
                  <th className="text-left p-3 font-medium text-zinc-500">Fecha</th>
                  <th className="text-right p-3 font-medium text-zinc-500">Acción</th>
                </tr>
              </thead>
              <tbody>
                {sessions?.map((s) => (
                  <tr key={s.id} className="border-b border-zinc-100 dark:border-zinc-800">
                    <td className="p-3 text-sm font-mono">{s.user_id}</td>
                    <td className="p-3 text-sm">{s.action}</td>
                    <td className="p-3 text-sm text-zinc-600 dark:text-zinc-400">
                      {new Date(s.created_at).toLocaleString("es-AR")}
                    </td>
                    <td className="p-3 text-right">
                      <button className="text-sm text-red-600 hover:text-red-900">
                        Revocar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="text-lg font-semibold mb-4">Configuración de seguridad</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-md border border-zinc-200 p-4 dark:border-zinc-800">
              <div>
                <p className="font-medium">2FA obligatorio para superadmin</p>
                <p className="text-sm text-zinc-500">Requerir autenticación de dos factores</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" defaultChecked />
                <div className="w-11 h-6 bg-zinc-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-zinc-300 dark:peer-focus:ring-zinc-800 rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-zinc-600 peer-checked:bg-zinc-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between rounded-md border border-zinc-200 p-4 dark:border-zinc-800">
              <div>
                <p className="font-medium">Bloqueo tras intentos fallidos</p>
                <p className="text-sm text-zinc-500">Bloquear IP tras 5 intentos fallidos por 15 min</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" defaultChecked />
                <div className="w-11 h-6 bg-zinc-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-zinc-300 dark:peer-focus:ring-zinc-800 rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-zinc-600 peer-checked:bg-zinc-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between rounded-md border border-zinc-200 p-4 dark:border-zinc-800">
              <div>
                <p className="font-medium">Expiración de sesión</p>
                <p className="text-sm text-zinc-500">Cerrar sesión tras 8 horas de inactividad</p>
              </div>
              <select className="input w-auto">
                <option value="4">4 horas</option>
                <option value="8" selected>8 horas</option>
                <option value="24">24 horas</option>
              </select>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="text-lg font-semibold mb-4">Rotación de secretos</h2>
          <p className="text-sm text-zinc-500 mb-4">
            Rotar periódicamente: Supabase service_role, anon key, PowerSync token, DB password.
          </p>
          <div className="flex gap-3">
            <button className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white">
              Rotar service_role
            </button>
            <button className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 dark:border-zinc-700">
              Rotar anon key
            </button>
            <button className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 dark:border-zinc-700">
              Rotar DB password
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}