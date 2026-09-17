import { getCurrentUser, hasPermission } from "@/server/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import Link from "next/link";
import { LogoutButton } from "@/app/logout-button";
import { Calendar, Filter, ChevronDown } from "lucide-react";
import { DashboardFilters } from "@/app/dashboard-filters";

type Period = "today" | "week" | "month" | "custom";
type Filters = {
  period: Period;
  from?: string;
  to?: string;
  technicianId?: string;
  branchId?: string;
};

function getPeriodRange(period: Period, tz: string, customFrom?: string, customTo?: string): { from: string; to: string } {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("es-AR", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
  const parts = formatter.formatToParts(now);
  const yyyy = parts.find(p => p.type === "year")?.value;
  const mm = parts.find(p => p.type === "month")?.value;
  const dd = parts.find(p => p.type === "day")?.value;
  const today = `${yyyy}-${mm}-${dd}`;

  switch (period) {
    case "today":
      return { from: today, to: today };
    case "week": {
      const d = new Date(now);
      d.setDate(d.getDate() - d.getDay());
      const weekStart = new Intl.DateTimeFormat("es-AR", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" })
        .formatToParts(d).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {} as Record<string, string>);
      return { from: `${weekStart.year}-${weekStart.month}-${weekStart.day}`, to: today };
    }
    case "month":
      return { from: `${yyyy}-${mm}-01`, to: today };
    case "custom":
      return { from: customFrom ?? today, to: customTo ?? today };
  }
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{
    period?: Period;
    from?: string;
    to?: string;
    technicianId?: string;
    branchId?: string;
  }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.forcePasswordChange) redirect("/cambiar-password");

  const params = await searchParams;
  const period = (params.period as Period) ?? "today";
  const from = params.from;
  const to = params.to;
  const technicianId = params.technicianId;
  const branchId = params.branchId;

  const admin = createAdminClient();
  const companyId = user.companyId;

  const { data: settings } = await admin
    .from("company_settings")
    .select("timezone")
    .eq("company_id", companyId!)
    .maybeSingle();
  const tz = settings?.timezone ?? "America/Argentina/Buenos_Aires";

  const { from: periodFrom, to: periodTo } = getPeriodRange(period, tz, from, to);

  const [technicians, branches] = await Promise.all([
    admin.from("memberships").select("user_id, profiles!inner(full_name)").eq("company_id", companyId!).eq("role", "technician").eq("status", "active"),
    admin.from("branches").select("id, name").eq("company_id", companyId!).eq("active", true),
  ]);

  const techList = (technicians.data ?? []).map(m => ({
    id: m.user_id,
    name: (m.profiles as any)?.full_name ?? "Técnico",
  }));
  const branchList = (branches.data ?? []).map(b => ({ id: b.id, name: b.name }));

  const canViewAppointments = await hasPermission(user, "appointments.view");
  const canViewWorkOrders = await hasPermission(user, "work_orders.view");
  const canViewCharges = await hasPermission(user, "charges.view");
  const canViewClients = await hasPermission(user, "clients.view");
  const canViewRequests = await hasPermission(user, "service_requests.view");
  const canViewQuotes = await hasPermission(user, "quotes.view");

  const baseUrl = new URL("/", "http://x");
  baseUrl.searchParams.set("period", period);
  if (from) baseUrl.searchParams.set("from", from);
  if (to) baseUrl.searchParams.set("to", to);
  if (technicianId) baseUrl.searchParams.set("technicianId", technicianId);
  if (branchId) baseUrl.searchParams.set("branchId", branchId);
  const currentPath = baseUrl.pathname + baseUrl.search;

  async function countAppointments() {
    if (!canViewAppointments) return { count: 0 };
    let q = admin.from("appointments").select("*", { count: "exact", head: true })
      .eq("company_id", companyId!)
      .eq("status", "programado")
      .gte("scheduled_at", `${periodFrom}T00:00:00`)
      .lte("scheduled_at", `${periodTo}T23:59:59`);
    if (technicianId) q = q.eq("technician_id", technicianId);
    if (branchId) q = q.eq("branch_id", branchId);
    return q;
  }
  async function countActiveWorkOrders() {
    if (!canViewWorkOrders) return { count: 0 };
    let q = admin.from("work_orders").select("*", { count: "exact", head: true })
      .eq("company_id", companyId!)
      .in("status", ["borrador", "en_progreso"]);
    if (technicianId) q = q.eq("created_by", technicianId);
    if (branchId) q = q.eq("branch_id", branchId);
    return q;
  }
  async function countOverdueCharges() {
    if (!canViewCharges) return { count: 0 };
    return admin.from("account_charges").select("*", { count: "exact", head: true })
      .eq("company_id", companyId!)
      .in("status", ["pendiente", "parcial"])
      .lt("due_date", periodTo);
  }
  async function countCompletedWorkOrders() {
    if (!canViewWorkOrders) return { count: 0 };
    let q = admin.from("work_orders").select("*", { count: "exact", head: true })
      .eq("company_id", companyId!)
      .eq("status", "completado")
      .gte("actual_end_at", `${periodFrom}T00:00:00`)
      .lte("actual_end_at", `${periodTo}T23:59:59`);
    if (technicianId) q = q.eq("created_by", technicianId);
    return q;
  }
  async function fetchCompletedWorkOrders() {
    if (!canViewWorkOrders) return { data: [] as any[] };
    return admin.from("work_orders").select("actual_end_at")
      .eq("company_id", companyId!)
      .eq("status", "completado")
      .gte("actual_end_at", `${periodFrom}T00:00:00`)
      .lte("actual_end_at", `${periodTo}T23:59:59`);
  }

  const [todayAppointments, activeWorkOrders, overdueCharges, completedWorkOrders, revenue] = await Promise.all([
    countAppointments(),
    countActiveWorkOrders(),
    countOverdueCharges(),
    countCompletedWorkOrders(),
    fetchCompletedWorkOrders(),
  ]);

  const totalRevenue = (revenue.data ?? []).reduce((sum: number, wo: { actual_end_at: string | null }) => {
    return sum;
  }, 0);

  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Hola, {user.fullName}</h1>
          <p className="text-zinc-600 dark:text-zinc-400 mt-1">
            {user.role === "owner" ? "Dueño" : user.role === "admin" ? "Administrativo" : "Técnico"} — Panel principal
          </p>
        </div>

<div className="flex flex-wrap gap-3">
              <form action="/" method="get" className="flex flex-wrap gap-2 items-end" onSubmit={e => e.preventDefault()}>
                <input type="hidden" name="period" value={period} />
                {from && <input type="hidden" name="from" value={from} />}
                {to && <input type="hidden" name="to" value={to} />}
                {technicianId && <input type="hidden" name="technicianId" value={technicianId} />}
                {branchId && <input type="hidden" name="branchId" value={branchId} />}

                <div className="flex items-center gap-2">
                  <label className="text-sm text-zinc-600 dark:text-zinc-400">Período</label>
                  <select name="period" onChange={e => (e.target as HTMLSelectElement).form?.submit()} className="rounded-md border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900">
                    <option value="today" selected={period === "today"}>Hoy</option>
                    <option value="week" selected={period === "week"}>Esta semana</option>
                    <option value="month" selected={period === "month"}>Este mes</option>
                    <option value="custom" selected={period === "custom"}>Personalizado</option>
                  </select>
                </div>

                {period === "custom" && (
                  <>
                    <label className="text-sm text-zinc-600 dark:text-zinc-400">Desde</label>
                    <input type="date" name="from" value={from ?? ""} onChange={e => (e.target as HTMLInputElement).form?.submit()} className="rounded-md border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900" />
                    <label className="text-sm text-zinc-600 dark:text-zinc-400">Hasta</label>
                    <input type="date" name="to" value={to ?? ""} onChange={e => (e.target as HTMLInputElement).form?.submit()} className="rounded-md border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900" />
                  </>
                )}

                {techList.length > 0 && (
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-zinc-600 dark:text-zinc-400">Técnico</label>
                    <select name="technicianId" onChange={e => (e.target as HTMLSelectElement).form?.submit()} className="rounded-md border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900">
                      <option value="">Todos</option>
                      {techList.map(t => <option key={t.id} value={t.id} selected={technicianId === t.id}>{t.name}</option>)}
                    </select>
                  </div>
                )}

                {branchList.length > 0 && (
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-zinc-600 dark:text-zinc-400">Sucursal</label>
                    <select name="branchId" onChange={e => (e.target as HTMLSelectElement).form?.submit()} className="rounded-md border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900">
                      <option value="">Todas</option>
                      {branchList.map(b => <option key={b.id} value={b.id} selected={branchId === b.id}>{b.name}</option>)}
                    </select>
                  </div>
                )}
          </form>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Turnos en período" value={todayAppointments.count ?? 0} href="/agenda" variant="info" />
        <MetricCard title="OTs activas" value={activeWorkOrders.count ?? 0} href="/ordenes" variant="warning" />
        <MetricCard title="OTs completadas" value={completedWorkOrders.count ?? 0} href="/ordenes" variant="default" />
        {canViewCharges && overdueCharges.count && overdueCharges.count > 0 && (
          <MetricCard title="Cargos vencidos" value={overdueCharges.count} href="/cuenta-corriente" variant="danger" />
        )}
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="font-semibold mb-3">Accesos rápidos</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {canViewClients && <QuickLink href="/clientes/nuevo" label="Nuevo cliente" />}
            <QuickLink href="/equipos/nuevo" label="Nuevo equipo" />
            {canViewRequests && <QuickLink href="/pedidos" label="Ver pedidos" />}
            {canViewQuotes && <QuickLink href="/presupuestos/nuevo" label="Nuevo presupuesto" />}
            {canViewAppointments && <QuickLink href="/agenda/nuevo" label="Nuevo turno" />}
            {canViewWorkOrders && <QuickLink href="/ordenes/nuevo" label="Nueva OT" />}
          </div>
        </section>

        <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800 md:col-span-2">
          <h2 className="font-semibold mb-3">Recordatorios</h2>
          <ul className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
            {todayAppointments.count && todayAppointments.count > 0 && (
              <li>• {todayAppointments.count} turno(s) en el período</li>
            )}
            {activeWorkOrders.count && activeWorkOrders.count > 0 && (
              <li>• {activeWorkOrders.count} OT(s) en progreso</li>
            )}
            {completedWorkOrders.count && completedWorkOrders.count > 0 && (
              <li>• {completedWorkOrders.count} OT(s) completadas en el período</li>
            )}
            {overdueCharges.count && overdueCharges.count > 0 && (
              <li className="text-red-600 dark:text-red-400">• {overdueCharges.count} cargo(s) vencido(s)</li>
            )}
            {(todayAppointments.count ?? 0) + (activeWorkOrders.count ?? 0) + (completedWorkOrders.count ?? 0) + (overdueCharges.count ?? 0) === 0 && (
              <li className="text-zinc-500">Todo al día 🎉</li>
            )}
          </ul>
        </section>
      </div>

      <LogoutButton />
    </main>
  );
}

function MetricCard({ title, value, href, variant }: { title: string; value: number; href: string; variant?: "default" | "warning" | "info" | "danger" }) {
  const base = "rounded-lg border p-4 text-center";
  const variants = {
    default: "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900",
    warning: "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-900/20",
    info: "border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-900/20",
    danger: "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-900/20",
  };
  return (
    <Link href={href} className={`${base} ${variants[variant ?? "default"]} hover:shadow-md transition-shadow`}>
      <p className="text-3xl font-bold text-zinc-900 dark:text-white">{value}</p>
      <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">{title}</p>
    </Link>
  );
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="rounded-md border border-zinc-200 p-2 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800">
      {label}
    </Link>
  );
}