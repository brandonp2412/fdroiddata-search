export function parsePageLimit(value: string | undefined): number {
  if (value === undefined) return 50;

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error("PAGES must be a positive integer.");
  }

  return parsed;
}
