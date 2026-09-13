import { redirect } from "next/navigation";
import PDFDocument from "pdfkit";
import { hasPermission, requireUser } from "@/server/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getLedger } from "@/server/services/accounting";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ clientId: string }> },
) {
  const { clientId } = await params;
  const user = await requireUser();
  if (user.isSuperuser || !user.companyId) redirect("/cuenta-corriente");
  if (!(await hasPermission(user, "charges.view"))) redirect("/cuenta-corriente");

  const admin = createAdminClient();
  const { data: client } = await admin
    .from("clients")
    .select("name")
    .eq("id", clientId)
    .eq("company_id", user.companyId)
    .maybeSingle();
  if (!client) return new Response("No encontrado", { status: 404 });

  const { entries, balance } = await getLedger(admin, user.companyId, clientId);

  const doc = new PDFDocument({ size: "A4", margin: 50 });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  doc.fontSize(20).text("Estado de cuenta", { align: "center" });
  doc.moveDown(0.5);
  doc.fontSize(12).text(`Cliente: ${client.name}`);
  doc.moveDown();

  doc.fontSize(10).text("Fecha", 50, doc.y, { width: 80 });
  doc.text("Detalle", 130, doc.y, { width: 200 });
  doc.text("Debe", 330, doc.y, { width: 70, align: "right" });
  doc.text("Haber", 400, doc.y, { width: 70, align: "right" });
  doc.text("Saldo", 470, doc.y, { width: 70, align: "right" });
  doc.moveDown(0.5);

  for (const e of entries) {
    const y = doc.y;
    const date = new Date(e.date).toLocaleDateString("es-AR");
    doc.text(date, 50, y, { width: 80 });
    doc.text(e.description, 130, y, { width: 200 });
    doc.text(e.debe > 0 ? `$${e.debe.toFixed(2)}` : "", 330, y, { width: 70, align: "right" });
    doc.text(e.haber > 0 ? `$${e.haber.toFixed(2)}` : "", 400, y, { width: 70, align: "right" });
    doc.text(`$${e.saldo.toFixed(2)}`, 470, y, { width: 70, align: "right" });
    doc.moveDown(0.4);
  }

  doc.moveDown();
  doc.fontSize(14).text(`Saldo: $${balance.toFixed(2)}`, { align: "right" });

  doc.end();
  const pdf = await done;

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="cuenta-${clientId.slice(0, 8)}.pdf"`,
    },
  });
}
