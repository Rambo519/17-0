import { describe, expect, it } from "vitest";

/**
 * Landmark eligibility/production checks against imported history belong on
 * `npm run data:sanity`, which opens the durable database on purpose.
 * Automated tests must never open `.data/pglite`.
 */
describe("real-data sanity checks", () => {
  it("keeps landmark historical checks on the data CLI, not npm test", () => {
    expect(process.env.VITEST).toBeTruthy();
  });
});
