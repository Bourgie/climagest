import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { LogoutButton } from "@/app/logout-button";
import { Header } from "@/components/layout/Header";

export default async function ConfiguracionPage() {
  const user = await getCurrentUser();
  if (!user || !user.isSuperuser) redirect("/login");

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-8">
      <Header user={{ role: "owner", isSuperuser: true, companyId: undefined }} />

      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Configuración global</h1>
        <p className="text-sm text-zinc-500 mt-1">Configuración de la plataforma</p>
      </div>

      <div className="space-y-6">
        <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="text-lg font-semibold mb-4">SMTP Global (Superadmin)</h2>
          <p className="text-sm text-zinc-500 mb-4">
            Configuración de email para notificaciones de la plataforma (superadmin).
            Cada empresa configura su propio SMTP desde su panel.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Host SMTP">
              <input type="text" placeholder="smtp.ejemplo.com" className="input" />
            </Field>
            <Field label="Puerto">
              <input type="number" placeholder="465" className="input" />
            </Field>
            <Field label="Usuario">
              <input type="text" placeholder="usuario@dominio.com" className="input" />
            </Field>
            <Field label="Contraseña / App Password">
              <input type="password" placeholder="••••••••" className="input" />
            </Field>
            <Field label="Seguridad">
              <select className="input">
                <option value="ssl">SSL (puerto 465)</option>
                <option value="tls">TLS (puerto 587)</option>
              </select>
            </Field>
            <Field label="From email">
              <input type="email" placeholder="noreply@tudominio.com" className="input" />
            </Field>
          </div>
          <button className="mt-4 self-start rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white">
            Guardar configuración SMTP
          </button>
        </section>

        <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="text-lg font-semibold mb-4">Límites y feature flags</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Max empresas por superadmin">
              <input type="number" value="100" className="input" />
            </Field>
            <Field label="Max usuarios por empresa">
              <input type="number" value="50" className="input" />
            </Field>
            <Field label="Retención logs auditoría (días)">
              <input type="number" value="365" className="input" />
            </Field>
            <Field label="Tamaño máximo archivo (MB)">
              <input type="number" value="10" className="input" />
            </Field>
          </div>
        </section>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{label}</span>
      {children}
    </label>
  );
}