import { getNextTurnState } from "@/lib/combat";

describe("getNextTurnState", () => {
  it("advances turn without incrementing round", () => {
    expect(getNextTurnState(0, 1, 3)).toEqual({ nextTurnIndex: 1, nextRound: 1 });
  });

  it("wraps turn index and increments round", () => {
    expect(getNextTurnState(2, 1, 3)).toEqual({ nextTurnIndex: 0, nextRound: 2 });
  });

  it("handles empty combatant list", () => {
    expect(getNextTurnState(0, 5, 0)).toEqual({ nextTurnIndex: 0, nextRound: 6 });
  });
});
