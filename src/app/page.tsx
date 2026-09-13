import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, hasPermission } from "@/server/auth";
import { LogoutButton } from "./logout-button";

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.forcePasswordChange) redirect("/cambiar-password");

  const canManageUsers =
    user.role === "owner" || (await hasPermission(user, "users.view"));
  const canViewClients = await hasPermission(user, "clients.view");
  const canViewEquipment = await hasPermission(user, "equipment.view");
  const canViewRequests = await hasPermission(user, "service_requests.view");
  const canViewQuotes = await hasPermission(user, "quotes.view");
  const canViewAppointments = await hasPermission(user, "appointments.view");
  const canViewWorkOrders = await hasPermission(user, "work_orders.view");

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col items-center gap-6 px-6 py-12 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Hola, {user.fullName}</h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        {user.isSuperuser
          ? "Superusuario (plataforma)"
          : `Rol: ${user.role} — Empresa: ${user.companyId ?? "-"}`}
      </p>

      <nav className="flex flex-col gap-3">
        {user.isSuperuser && (
          <Link
            href="/superadmin"
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            Panel de Superusuario
          </Link>
        )}
        {!user.isSuperuser && canViewClients && (
          <Link
            href="/clientes"
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            Clientes
          </Link>
        )}
        {!user.isSuperuser && canViewEquipment && (
          <Link
            href="/equipos"
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            Equipos
          </Link>
        )}
        {!user.isSuperuser && canViewRequests && (
          <Link
            href="/pedidos"
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            Pedidos
          </Link>
        )}
        {!user.isSuperuser && canViewQuotes && (
          <Link
            href="/presupuestos"
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            Presupuestos
          </Link>
        )}
        {!user.isSuperuser && canViewAppointments && (
          <Link
            href="/agenda"
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            Agenda
          </Link>
        )}
        {!user.isSuperuser && canViewWorkOrders && (
          <Link
            href="/ordenes"
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            Órdenes de trabajo
          </Link>
        )}
        {!user.isSuperuser && user.role === "technician" && (
          <Link
            href="/tecnico"
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            App técnico
          </Link>
        )}
        {!user.isSuperuser && canManageUsers && (
          <Link
            href="/config/usuarios"
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            Gestión de usuarios
          </Link>
        )}
        {user.role === "owner" && (
          <Link
            href="/config/permisos"
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            Configurar permisos
          </Link>
        )}
      </nav>

      <p className="max-w-md text-sm text-zinc-500">
        Los módulos operativos (clientes, equipos, agenda, órdenes de trabajo)
        se implementan en las fases siguientes.
      </p>

      <LogoutButton />
    </main>
  );
}
