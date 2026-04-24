/** Names like `Goblin (3)` — minions are removed at 0 HP. */
export function isMinionName(name: string): boolean {
  return /\(\d+\)\s*$/.test(name.trim())
}

export function applyHeal(hpCurrent: number, hpMax: number, amount: number): number {
  const heal = Math.max(0, amount)
  return Math.min(hpMax, hpCurrent + heal)
}

/** Temp HP does not stack: new value is max(existing, requested). */
export function applyTempHpRule(existingTemp: number, enteredValue: number): number {
  return Math.max(existingTemp, Math.max(0, enteredValue))
}

/** Set temp HP to exactly this value (≥ 0), even when lower than the current pool. */
export function applyTempHpOverride(enteredValue: number): number {
  return Math.max(0, enteredValue)
}

/** Damage applies to temp HP first; overflow reduces current HP (not below 0). */
export function applyDamage(
  hpCurrent: number,
  tempHp: number,
  damage: number
): { hp_current: number; temp_hp: number } {
  const dmg = Math.max(0, damage)
  const fromTemp = Math.min(tempHp, dmg)
  const newTemp = tempHp - fromTemp
  const remainder = dmg - fromTemp
  const newHp = Math.max(0, hpCurrent - remainder)
  return { hp_current: newHp, temp_hp: newTemp }
}

export function shouldDeleteMinionAtZero(hpCurrent: number, name: string): boolean {
  return hpCurrent === 0 && isMinionName(name)
}
