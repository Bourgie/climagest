"use client";

import React, { Suspense } from "react";
import { PowerSyncContext } from "@powersync/react";
import { PowerSyncDatabase } from "@powersync/web";
import { AppSchema } from "@/lib/powersync/schema";
import { BackendConnector } from "@/lib/powersync/connector";

let dbInstance: PowerSyncDatabase | null = null;

function getDB(): PowerSyncDatabase {
  if (dbInstance) return dbInstance;

  dbInstance = new PowerSyncDatabase({
    schema: AppSchema,
    database: {
      dbFilename: "aire-tecnico.sqlite",
    },
    // Worker pre-bundeado en public/@powersync/ (postinstall).
    // Requerido con Turbopack, que no soporta dynamic import de workers.
    sync: { worker: "/@powersync/worker.js" },
  });

  void dbInstance.connect(new BackendConnector()).catch((e) => {
    console.error("PowerSync connect:", e);
  });
  return dbInstance;
}

/**
 * Límite cliente del SDK (el Web SDK requiere APIs del navegador; en SSR es
 * no-op). El layout raíz sigue siendo Server Component.
 */
export function PowerSyncProvider({ children }: { children: React.ReactNode }) {
  return (
    <Suspense>
      <PowerSyncContext.Provider value={getDB()}>{children}</PowerSyncContext.Provider>
    </Suspense>
  );
}
