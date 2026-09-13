import { redirect } from "next/navigation";
import PDFDocument from "pdfkit";
import { requireUser } from "@/server/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await requireUser();
  if (user.isSuperuser || !user.companyId) redirect("/presupuestos");

  const admin = createAdminClient();
  const { data: quote } = await admin
    .from("quotes")
    .select("id, client_id, subtotal, discount, total, payment_terms, valid_until, status, created_at")
    .eq("id", id)
    .eq("company_id", user.companyId)
    .maybeSingle();
  if (!quote) return new Response("No encontrado", { status: 404 });

  const { data: items } = await admin
    .from("quote_items")
    .select("description, type, quantity, unit_price, subtotal")
    .eq("quote_id", id)
    .order("id");

  const { data: client } = await admin
    .from("clients")
    .select("name")
    .eq("id", quote.client_id)
    .maybeSingle();

  const doc = new PDFDocument({ size: "A4", margin: 50 });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  doc.fontSize(20).text("Presupuesto", { align: "center" });
  doc.moveDown(0.5);
  doc.fontSize(12).text(`Cliente: ${client?.name ?? "—"}`);
  doc.text(`Fecha: ${new Date(quote.created_at).toLocaleDateString("es-AR")}`);
  if (quote.valid_until) {
    doc.text(`Válido hasta: ${quote.valid_until}`);
  }
  doc.moveDown();

  doc.fontSize(10).text("Descripción", 50, doc.y, { width: 200 });
  doc.text("Cant.", 260, doc.y, { width: 60, align: "right" });
  doc.text("Unit.", 320, doc.y, { width: 70, align: "right" });
  doc.text("Subtotal", 390, doc.y, { width: 100, align: "right" });
  doc.moveDown(0.5);

  for (const it of items ?? []) {
    const y = doc.y;
    doc.text(it.description, 50, y, { width: 200 });
    doc.text(`${it.quantity}`, 260, y, { width: 60, align: "right" });
    doc.text(`$${Number(it.unit_price).toFixed(2)}`, 320, y, { width: 70, align: "right" });
    doc.text(`$${Number(it.subtotal).toFixed(2)}`, 390, y, { width: 100, align: "right" });
    doc.moveDown(0.4);
  }

  doc.moveDown();
  doc.fontSize(12).text(`Subtotal: $${Number(quote.subtotal).toFixed(2)}`, { align: "right" });
  if (Number(quote.discount) > 0) {
    doc.text(`Descuento: -$${Number(quote.discount).toFixed(2)}`, { align: "right" });
  }
  doc.fontSize(14).text(`Total: $${Number(quote.total).toFixed(2)}`, { align: "right" });
  if (quote.payment_terms) {
    doc.moveDown();
    doc.fontSize(10).text(`Condiciones: ${quote.payment_terms}`);
  }

  doc.end();
  const pdf = await done;

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="presupuesto-${quote.id.slice(0, 8)}.pdf"`,
    },
  });
}
