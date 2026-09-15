import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { SuperadminProfileForm } from "./superadmin-profile-form";
import { LogoutButton } from "@/app/logout-button";
import { Header } from "@/components/layout/Header";

export default async function PerfilPage() {
  const user = await getCurrentUser();
  if (!user || !user.isSuperuser) redirect("/login");

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-8">
      <Header user={{ role: "owner", isSuperuser: true, companyId: undefined }} />

      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Mi perfil</h1>
        <p className="text-sm text-zinc-500 mt-1">Configuración de mi cuenta de superusuario</p>
      </div>

      <SuperadminProfileForm userId={user.id} />
    </main>
  );
}