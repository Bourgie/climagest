import { describe, expect, it } from "vitest";

import { isCompanyLoginBlocked, resolvePermission } from "./auth-logic";

const owner = { isSuperuser: false, companyId: "c1", role: "owner" };
const admin = { isSuperuser: false, companyId: "c1", role: "admin" };
const superuser = { isSuperuser: true, companyId: null, role: null };
const noCompany = { isSuperuser: false, companyId: null, role: "admin" };

describe("resolvePermission", () => {
  it("superusuario tiene todo (bypass)", () => {
    expect(resolvePermission(superuser, false)).toBe(true);
  });

  it("sin empresa o rol deniega", () => {
    expect(resolvePermission(noCompany, true)).toBe(false);
  });

  it("respeta allowed=true", () => {
    expect(resolvePermission(admin, true)).toBe(true);
  });

  it("respeta allowed=false", () => {
    expect(resolvePermission(admin, false)).toBe(false);
  });

  it("permiso ausente deniega por defecto", () => {
    expect(resolvePermission(owner, undefined)).toBe(false);
  });
});

describe("isCompanyLoginBlocked", () => {
  it("suspended y blocked bloquean", () => {
    expect(isCompanyLoginBlocked("suspended")).toBe(true);
    expect(isCompanyLoginBlocked("blocked")).toBe(true);
  });

  it("active y trial no bloquean", () => {
    expect(isCompanyLoginBlocked("active")).toBe(false);
    expect(isCompanyLoginBlocked("trial")).toBe(false);
  });
});
