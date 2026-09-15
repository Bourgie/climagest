import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSuperuser } from "@/server/auth";

export async function GET(request: Request) {
  await requireSuperuser();
  const admin = createAdminClient();

  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action") ?? undefined;
  const entity_type = searchParams.get("entity_type") ?? undefined;
  const company_id = searchParams.get("company_id") ?? undefined;
  const user_id = searchParams.get("user_id") ?? undefined;
  const from = searchParams.get("from") ?? undefined;
  const to = searchParams.get("to") ?? undefined;

  let query = admin.from("audit_logs").select("*").order("created_at", { ascending: false });

  if (action) query = query.eq("action", action);
  if (entity_type) query = query.eq("entity_type", entity_type);
  if (company_id) query = query.eq("company_id", company_id);
  if (user_id) query = query.eq("user_id", user_id);
  if (from) query = query.gte("created_at", from);
  if (to) query = query.lte("created_at", to + "T23:59:59");

  const { data, error } = await query.limit(10000);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // CSV header
  const headers = [
    "id",
    "company_id",
    "user_id",
    "action",
    "entity_type",
    "entity_id",
    "old_data",
    "new_data",
    "created_at",
  ];

  // CSV rows
  const rows = (data ?? []).map((log) => [
    log.id,
    log.company_id ?? "",
    log.user_id ?? "",
    log.action,
    log.entity_type ?? "",
    log.entity_id ?? "",
    JSON.stringify(log.old_data ?? {}),
    JSON.stringify(log.new_data ?? {}),
    log.created_at,
  ]);

  const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="auditoria-${new Date().toISOString().split("T")[0]}.csv"`,
    },
  });
}