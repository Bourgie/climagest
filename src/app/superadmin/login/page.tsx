import { SuperadminLoginForm } from "./superadmin-login-form";

export default function SuperadminLoginPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Superusuario</h1>
        <p className="text-sm text-zinc-500">
          Acceso de plataforma (administración de empresas)
        </p>
      </div>
      <SuperadminLoginForm />
    </main>
  );
}
