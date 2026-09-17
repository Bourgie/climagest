"use client";

import { useState, useRef } from "react";

interface DashboardFiltersProps {
  period: string;
  from: string;
  to: string;
  technicianId: string;
  branchId: string;
  techList: any[];
  branchList: any[];
  setPeriod: (period: string) => void;
  setFrom: (from: string) => void;
  setTo: (to: string) => void;
  setTechnicianId: (technicianId: string) => void;
  setBranchId: (branchId: string) => void;
}

export function DashboardFilters({ period, from, to, technicianId, branchId, techList, branchList, setPeriod, setFrom, setTo, setTechnicianId, setBranchId }: DashboardFiltersProps) {
  // Stable onChange handlers via useRef - don't change between renders
  const onPeriodChange = useRef((e) => {
    setPeriod(e.target.value);
  }).current;

  const onFromChange = useRef((e) => {
    setFrom(e.target.value);
  }).current;

  const onToChange = useRef((e) => {
    setTo(e.target.value);
  }).current;

  const onTechnicianIdChange = useRef((e) => {
    setTechnicianId(e.target.value);
  }).current;

  const onBranchIdChange = useRef((e) => {
    setBranchId(e.target.value);
  }).current;

  return (
    <div className="flex flex-wrap gap-3">
      <form className="flex flex-wrap gap-2 items-end">
        <input type="hidden" name="period" value={period} />
        {from && <input type="hidden" name="from" value={from} />}
        {to && <input type="hidden" name="to" value={to} />}
        {technicianId && <input type="hidden" name="technicianId" value={technicianId} />}
        {branchId && <input type="hidden" name="branchId" value={branchId} />}

        <div className="flex items-center gap-2">
          <label className="text-sm text-zinc-600 dark:text-zinc-400">Período</label>
          <select name="period" value={period} onChange={onPeriodChange} className="rounded-md border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900">
            <option value="today" selected={period === "today"}>Hoy</option>
            <option value="week" selected={period === "week"}>Esta semana</option>
            <option value="month" selected={period === "month"}>Este mes</option>
            <option value="custom" selected={period === "custom"}>Personalizado</option>
          </select>
        </div>

        {period === "custom" && (
          <>
            <label className="text-sm text-zinc-600 dark:text-zinc-400">Desde</label>
            <input type="date" name="from" value={from ?? ""} onChange={onFromChange} className="rounded-md border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900" />
            <label className="text-sm text-zinc-600 dark:text-zinc-400">Hasta</label>
            <input type="date" name="to" value={to ?? ""} onChange={onToChange} className="rounded-md border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900" />
          </>
        )}

        {techList.length > 0 && (
          <div className="flex items-center gap-2">
            <label className="text-sm text-zinc-600 dark:text-zinc-400">Técnico</label>
            <select name="technicianId" onChange={onTechnicianIdChange} className="rounded-md border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900">
              <option value="">Todos</option>
              {techList.map(t => (<option key={t.id} value={t.id} selected={technicianId === t.id}>{t.name}</option>))}
            </select>
          </div>
        )}

        {branchList.length > 0 && (
          <div className="flex items-center gap-2">
            <label className="text-sm text-zinc-600 dark:text-zinc-400">Sucursal</label>
            <select name="branchId" onChange={onBranchIdChange} className="rounded-md border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900">
              <option value="">Todas</option>
              {branchList.map(b => (<option key={b.id} value={b.id} selected={branchId === b.id}>{b.name}</option>))}
            </select>
          </div>
        )}
      </form>
    </div>
  );
}