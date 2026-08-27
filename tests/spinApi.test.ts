import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { POST as productionSpinPost } from "@/app/api/game/spin/route";
import { spinRequestSchema } from "@/lib/validation/game";

const SESSION_ID = "11111111-1111-4111-8111-111111111111";

describe("production SPIN contract is unchanged", () => {
  it("still accepts only sessionId", () => {
    expect(spinRequestSchema.parse({ sessionId: SESSION_ID })).toEqual({ sessionId: SESSION_ID });
    expect(spinRequestSchema.safeParse({ sessionId: SESSION_ID, action: "reroll" }).success).toBe(true);
    expect(Object.keys(spinRequestSchema.parse({ sessionId: SESSION_ID, franchiseAbbreviation: "BAL" }))).toEqual(
      ["sessionId"],
    );
  });

  it("does not accept a force target on the production spin schema", () => {
    const parsed = spinRequestSchema.parse({
      sessionId: SESSION_ID,
      franchiseAbbreviation: "BAL",
      eraLabel: "2000s",
    });
    expect(parsed).toEqual({ sessionId: SESSION_ID });
    expect("franchiseAbbreviation" in parsed).toBe(false);
  });

  it("uses spinGame rather than removed QA helpers", () => {
    const source = readFileSync(path.join(process.cwd(), "src/app/api/game/spin/route.ts"), "utf8");
    expect(source).toContain("spinGame");
    expect(source).not.toContain("qaRerollSpin");
    expect(source).not.toContain("qaForceSpin");
    expect(productionSpinPost).toEqual(expect.any(Function));
  });
});
