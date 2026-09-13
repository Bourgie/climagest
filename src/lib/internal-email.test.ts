import { describe, expect, it } from "vitest";

import { buildInternalEmail } from "./internal-email";

describe("buildInternalEmail", () => {
  it("construye el email sintético determinístico", () => {
    expect(buildInternalEmail("juan", "DEMO")).toBe(
      "juan+demo@internal.app",
    );
  });

  it("normaliza username y company_code a minúsculas", () => {
    expect(buildInternalEmail("Juan", "DEMO")).toBe("juan+demo@internal.app");
  });
});
