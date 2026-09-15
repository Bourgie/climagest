"use client";

import { useState, useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";

type AuditLog = {
  id: string;
  company_id: string | null;
  user_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  created_at: string;
};

type Filters = {
  action: string;
  entity_type: string;
  company_id: string;
  user_id: string;
  from: string;
  to: string;
};

export function AuditTable() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>({
    action: "",
    entity_type: "",
    company_id: "",
    user_id: "",
    from: "",
    to: "",
  });

  const safeFilters = {
    action: filters.action ?? "",
    entity_type: filters.entity_type ?? "",
    company_id: filters.company_id ?? "",
    user_id: filters.user_id ?? "",
    from: filters.from ?? "",
    to: filters.to ?? "",
  };
  const [page, setPage] = useState(1);
  const pageSize = 50;
  const [total, setTotal] = useState(0);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  async function fetchLogs() {
    setLoading(true);
    const from = (page - 1) * pageSize;
    let query = supabase
      .from("audit_logs")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, from + pageSize - 1);

    if (filters.action) query = query.eq("action", filters.action);
    if (filters.entity_type) query = query.eq("entity_type", filters.entity_type);
    if (filters.company_id) query = query.eq("company_id", filters.company_id);
    if (filters.user_id) query = query.eq("user_id", filters.user_id);
    if (filters.from) query = query.gte("created_at", filters.from);
    if (filters.to) query = query.lte("created_at", filters.to + "T23:59:59");

    const { data, count, error } = await query;
    if (error) console.error("Error fetching audit logs:", error);
    else {
      setLogs(data ?? []);
      setTotal(count ?? 0);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchLogs();
  }, [page, filters]);

  const formatDate = (iso: string) => new Date(iso).toLocaleString("es-AR");

  const actions = [...new Set(logs.map((l) => l.action).filter(Boolean))];
  const entityTypes = [...new Set(logs.map((l) => l.entity_type).filter(Boolean))];

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800">
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Acción">
            <select value={safeFilters.action} onChange={(e) => setFilters({ ...filters, action: e.target.value })} className="input">
              <option value="">Todas</option>
              {actions.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </Field>
          <Field label="Entidad">
            <select value={safeFilters.entity_type} onChange={(e) => setFilters({ ...filters, entity_type: e.target.value })} className="input">
              <option value="">Todas</option>
              {entityTypes.filter((e): e is string => e !== null).map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
          </Field>
          <Field label="Desde">
            <input type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} className="input" />
          </Field>
          <Field label="Hasta">
            <input type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} className="input" />
          </Field>
        </div>
        <div className="mt-3 flex gap-2">
          <button onClick={() => setFilters({ action: "", entity_type: "", company_id: "", user_id: "", from: "", to: "" })} className="rounded-md border border-zinc-300 px-3 py-1 text-sm dark:border-zinc-700">
            Limpiar
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center text-zinc-500">Cargando…</div>
      ) : logs.length === 0 ? (
        <div className="p-8 text-center text-zinc-500">Sin logs</div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800">
                  <th className="text-left p-3 font-medium text-zinc-500">Fecha</th>
                  <th className="text-left p-3 font-medium text-zinc-500">Acción</th>
                  <th className="text-left p-3 font-medium text-zinc-500">Entidad</th>
                  <th className="text-left p-3 font-medium text-zinc-500">Empresa</th>
                  <th className="text-left p-3 font-medium text-zinc-500">Usuario</th>
                  <th className="text-left p-3 font-medium text-zinc-500">Detalle</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                    <td className="p-3 text-sm font-mono">{formatDate(log.created_at)}</td>
                    <td className="p-3 text-sm font-medium">{log.action}</td>
                    <td className="p-3 text-sm text-zinc-600 dark:text-zinc-400">{log.entity_type ?? "—"}</td>
                    <td className="p-3 text-sm text-zinc-600 dark:text-zinc-400 font-mono">{log.company_id ?? "—"}</td>
                    <td className="p-3 text-sm text-zinc-600 dark:text-zinc-400 font-mono">{log.user_id ?? "—"}</td>
                    <td className="p-3 text-sm">
                      <pre className="text-xs text-zinc-500 max-h-20 overflow-auto whitespace-pre-wrap">
                        {JSON.stringify(log.new_data ?? log.old_data, null, 2)}
                      </pre>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
            <p className="text-sm text-zinc-500">
              Mostrando {logs.length} de {total} logs
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-md border border-zinc-300 px-3 py-1 text-sm disabled:opacity-50 dark:border-zinc-700"
              >
                Anterior
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page * pageSize >= total}
                className="rounded-md border border-zinc-300 px-3 py-1 text-sm disabled:opacity-50 dark:border-zinc-700"
              >
                Siguiente
              </button>
            </div>
          </div>
        </>
      )}
    </div>
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