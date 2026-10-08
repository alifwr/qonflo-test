export const ACTORS = [
  "john.doe",
  "jane.smith",
  "budi.santoso",
  "siti.rahma",
] as const;

export type Actor = (typeof ACTORS)[number];

export function isActor(value: unknown): value is Actor {
  return typeof value === "string" && (ACTORS as readonly string[]).includes(value);
}
