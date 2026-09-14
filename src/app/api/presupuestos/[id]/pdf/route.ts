import { redirect } from "next/navigation";
import PDFDocument from "pdfkit";
import { requireUser } from "@/server/auth";
import { createAdminClient } from "@/lib/supabase/admin";

function fmt(n: number, s: {
  currency: string;
  decimals: number;
  thousands: string;
  decimal: string;
  symbol: string;
}): string {
  const fixed = Number(n).toFixed(s.decimals);
  const [intPart, decPart] = fixed.split(".");
  const withThousands = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, s.thousands);
  return `${s.symbol}${withThousands}${s.decimal}${decPart}`;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await requireUser();
  if (user.isSuperuser || !user.companyId) redirect("/presupuestos");

  const admin = createAdminClient();

  const settingsRes = await admin.from("company_settings").select("*").eq("company_id", user.companyId).maybeSingle();
  const quoteRes = await admin.from("quotes").select("id, client_id, subtotal, discount, total, payment_terms, valid_until, status, created_at, doc_number").eq("id", id).eq("company_id", user.companyId).maybeSingle();
  const itemsRes = await admin.from("quote_items").select("description, type, quantity, unit_price, subtotal").eq("quote_id", id).order("id");

  const settings = settingsRes.data;
  const quote = quoteRes.data;
  const items = itemsRes.data ?? [];

  if (!quote) return new Response("No encontrado", { status: 404 });

  const { data: client } = await admin
    .from("clients")
    .select("name")
    .eq("id", quote.client_id)
    .maybeSingle();

  const doc = new PDFDocument({ size: "A4", margin: 50 });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  const companyName = settings?.name ?? "";
  const companyPhone = settings?.phone ?? "";
  const companyAddress = settings?.address ?? "";
  const companyEmail = settings?.email ?? "";
  const companyWhatsApp = settings?.whatsapp ?? "";
  const companyTaxId = settings?.tax_id ?? "";
  const companyTaxCondition = settings?.tax_condition ?? "";
  const quoteTerms = settings?.quote_terms ?? "";
  const quotePaymentInfo = settings?.quote_payment_info ?? "";

  const currency = settings?.currency ?? "ARS";
  const decimals = settings?.decimal_places ?? 2;
  const thousandsSep = settings?.thousands_separator ?? ".";
  const decimalSep = settings?.decimal_separator ?? ",";
  const symbol = currency === "USD" ? "US$ " : "$";

  const fmtMoney = (n: number) => fmt(n, { currency, decimals, thousands: thousandsSep, decimal: decimalSep, symbol });

  const docNumber = quote.doc_number ? `#${String(quote.doc_number).padStart(6, "0")}` : `#${quote.id.slice(0, 8)}`;

  // Header - Logo + Company info
  if (settings?.logo_url) {
    try {
      doc.image(settings.logo_url, 50, 50, { width: 80 });
      doc.moveDown(4);
    } catch {
      // ignore image errors
    }
  } else {
    doc.fontSize(20).text("Presupuesto", { align: "center" });
    doc.moveDown(0.5);
  }

  // Company details
  doc.fontSize(10);
  if (companyName) {
    doc.font("Helvetica-Bold").text(companyName, { align: "right" });
    doc.font("Helvetica");
  }
  if (companyTaxId) doc.text(`CUIT: ${companyTaxId}`, { align: "right" });
  if (companyTaxCondition) doc.text(`Condición IVA: ${companyTaxCondition}`, { align: "right" });
  if (companyPhone) doc.text(companyPhone, { align: "right" });
  if (companyAddress) doc.text(companyAddress, { align: "right" });
  if (companyEmail) doc.text(companyEmail, { align: "right" });
  if (companyWhatsApp) doc.text(`WhatsApp: ${companyWhatsApp}`, { align: "right" });
  doc.moveDown(1);

  // Quote title + number
  doc.fontSize(18).font("Helvetica-Bold").text(`Presupuesto ${docNumber}`, { align: "center" });
  doc.font("Helvetica").moveDown(0.5);

  // Dates
  doc.fontSize(10);
  const createdDate = new Date(quote.created_at).toLocaleDateString("es-AR", { timeZone: settings?.timezone ?? "America/Argentina/Buenos_Aires" });
  doc.text(`Fecha: ${createdDate}`);
  if (quote.valid_until) {
    doc.text(`Válido hasta: ${quote.valid_until}`);
  }
  doc.moveDown(0.5);

  // Client
  doc.font("Helvetica-Bold").text("Cliente:", { continued: true });
  doc.font("Helvetica").text(` ${client?.name ?? "—"}`);
  doc.moveDown(1);

  // Items table header
  const colDesc = 50;
  const colQty = 350;
  const colUnit = 410;
  const colSub = 480;

  doc.font("Helvetica-Bold").fontSize(9);
  doc.text("Descripción", colDesc, doc.y, { width: 290 });
  doc.text("Cant.", colQty, doc.y, { width: 50, align: "right" });
  doc.text("Precio Unit.", colUnit, doc.y, { width: 60, align: "right" });
  doc.text("Subtotal", colSub, doc.y, { width: 80, align: "right" });
  doc.moveDown(0.3);
  doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
  doc.moveDown(0.3);

  // Items
  doc.font("Helvetica").fontSize(9);
  for (const it of items) {
    const y = doc.y;
    doc.text(it.description, colDesc, y, { width: 290 });
    doc.text(`${it.quantity}`, colQty, y, { width: 50, align: "right" });
    doc.text(fmtMoney(it.unit_price), colUnit, y, { width: 60, align: "right" });
    doc.text(fmtMoney(it.subtotal), colSub, y, { width: 80, align: "right" });
    doc.moveDown(0.45);
  }

  doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
  doc.moveDown(0.5);

  // Totals
  doc.fontSize(10).font("Helvetica");
  doc.text(`Subtotal: ${fmtMoney(quote.subtotal)}`, { align: "right" });
  if (Number(quote.discount) > 0) {
    doc.text(`Descuento: -${fmtMoney(quote.discount)}`, { align: "right" });
  }
  doc.font("Helvetica-Bold").fontSize(12).text(`Total: ${fmtMoney(quote.total)}`, { align: "right" });
  doc.moveDown(0.8);

  // IVA info (informativo, según configuración)
  const ivaRate = settings?.default_iva_rate ?? 21;
  const priceDisplay = settings?.price_display ?? "with_tax";
  if (priceDisplay === "both" || priceDisplay === "without_tax") {
    const net = Number(quote.total) / (1 + ivaRate / 100);
    const ivaAmt = Number(quote.total) - net;
    doc.font("Helvetica").fontSize(9).text(`Net: ${fmtMoney(net)}  |  IVA ${ivaRate}%: ${fmtMoney(ivaAmt)}  |  Total: ${fmtMoney(quote.total)}`, { align: "right" });
    doc.moveDown(0.5);
  }

  // Payment terms / conditions
  if (quote.payment_terms) {
    doc.font("Helvetica-Bold").text("Condiciones de pago:");
    doc.font("Helvetica").fontSize(9).text(quote.payment_terms);
    doc.moveDown(0.5);
  }
  if (quoteTerms) {
    doc.font("Helvetica-Bold").text("Términos y condiciones:");
    doc.font("Helvetica").fontSize(9).text(quoteTerms);
    doc.moveDown(0.5);
  }
  if (quotePaymentInfo) {
    doc.font("Helvetica-Bold").text("Datos para el pago:");
    doc.font("Helvetica").fontSize(9).text(quotePaymentInfo);
  }

  doc.end();
  const pdf = await done;

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="presupuesto-${docNumber}.pdf"`,
    },
  });
}