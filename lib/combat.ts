export function getNextTurnState(currentTurnIndex: number, currentRound: number, combatantCount: number) {
  const safeCount = Math.max(combatantCount, 1);
  const nextTurnIndex = (currentTurnIndex + 1) % safeCount;
  const nextRound = nextTurnIndex === 0 ? currentRound + 1 : currentRound;
  return { nextTurnIndex, nextRound };
}
