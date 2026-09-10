export function shouldIncludePipelineTitle(
  title: string,
  needle: string,
  exactMetadataMatch = false,
): boolean {
  return exactMetadataMatch || title.toLowerCase().includes(needle.toLowerCase());
}

export function nextPipelineCursor(
  hasNextPage: boolean,
  endCursor: string | null | undefined,
  currentCursor: string | null,
): string | null {
  if (!hasNextPage) return null;
  if (!endCursor || endCursor === currentCursor) {
    throw new Error("GitLab pipeline pagination did not advance.");
  }
  return endCursor;
}
