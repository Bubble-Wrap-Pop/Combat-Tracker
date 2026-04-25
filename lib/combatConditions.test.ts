import {
  normalizeConditions,
  toggleSuggestedCondition,
  conditionKey,
} from "@/lib/combatConditions";

describe("normalizeConditions", () => {
  it("returns empty for nullish", () => {
    expect(normalizeConditions(null)).toEqual([]);
    expect(normalizeConditions(undefined)).toEqual([]);
  });

  it("parses string array", () => {
    expect(normalizeConditions([" Prone ", "Stunned", ""])).toEqual(["Prone", "Stunned"]);
  });

  it("dedupes case-insensitively", () => {
    expect(normalizeConditions(["Poisoned", "poisoned", "POISONED"])).toEqual(["Poisoned"]);
  });

  it("parses JSON string of array", () => {
    expect(normalizeConditions('["Grappled","Restrained"]')).toEqual(["Grappled", "Restrained"]);
  });

  it("treats non-array JSON as single entry", () => {
    expect(normalizeConditions('"foo"')).toEqual(["foo"]);
  });

  it("treats plain string as single condition when not JSON", () => {
    expect(normalizeConditions("Slowed")).toEqual(["Slowed"]);
  });

  it("ignores non-array non-string", () => {
    expect(normalizeConditions({ foo: 1 })).toEqual([]);
  });
});

describe("toggleSuggestedCondition", () => {
  it("adds when absent", () => {
    expect(toggleSuggestedCondition([], "Prone")).toEqual(["Prone"]);
  });

  it("removes when present case-insensitively", () => {
    expect(toggleSuggestedCondition(["prone"], "Prone")).toEqual([]);
  });
});

describe("conditionKey", () => {
  it("lowercases trimmed", () => {
    expect(conditionKey("  Frightened ")).toBe("frightened");
  });
});
