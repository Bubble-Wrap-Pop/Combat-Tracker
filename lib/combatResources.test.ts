import {
  applyLongRestRecharge,
  applyShortRestRecharge,
  normalizeResources,
  removeResource,
  upsertResource,
  type CombatResource,
} from "@/lib/combatResources";

const sample: CombatResource[] = [
  { id: "a", name: "Ki", current: 1, max: 4, recharge: "short_rest" },
  { id: "b", name: "Rage", current: 0, max: 3, recharge: "long_rest" },
  { id: "c", name: "Action Surge", current: 0, max: 1, recharge: "manual" },
];

describe("normalizeResources", () => {
  it("returns [] for nullish and junk", () => {
    expect(normalizeResources(null)).toEqual([]);
    expect(normalizeResources(undefined)).toEqual([]);
    expect(normalizeResources({})).toEqual([]);
    expect(normalizeResources("nope")).toEqual([]);
  });

  it("normalizes from array, clamps values, and dedupes ids", () => {
    const raw = [
      { id: "a", name: " Ki ", current: 8, max: 4, recharge: "short_rest" },
      { id: "a", name: "dup", current: 1, max: 1, recharge: "manual" },
      { id: "b", name: "Rage", current: -3, max: 2, recharge: "long_rest" },
      { id: "c", name: "Thing", current: 1, max: 3, recharge: "bad" },
    ];
    expect(normalizeResources(raw)).toEqual([
      { id: "a", name: "Ki", current: 4, max: 4, recharge: "short_rest" },
      { id: "b", name: "Rage", current: 0, max: 2, recharge: "long_rest" },
      { id: "c", name: "Thing", current: 1, max: 3, recharge: "manual" },
    ]);
  });

  it("parses JSON string list", () => {
    const raw = JSON.stringify([{ id: "x", name: "Luck", current: 2, max: 3, recharge: "manual" }]);
    expect(normalizeResources(raw)).toEqual([{ id: "x", name: "Luck", current: 2, max: 3, recharge: "manual" }]);
  });
});

describe("upsertResource", () => {
  it("adds when missing", () => {
    const added = upsertResource(sample, { id: "d", name: "Sorcery", current: 2, max: 5, recharge: "long_rest" });
    expect(added.find((x) => x.id === "d")).toEqual({
      id: "d",
      name: "Sorcery",
      current: 2,
      max: 5,
      recharge: "long_rest",
    });
  });

  it("replaces by id when present", () => {
    const updated = upsertResource(sample, { id: "a", name: "Ki", current: 2, max: 4, recharge: "short_rest" });
    expect(updated.find((x) => x.id === "a")?.current).toBe(2);
    expect(updated).toHaveLength(3);
  });
});

describe("removeResource", () => {
  it("removes by id", () => {
    expect(removeResource(sample, "b").map((x) => x.id)).toEqual(["a", "c"]);
  });
});

describe("recharge helpers", () => {
  it("short rest recharges short-rest resources only", () => {
    expect(applyShortRestRecharge(sample)).toEqual([
      { id: "a", name: "Ki", current: 4, max: 4, recharge: "short_rest" },
      { id: "b", name: "Rage", current: 0, max: 3, recharge: "long_rest" },
      { id: "c", name: "Action Surge", current: 0, max: 1, recharge: "manual" },
    ]);
  });

  it("long rest recharges short + long rest resources", () => {
    expect(applyLongRestRecharge(sample)).toEqual([
      { id: "a", name: "Ki", current: 4, max: 4, recharge: "short_rest" },
      { id: "b", name: "Rage", current: 3, max: 3, recharge: "long_rest" },
      { id: "c", name: "Action Surge", current: 0, max: 1, recharge: "manual" },
    ]);
  });
});

