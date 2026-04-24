import {
  applyDamage,
  applyHeal,
  applyTempHpRule,
  isMinionName,
  shouldDeleteMinionAtZero,
} from "@/lib/combatHealth"

describe("isMinionName", () => {
  it("matches numbered suffix", () => {
    expect(isMinionName("Goblin (3)")).toBe(true)
    expect(isMinionName("Orc (12)")).toBe(true)
  })

  it("rejects unique names", () => {
    expect(isMinionName("Strahd")).toBe(false)
    expect(isMinionName("Goblin (x)")).toBe(false)
    expect(isMinionName("Thing (3a)")).toBe(false)
  })
})

describe("applyHeal", () => {
  it("caps at max HP", () => {
    expect(applyHeal(8, 10, 5)).toBe(10)
    expect(applyHeal(10, 10, 5)).toBe(10)
  })

  it("ignores negative heal", () => {
    expect(applyHeal(5, 10, -3)).toBe(5)
  })
})

describe("applyTempHpRule", () => {
  it("takes max of existing and new", () => {
    expect(applyTempHpRule(5, 3)).toBe(5)
    expect(applyTempHpRule(3, 8)).toBe(8)
  })
})

describe("applyDamage", () => {
  it("consumes temp first", () => {
    expect(applyDamage(10, 5, 3)).toEqual({ hp_current: 10, temp_hp: 2 })
  })

  it("overflows to HP after temp is gone", () => {
    expect(applyDamage(10, 4, 7)).toEqual({ hp_current: 7, temp_hp: 0 })
  })

  it("handles zero damage", () => {
    expect(applyDamage(10, 5, 0)).toEqual({ hp_current: 10, temp_hp: 5 })
  })
})

describe("shouldDeleteMinionAtZero", () => {
  it("is true only for minions at 0 HP", () => {
    expect(shouldDeleteMinionAtZero(0, "Goblin (1)")).toBe(true)
    expect(shouldDeleteMinionAtZero(0, "Boss")).toBe(false)
    expect(shouldDeleteMinionAtZero(1, "Goblin (1)")).toBe(false)
  })
})
