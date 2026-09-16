import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth";
import { CreateCompanyForm } from "@/app/superadmin/create-company-form";
import { LogoutButton } from "@/app/logout-button";
import { Header } from "@/components/layout/Header";

export default async function NuevaEmpresaPage() {
  const user = await getCurrentUser();
  if (!user || !user.isSuperuser) redirect("/login");

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-8">
      <Header user={{ role: "owner", isSuperuser: true, companyId: undefined }} />

      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Nueva empresa</h1>
        <p className="text-sm text-zinc-500 mt-1">Crear una nueva empresa y su primer Dueño</p>
      </div>

      <CreateCompanyForm />

      <a href="/superadmin" className="text-sm text-zinc-500 underline">
        ← Volver al panel
      </a>
    </main>
  );
}