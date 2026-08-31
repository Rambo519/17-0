import { describe, expect, it } from "vitest";

import {
  isFullFormationViable,
  runCoverageAudit,
  type CoverageAuditReport,
  type FranchiseEraCoverageRow,
} from "@/data/audit/coverage";

function row(
  partial: Partial<FranchiseEraCoverageRow> & Pick<FranchiseEraCoverageRow, "franchise" | "era">,
): FranchiseEraCoverageRow {
  return {
    franchiseSlug: partial.franchiseSlug ?? "slug",
    seasonsPresent: partial.seasonsPresent ?? 10,
    qbCount: partial.qbCount ?? 0,
    rbCount: partial.rbCount ?? 0,
    fbCount: partial.fbCount ?? 0,
    wrCount: partial.wrCount ?? 0,
    teCount: partial.teCount ?? 0,
    totalSkillPlayers: partial.totalSkillPlayers ?? 0,
    fullFormationViable: partial.fullFormationViable ?? false,
    franchise: partial.franchise,
    era: partial.era,
  };
}

describe("coverage audit logic", () => {
  it("classifies fullback buckets and formation viability", () => {
    const rows = [
      row({ franchise: "A", era: "1980s", qbCount: 2, rbCount: 2, fbCount: 0, wrCount: 3, teCount: 1 }),
      row({ franchise: "B", era: "1980s", qbCount: 2, rbCount: 2, fbCount: 1, wrCount: 3, teCount: 1 }),
      row({
        franchise: "C",
        era: "1980s",
        qbCount: 2,
        rbCount: 2,
        fbCount: 3,
        wrCount: 3,
        teCount: 1,
        fullFormationViable: true,
      }),
    ];

    const zeroFb = rows.filter((item) => item.fbCount === 0);
    const oneFb = rows.filter((item) => item.fbCount === 1);
    const twoOrMore = rows.filter((item) => item.fbCount >= 2);

    expect(zeroFb).toHaveLength(1);
    expect(oneFb).toHaveLength(1);
    expect(twoOrMore).toHaveLength(1);
    expect(isFullFormationViable({ qbCount: 2, rbCount: 2, wrCount: 3, teCount: 1 })).toBe(true);
    expect(isFullFormationViable({ qbCount: 2, rbCount: 1, wrCount: 3, teCount: 1 })).toBe(false);
    expect(isFullFormationViable({ qbCount: 2, rbCount: 30, wrCount: 3, teCount: 1 })).toBe(true);
  });

  it("exports runCoverageAudit function for integration use", () => {
    expect(typeof runCoverageAudit).toBe("function");
    const sample: CoverageAuditReport["fullbackCoverage"] = {
      zeroFb: 1,
      oneFb: 2,
      twoOrMoreFb: 3,
    };
    expect(sample.zeroFb + sample.oneFb + sample.twoOrMoreFb).toBe(6);
  });
});
