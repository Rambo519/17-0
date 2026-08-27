import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { POST as qaSpinPost } from "@/app/api/game/qa-spin/route";
import { POST as productionSpinPost } from "@/app/api/game/spin/route";
import { isDevelopmentQaEnabled } from "@/lib/game/qaAccess";
import { qaSpinRequestSchema, spinRequestSchema } from "@/lib/validation/game";

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
});

describe("qa-spin request schema", () => {
  it("requires an explicit development action", () => {
    expect(qaSpinRequestSchema.parse({ action: "reroll", sessionId: SESSION_ID })).toEqual({
      action: "reroll",
      sessionId: SESSION_ID,
    });
    expect(
      qaSpinRequestSchema.parse({
        action: "force",
        sessionId: SESSION_ID,
        franchiseAbbreviation: "BAL",
        eraLabel: "2000s",
      }),
    ).toMatchObject({ action: "force", franchiseAbbreviation: "BAL", eraLabel: "2000s" });
    expect(qaSpinRequestSchema.safeParse({ sessionId: SESSION_ID }).success).toBe(false);
  });
});

describe("qa-spin HTTP production guard", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("returns 404 in production and never spins", async () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(isDevelopmentQaEnabled()).toBe(false);

    const response = await qaSpinPost(
      new Request("http://localhost/api/game/qa-spin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "force",
          sessionId: SESSION_ID,
          franchiseAbbreviation: "BAL",
          eraLabel: "2000s",
        }),
      }),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "NOT_FOUND" } });
  });
});

describe("production /api/game/spin route source", () => {
  it("still uses spinGame rather than the QA helpers", () => {
    const source = readFileSync(path.join(process.cwd(), "src/app/api/game/spin/route.ts"), "utf8");
    expect(source).toContain("spinGame");
    expect(source).not.toContain("qaRerollSpin");
    expect(source).not.toContain("qaForceSpin");
    expect(productionSpinPost).toEqual(expect.any(Function));
  });

  it("keeps a compile-time production guard on the QA controls and API", () => {
    const controls = readFileSync(path.join(process.cwd(), "src/components/game/QaControls.tsx"), "utf8");
    const route = readFileSync(path.join(process.cwd(), "src/app/api/game/qa-spin/route.ts"), "utf8");
    expect(controls).toContain('process.env.NODE_ENV === "production"');
    expect(route).toContain("isDevelopmentQaEnabled");
    expect(route).toContain("status: 404");
  });
});
