import { describe, expect, it } from "vitest";

import { NEW_GAME_CONFIRM_MESSAGE, shouldConfirmNewGame } from "@/lib/game/newGame";

describe("new game confirmation", () => {
  it("does not confirm when no picks have been made", () => {
    expect(shouldConfirmNewGame(0)).toBe(false);
  });

  it("confirms once at least one pick exists", () => {
    expect(shouldConfirmNewGame(1)).toBe(true);
    expect(shouldConfirmNewGame(6)).toBe(true);
    expect(NEW_GAME_CONFIRM_MESSAGE).toBe("Start a new game? Current picks will be cleared.");
  });
});
