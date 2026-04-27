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
 * Replace the mock logic below (delay + random stats) with:
 *
 *   import { generateObject } from "ai";
 *   import { openai } from "@ai-sdk/openai"; // or your provider
 *   import { z } from "zod";
 *
 *   const { object } = await generateObject({
 *     model: openai("gpt-4o-mini"),
 *     schema: z.object({
 *       name: z.string(),
 *       maxHp: z.number().min(1).max(999),
 *       initiative: z.number(),
 *       ac: z.number().min(0),
 *     }),
 *     prompt: "...",
 *   });
 *
 * Then return NextResponse.json({
 *   name: object.name,
 *   maxHp: object.maxHp,
 *   initiative: object.initiative,
 *   ac: object.ac,
 * }).
 * Keep this route as POST-only if the SDK call stays server-side.
 * ---------------------------------------------------------------------------
 */
export async function POST() {
  await new Promise((resolve) => setTimeout(resolve, 2000));

  const name = MOCK_NAMES[Math.floor(Math.random() * MOCK_NAMES.length)]!;
  const maxHp = randomIntInclusive(20, 100);
  const initiative = randomIntInclusive(1, 20);
  const ac = randomIntInclusive(10, 22);

  return NextResponse.json({ name, maxHp, initiative, ac });
}
