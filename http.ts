export async function fetchJson<T>(
  input: string | URL | Request,
  init?: RequestInit,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(input, init);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`GitLab request failed: ${message}`);
  }

  if (!response.ok) {
    const detail = (await response.text()).trim().replace(/\s+/g, " ").slice(0, 200);
    throw new Error(
      `GitLab request failed with HTTP ${response.status}${detail ? `: ${detail}` : ""}`,
    );
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new Error(`GitLab returned invalid JSON (HTTP ${response.status}).`);
  }
}
