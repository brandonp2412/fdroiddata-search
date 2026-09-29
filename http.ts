export async function fetchJson<T>(
  input: string | URL | Request,
  init?: RequestInit,
  timeoutMs = 45_000,
  maxAttempts = 3,
): Promise<T> {
  const method =
    (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
  const canRetry = method === "GET" || method === "HEAD";

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const timeoutSignal = AbortSignal.timeout(timeoutMs);
    const signal = init?.signal
      ? AbortSignal.any([init.signal, timeoutSignal])
      : timeoutSignal;

    let response: Response;
    try {
      response = await fetch(input, { ...init, signal });
    } catch (error) {
      if (init?.signal?.aborted) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`GitLab request failed: ${message}`);
      }

      if (canRetry && attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** (attempt - 1)));
        continue;
      }

      if (timeoutSignal.aborted) {
        throw new Error(`GitLab request timed out after ${timeoutMs}ms.`);
      }
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`GitLab request failed: ${message}`);
    }

    if (!response.ok) {
      const detail = (await response.text()).trim().replace(/\s+/g, " ").slice(0, 200);
      const retryableStatus =
        response.status === 429 || (response.status >= 500 && response.status <= 599);
      if (canRetry && retryableStatus && attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** (attempt - 1)));
        continue;
      }
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

  throw new Error("GitLab request failed after exhausting retries.");
}


export async function fetchExists(
  input: string | URL | Request,
  timeoutMs = 45_000,
  maxAttempts = 3,
): Promise<boolean> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const timeoutSignal = AbortSignal.timeout(timeoutMs);

    let response: Response;
    try {
      response = await fetch(input, { method: "HEAD", signal: timeoutSignal });
    } catch (error) {
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** (attempt - 1)));
        continue;
      }
      if (timeoutSignal.aborted) {
        throw new Error(`GitLab request timed out after ${timeoutMs}ms.`);
      }
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`GitLab request failed: ${message}`);
    }

    if (response.status === 404) return false;
    if (response.ok) return true;

    const retryableStatus =
      response.status === 429 || (response.status >= 500 && response.status <= 599);
    if (retryableStatus && attempt < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** (attempt - 1)));
      continue;
    }
    throw new Error(`GitLab request failed with HTTP ${response.status}`);
  }

  throw new Error("GitLab request failed after exhausting retries.");
}
