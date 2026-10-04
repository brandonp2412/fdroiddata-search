export function metadataPathForPackageId(packageId: string): string {
  return `metadata/${packageId}.yml`;
}

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


export function nextCommitUntil(
  batchLength: number,
  pageSize: number,
  lastCommittedDate: string | undefined,
  currentUntil: string | null,
  newCommitCount: number,
): string | null {
  if (batchLength < pageSize) return null;
  if (
    !lastCommittedDate ||
    (lastCommittedDate === currentUntil && newCommitCount === 0)
  ) {
    throw new Error("GitLab commit pagination did not advance.");
  }
  return lastCommittedDate;
}
