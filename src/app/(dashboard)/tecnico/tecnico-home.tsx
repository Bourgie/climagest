"use client";

import { useState } from "react";
import { usePowerSync, useQuery } from "@powersync/react";
import { SyncStatusBadge } from "@/components/powersync/SyncStatusBadge";

const VISIT_LABELS: Record<string, string> = {
  instalacion: "Instalación",
  mantenimiento: "Mantenimiento",
  reparacion: "Reparación",
  limpieza: "Limpieza",
  otro: "Otro",
};

function BigButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className="flex min-h-20 items-center justify-center rounded-xl bg-zinc-900 px-4 py-4 text-lg font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900"
    >
      {children}
    </a>
  );
}

/**
 * Pantalla principal del técnico (mobile-first, Fase 8): máximo 4-5 accesos
 * grandes + indicador permanente de sincronización. Lee y escribe siempre
 * contra la base local PowerSync (instantáneo, haya o no señal); la subida a
 * Supabase la hace el conector en segundo plano.
 */
export function TecnicoHome({
  userId,
  companyId,
  fullName,
}: {
  userId: string;
  companyId: string;
  fullName: string;
}) {
  const db = usePowerSync();
  const { data: appointments } = useQuery(
    "SELECT id, client_id, equipment_id, scheduled_at, status, notes FROM appointments ORDER BY scheduled_at",
  );
  const { data: equipment } = useQuery(
    "SELECT id, brand, model, equipment_type, location_label FROM equipment ORDER BY brand, model",
  );
  const { data: clients } = useQuery("SELECT id, name FROM clients ORDER BY name");

  const [equipmentId, setEquipmentId] = useState("");
  const [visitType, setVisitType] = useState("mantenimiento");
  const [diagnosis, setDiagnosis] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");

  const turnos = appointments ?? [];
  const equipos = equipment ?? [];
  const clientes = clients ?? [];
  const clientName = new Map(clientes.map((c: { id: string; name: string }) => [c.id, c.name]));

  async function saveVisit(e: React.FormEvent) {
    e.preventDefault();
    if (!equipmentId) {
      setSaveError("Elegí el equipo.");
      return;
    }
    setSaving(true);
    setSaveError("");
    setSaved(false);
    try {
      await db.execute(
        "INSERT INTO work_orders (id, company_id, equipment_id, created_by, visit_type, diagnosis_notes, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [
          crypto.randomUUID(),
          companyId,
          equipmentId,
          userId,
          visitType,
          diagnosis.trim() || null,
          "borrador",
          new Date().toISOString(),
        ],
      );
      setSaved(true);
      setDiagnosis("");
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-6">
      <div className="sticky top-0 flex items-center justify-between gap-3 bg-white/95 py-2 dark:bg-black/95">
        <h1 className="text-xl font-semibold">Hola, {fullName}</h1>
        <SyncStatusBadge />
      </div>

      <nav className="grid grid-cols-2 gap-3">
        <BigButton href="#turnos">Mis turnos</BigButton>
        <BigButton href="#nueva">Nueva visita</BigButton>
        <BigButton href="#equipos">Mis equipos</BigButton>
        <BigButton href="#clientes">Clientes</BigButton>
      </nav>

      <section id="turnos" className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Mis turnos</h2>
        {turnos.length === 0 && (
          <p className="text-sm text-zinc-500">Sin turnos sincronizados todavía.</p>
        )}
        {turnos.map((a: { id: string; scheduled_at: string; status: string; client_id: string }) => (
          <div
            key={a.id}
            className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-700"
          >
            <p className="font-medium">{clientName.get(a.client_id) ?? "—"}</p>
            <p className="text-sm text-zinc-500">
              {new Date(a.scheduled_at).toLocaleString("es-AR", {
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })}{" "}
              · {a.status}
            </p>
          </div>
        ))}
      </section>

      <section id="nueva" className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Nueva visita (offline)</h2>
        <form onSubmit={saveVisit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Equipo</span>
            <select
              value={equipmentId}
              onChange={(e) => setEquipmentId(e.target.value)}
              required
              className="input"
            >
              <option value="">Elegí el equipo…</option>
              {equipos.map((e: { id: string; brand: string; model: string }) => (
                <option key={e.id} value={e.id}>
                  {(e.brand ?? "") + " " + (e.model ?? "")}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Tipo de visita</span>
            <select
              value={visitType}
              onChange={(e) => setVisitType(e.target.value)}
              className="input"
            >
              {Object.entries(VISIT_LABELS).map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Diagnóstico</span>
            <textarea
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
              rows={2}
              className="input"
            />
          </label>
          {saveError && <p className="text-sm text-red-600">{saveError}</p>}
          {saved && (
            <p className="text-sm text-green-600">
              Guardado en el equipo. Se sube solo al recuperar señal.
            </p>
          )}
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-zinc-900 px-4 py-3 text-base font-semibold text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {saving ? "Guardando…" : "Guardar visita"}
          </button>
        </form>
      </section>

      <section id="equipos" className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Mis equipos</h2>
        {equipos.length === 0 && (
          <p className="text-sm text-zinc-500">Sin equipos sincronizados todavía.</p>
        )}
        {equipos.map((e: { id: string; brand: string; model: string; location_label: string }) => (
          <div
            key={e.id}
            className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-700"
          >
            <p className="font-medium">
              {e.brand ?? ""} {e.model ?? ""}
            </p>
            {e.location_label && <p className="text-sm text-zinc-500">{e.location_label}</p>}
          </div>
        ))}
      </section>

      <section id="clientes" className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Clientes</h2>
        {clientes.length === 0 && (
          <p className="text-sm text-zinc-500">Sin clientes sincronizados todavía.</p>
        )}
        {clientes.map((c: { id: string; name: string }) => (
          <div
            key={c.id}
            className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-700"
          >
            <p className="font-medium">{c.name}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
