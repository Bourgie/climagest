import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { hasPermission, requireUser } from "@/server/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { displayStatus } from "@/server/services/accounting";
import { CreateChargeForm } from "./create-charge-form";
import { RegisterPaymentForm } from "./register-payment-form";
import { ApplyPaymentForm } from "./apply-payment-form";
import { ChargeRow } from "./charge-row";
import { PaymentRow } from "./payment-row";
import { LogoutButton } from "@/app/logout-button";

export default async function CuentaDetailPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const user = await requireUser();
  if (user.isSuperuser || !user.companyId) redirect("/");

  const [canView, canCreateCharge, canRegister, canDeletePayment, canDeleteCharge] =
    await Promise.all([
      hasPermission(user, "charges.view"),
      hasPermission(user, "charges.create"),
      hasPermission(user, "payments.register"),
      hasPermission(user, "payments.delete"),
      hasPermission(user, "charges.delete"),
    ]);
  if (!canView) redirect("/cuenta-corriente");

  const isOwner = user.role === "owner";
  const admin = createAdminClient();

  const { data: client } = await admin
    .from("clients")
    .select("id, name")
    .eq("id", clientId)
    .eq("company_id", user.companyId)
    .maybeSingle();
  if (!client) notFound();

  const { data: charges } = await admin
    .from("account_charges")
    .select("id, description, amount, late_fee_amount, due_date, status, created_at")
    .eq("company_id", user.companyId)
    .eq("client_id", clientId)
    .order("created_at");

  const { data: payments } = await admin
    .from("payments")
    .select("id, amount, method, paid_at, notes")
    .eq("company_id", user.companyId)
    .eq("client_id", clientId)
    .order("paid_at");

  const chargeIds = (charges ?? []).map((c) => c.id);
  const paymentIds = (payments ?? []).map((p) => p.id);
  const { data: apps } = await admin
    .from("payment_applications")
    .select("payment_id, charge_id, amount_applied")
    .in("charge_id", chargeIds.length ? chargeIds : ["00000000-0000-0000-0000-000000000000"]);

  const appliedByCharge = new Map<string, number>();
  const appliedByPayment = new Map<string, number>();
  for (const a of apps ?? []) {
    appliedByCharge.set(a.charge_id, (appliedByCharge.get(a.charge_id) ?? 0) + Number(a.amount_applied));
    appliedByPayment.set(a.payment_id, (appliedByPayment.get(a.payment_id) ?? 0) + Number(a.amount_applied));
  }

  const chargeRows = (charges ?? []).map((c) => {
    const amount = Number(c.amount);
    const lateFee = Number(c.late_fee_amount);
    const applied = Math.round((appliedByCharge.get(c.id) ?? 0) * 100) / 100;
    const balance = Math.round((amount + lateFee - applied) * 100) / 100;
    return {
      id: c.id,
      description: c.description,
      amount,
      late_fee_amount: lateFee,
      due_date: c.due_date,
      status: displayStatus(amount, lateFee, applied, c.due_date),
      balance,
    };
  });

  const paymentRows = (payments ?? []).map((p) => {
    const amount = Number(p.amount);
    const applied = Math.round((appliedByPayment.get(p.id) ?? 0) * 100) / 100;
    return {
      id: p.id,
      amount,
      method: p.method,
      paid_at: p.paid_at,
      notes: p.notes,
      remainder: Math.round((amount - applied) * 100) / 100,
    };
  });

  const totalBalance = Math.round(chargeRows.reduce((s, c) => s + c.balance, 0) * 100) / 100;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/cuenta-corriente" className="text-sm text-zinc-500">
            ← Volver
          </Link>
          <h1 className="text-2xl font-semibold">{client.name}</h1>
        </div>
        <LogoutButton />
      </div>

      <p className="text-lg">
        Saldo: <strong className={totalBalance > 0 ? "text-red-600" : "text-green-600"}>
          ${totalBalance.toFixed(2)}
        </strong>
      </p>

      <div className="flex gap-2">
        <a
          href={`/api/cuenta-corriente/${clientId}/pdf`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md border border-zinc-300 px-3 py-1 text-sm"
        >
          Exportar PDF
        </a>
        <a
          href={`/api/cuenta-corriente/${clientId}/excel`}
          className="rounded-md border border-zinc-300 px-3 py-1 text-sm"
        >
          Exportar Excel
        </a>
      </div>

      <CreateChargeForm clientId={clientId} canCreate={canCreateCharge} />
      <RegisterPaymentForm clientId={clientId} canRegister={canRegister} />
      <ApplyPaymentForm
        payments={paymentRows.map((p) => ({
          id: p.id,
          label: `$${p.amount.toFixed(2)} · ${p.method}`,
          remainder: p.remainder,
        }))}
        charges={chargeRows.map((c) => ({
          id: c.id,
          label: c.description,
          balance: c.balance,
        }))}
      />

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Cargos ({chargeRows.length})</h2>
        {chargeRows.map((c) => (
          <ChargeRow key={c.id} charge={c} isOwner={isOwner} canDelete={canDeleteCharge} />
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Pagos ({paymentRows.length})</h2>
        {paymentRows.map((p) => (
          <PaymentRow key={p.id} payment={p} canDelete={canDeletePayment} />
        ))}
      </section>
    </main>
  );
}
