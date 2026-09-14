"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NotificationBell } from "@/components/ui/NotificationBell";
import { LogoutButton } from "@/app/logout-button";
import { Menu, X, Search } from "lucide-react";
import { useState } from "react";

type NavItem = {
  href: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  admin?: boolean;
  owner?: boolean;
};

const navItems: NavItem[] = [
  { href: "/buscar", label: "Buscar", icon: Search },
  { href: "/clientes", label: "Clientes" },
  { href: "/equipos", label: "Equipos" },
  { href: "/pedidos", label: "Pedidos" },
  { href: "/presupuestos", label: "Presupuestos" },
  { href: "/agenda", label: "Agenda" },
  { href: "/ordenes", label: "Órdenes" },
  { href: "/cuenta-corriente", label: "Cta. Cte." },
  { href: "/tecnico", label: "App técnico" },
  { href: "/config/usuarios", label: "Usuarios", admin: true },
  { href: "/config/permisos", label: "Permisos", owner: true },
];

export function Header({ user }: { user: { role: string; isSuperuser: boolean; companyId?: string } }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  const visible = navItems.filter((item) => {
    if (user.isSuperuser) return false;
    if (item.admin && user.role !== "owner" && user.role !== "admin") return false;
    if (item.owner && user.role !== "owner") return false;
    if (item.href === "/tecnico" && user.role !== "technician") return false;
    if (item.href === "/config/usuarios" && user.role !== "owner" && user.role !== "admin") return false;
    return true;
  });

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/80 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-950/80">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <Link href="/" className="font-semibold text-zinc-900 dark:text-white">
            ClimaGest
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {visible.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  pathname === item.href || pathname.startsWith(item.href + "/")
                    ? "bg-zinc-900 text-white"
                    : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                }`}
              >
                {item.icon && <item.icon className="mr-1.5 h-4 w-4" />}
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {!user.isSuperuser && <NotificationBell />}
          <LogoutButton />
          <button
            className="md:hidden rounded-md p-2 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? "Cerrar menú" : "Abrir menú"}
          >
            {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-zinc-200 py-3 dark:border-zinc-800">
          <nav className="mx-auto flex max-w-7xl flex-col gap-1 px-4">
            {visible.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`rounded-md px-3 py-2 text-sm font-medium ${
                  pathname === item.href || pathname.startsWith(item.href + "/")
                    ? "bg-zinc-900 text-white"
                    : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}