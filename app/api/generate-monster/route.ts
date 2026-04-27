import { NextResponse } from "next/server";

const MOCK_NAMES = [
  "Grimfang the Mirelurker",
  "Sylvaris Moonwhisper",
  "Thokk Ironjaw",
  "Vex Shadowmere",
  "Bruma Frosthorn",
] as const;

function randomIntInclusive(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * ---------------------------------------------------------------------------
 * FUTURE: Vercel AI SDK `generateObject` (or similar) integration point
 * ---------------------------------------------------------------------------
 * Replace the mock logic below (delay + random name + random maxHp) with:
 *
 *   import { generateObject } from "ai";
 *   import { openai } from "@ai-sdk/openai"; // or your provider
 *   import { z } from "zod";
 *
 *   const { object } = await generateObject({
 *     model: openai("gpt-4o-mini"),
 *     schema: z.object({ name: z.string(), maxHp: z.number().min(1).max(999) }),
 *     prompt: "...",
 *   });
 *
 * Then return NextResponse.json({ name: object.name, maxHp: object.maxHp }).
 * Keep this route as POST-only if the SDK call stays server-side.
 * ---------------------------------------------------------------------------
 */
export async function POST() {
  await new Promise((resolve) => setTimeout(resolve, 2000));

  const name = MOCK_NAMES[Math.floor(Math.random() * MOCK_NAMES.length)]!;
  const maxHp = randomIntInclusive(20, 100);

  return NextResponse.json({ name, maxHp });
}
