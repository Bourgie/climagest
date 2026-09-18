"use client";

import { useState, useRef } from "react";

type Period = "today" | "week" | "month" | "custom";

type Technician = { id: string; name: string };
type Branch = { id: string; name: string };

export function DashboardFilters({
  period,
  from,
  to,
  technicianId,
  branchId,
  techList,
  branchList,
}: {
  period: Period;
  from?: string;
  to?: string;
  technicianId?: string;
  branchId?: string;
  techList: Technician[];
  branchList: Branch[];
}) {
  // Stable onChange handlers via useRef - don't change between renders
  const onPeriodChange = useRef<(e: React.ChangeEvent<HTMLSelectElement>) => void>((e) => {
    // Get the form and submit it
    const form = e.currentTarget.form;
    if (form) form.submit();
  }).current;

  const onFromChange = useRef<(e: React.ChangeEvent<HTMLInputElement>) => void>((e) => {
    const form = e.currentTarget.form;
    if (form) form.submit();
  }).current;

  const onToChange = useRef<(e: React.ChangeEvent<HTMLInputElement>) => void>((e) => {
    const form = e.currentTarget.form;
    if (form) form.submit();
  }).current;

  const onTechnicianIdChange = useRef<(e: React.ChangeEvent<HTMLSelectElement>) => void>((e) => {
    const form = e.currentTarget.form;
    if (form) form.submit();
  }).current;

  const onBranchIdChange = useRef<(e: React.ChangeEvent<HTMLSelectElement>) => void>((e) => {
    const form = e.currentTarget.form;
    if (form) form.submit();
  }).current;

  return (
    <form action="/" method="get" className="flex flex-wrap gap-2 items-end">
      <input type="hidden" name="period" value={period} />
      {from && <input type="hidden" name="from" value={from} />}
      {to && <input type="hidden" name="to" value={to} />}
      {technicianId && <input type="hidden" name="technicianId" value={technicianId} />}
      {branchId && <input type="hidden" name="branchId" value={branchId} />}

      <div className="flex items-center gap-2">
        <label className="text-sm text-zinc-600 dark:text-zinc-400">Período</label>
        <select
          name="period"
          defaultValue={period}
          onChange={onPeriodChange}
          className="rounded-md border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="today">Hoy</option>
          <option value="week">Esta semana</option>
          <option value="month">Este mes</option>
          <option value="custom">Personalizado</option>
        </select>
      </div>

      {period === "custom" && (
        <>
          <label className="text-sm text-zinc-600 dark:text-zinc-400">Desde</label>
          <input
            type="date"
            name="from"
            defaultValue={from ?? ""}
            onChange={onFromChange}
            className="rounded-md border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
          <label className="text-sm text-zinc-600 dark:text-zinc-400">Hasta</label>
          <input
            type="date"
            name="to"
            defaultValue={to ?? ""}
            onChange={onToChange}
            className="rounded-md border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </>
      )}

      {techList.length > 0 && (
        <div className="flex items-center gap-2">
          <label className="text-sm text-zinc-600 dark:text-zinc-400">Técnico</label>
          <select
            name="technicianId"
            defaultValue={technicianId ?? ""}
            onChange={onTechnicianIdChange}
            className="rounded-md border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="">Todos</option>
            {techList.map(t => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {branchList.length > 0 && (
        <div className="flex items-center gap-2">
          <label className="text-sm text-zinc-600 dark:text-zinc-400">Sucursal</label>
          <select
            name="branchId"
            defaultValue={branchId ?? ""}
            onChange={onBranchIdChange}
            className="rounded-md border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="">Todas</option>
            {branchList.map(b => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      )}
    </form>
  );
}