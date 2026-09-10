export function shouldIncludePipelineTitle(
  title: string,
  needle: string,
  exactMetadataMatch = false,
): boolean {
  return exactMetadataMatch || title.toLowerCase().includes(needle.toLowerCase());
}
