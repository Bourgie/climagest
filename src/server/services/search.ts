import type { SupabaseClient } from "@supabase/supabase-js";

export type SearchScopes = {
  clients: boolean;
  equipment: boolean;
  serviceRequests: boolean;
  quotes: boolean;
  workOrders: boolean;
  payments: boolean;
};

export type SearchResults = {
  clients: { id: string; name: string }[];
  equipment: { id: string; brand: string | null; model: string | null; serial: string | null }[];
  serviceRequests: { id: string; docNumber: number | null; status: string }[];
  quotes: { id: string; docNumber: number | null; status: string; total: number }[];
  workOrders: { id: string; docNumber: number | null; status: string }[];
  payments: { id: string; docNumber: number | null; amount: number; clientId: string }[];
};

const LIMIT = 8;

/** Limpia comodines y operadores del `or()` de postgrest. */
function clean(q: string): string {
  return q.replace(/[%*,()]/g, " ").trim().slice(0, 60);
}

export async function globalSearch(args: {
  admin: SupabaseClient;
  companyId: string;
  query: string;
  scopes: SearchScopes;
}): Promise<SearchResults> {
  const { admin, companyId, scopes } = args;
  const q = clean(args.query);
  const empty: SearchResults = {
    clients: [],
    equipment: [],
    serviceRequests: [],
    quotes: [],
    workOrders: [],
    payments: [],
  };
  if (q.length < 2) return empty;
  const like = `%${q}%`;
  const num = /^\d{1,8}$/.test(q) ? parseInt(q, 10) : null;

  if (scopes.clients) {
    const { data: byName } = await admin
      .from("clients")
      .select("id, name")
      .eq("company_id", companyId)
      .ilike("name", like)
      .limit(LIMIT);
    const ids = new Set((byName ?? []).map((c) => c.id));
    // Teléfono de contacto o dirección también traen al cliente
    const { data: contacts } = await admin
      .from("client_contacts")
      .select("client_id, clients!inner(id, name, company_id)")
      .eq("clients.company_id", companyId)
      .ilike("phone", like)
      .limit(LIMIT);
    const { data: addresses } = await admin
      .from("client_addresses")
      .select("client_id, clients!inner(id, name, company_id)")
      .eq("clients.company_id", companyId)
      .ilike("address", like)
      .limit(LIMIT);
    const extra: { id: string; name: string }[] = [];
    for (const row of [...(contacts ?? []), ...(addresses ?? [])]) {
      const c = (row as unknown as { clients: { id: string; name: string } | null }).clients;
      if (c && !ids.has(c.id)) {
        ids.add(c.id);
        extra.push({ id: c.id, name: c.name });
      }
    }
    empty.clients = [...(byName ?? []), ...extra].slice(0, LIMIT);
  }

  if (scopes.equipment) {
    const { data } = await admin
      .from("equipment")
      .select("id, brand, model, serial_number")
      .eq("company_id", companyId)
      .or(`brand.ilike.${like},model.ilike.${like},serial_number.ilike.${like}`)
      .limit(LIMIT);
    empty.equipment = (data ?? []).map((e) => ({
      id: e.id,
      brand: e.brand,
      model: e.model,
      serial: e.serial_number,
    }));
  }

  if (num !== null) {
    if (scopes.serviceRequests) {
      const { data } = await admin
        .from("service_requests")
        .select("id, doc_number, status")
        .eq("company_id", companyId)
        .eq("doc_number", num)
        .limit(LIMIT);
      empty.serviceRequests = (data ?? []).map((r) => ({
        id: r.id,
        docNumber: r.doc_number,
        status: r.status,
      }));
    }
    if (scopes.quotes) {
      const { data } = await admin
        .from("quotes")
        .select("id, doc_number, status, total")
        .eq("company_id", companyId)
        .eq("doc_number", num)
        .limit(LIMIT);
      empty.quotes = (data ?? []).map((r) => ({
        id: r.id,
        docNumber: r.doc_number,
        status: r.status,
        total: Number(r.total),
      }));
    }
    if (scopes.workOrders) {
      const { data } = await admin
        .from("work_orders")
        .select("id, doc_number, status")
        .eq("company_id", companyId)
        .eq("doc_number", num)
        .limit(LIMIT);
      empty.workOrders = (data ?? []).map((r) => ({
        id: r.id,
        docNumber: r.doc_number,
        status: r.status,
      }));
    }
    if (scopes.payments) {
      const { data } = await admin
        .from("payments")
        .select("id, doc_number, amount, client_id")
        .eq("company_id", companyId)
        .eq("doc_number", num)
        .limit(LIMIT);
      empty.payments = (data ?? []).map((r) => ({
        id: r.id,
        docNumber: r.doc_number,
        amount: Number(r.amount),
        clientId: r.client_id,
      }));
    }
  }

  return empty;
}
