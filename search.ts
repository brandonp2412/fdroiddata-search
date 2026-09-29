import process from "process";
import boxen from "boxen";
import { parsePageLimit } from "./args";
import { nextCommitUntil, nextPipelineCursor, shouldIncludePipelineTitle } from "./search_helpers";
import { fetchExists, fetchJson } from "./http";
import type {
  GraphQLResponse,
  Pipeline,
  PageInfo,
  Commit,
  RestPipeline,
  MergeRequest,
} from "./interfaces";

const search = process.argv[2]?.toLowerCase();
if (!search) {
  console.error("Usage: bun search.ts MY_APP_NAME [PAGES]");
  process.exit(1);
}
console.log(boxen(`Searching for ${search}...`, { padding: 1 }));

let pages: number;
try {
  pages = parsePageLimit(process.argv[3]);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
const project = encodeURIComponent("fdroid/fdroiddata");
const name = search.split(".").pop()!;

const QUERY = `
  query getPipelines($fullPath: ID!, $first: Int, $after: String) {
    project(fullPath: $fullPath) {
      pipelines(first: $first, after: $after) {
        nodes {
          path
          status
          commit { title }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  }
`;

function show(
  pipe: RestPipeline,
  title: string,
  exactMetadataMatch = false,
) {
  if (!shouldIncludePipelineTitle(title, name, exactMetadataMatch)) return 0;
  console.log(`\n${pipe.web_url}`);
  console.log(`  ${pipe.status} - ${title}`);
  return 1;
}

async function searchCommits() {
  const metadataPath = encodeURIComponent(`metadata/${search}.yml`);
  const metadataExists = await fetchExists(
    `https://gitlab.com/api/v4/projects/${project}/repository/files/${metadataPath}?ref=HEAD`,
  );
  if (!metadataExists) return 0;

  const commits: Commit[] = [];
  const seenCommitIds = new Set<string>();
  const pageSize = 100;
  let until: string | null = null;

  for (;;) {
    const url = new URL(
      `https://gitlab.com/api/v4/projects/${project}/repository/commits`,
    );
    url.searchParams.set("path", `metadata/${search}.yml`);
    url.searchParams.set("per_page", String(pageSize));
    if (until) url.searchParams.set("until", until);

    const batch = await fetchJson<unknown>(url);
    if (!Array.isArray(batch)) {
      throw new Error("GitLab commits response was not an array.");
    }

    const typedBatch = batch as Commit[];
    let newCommitCount = 0;
    for (const commit of typedBatch) {
      if (seenCommitIds.has(commit.id)) continue;
      seenCommitIds.add(commit.id);
      commits.push(commit);
      newCommitCount++;
    }

    const nextUntil = nextCommitUntil(
      typedBatch.length,
      pageSize,
      typedBatch.at(-1)?.committed_date,
      until,
      newCommitCount,
    );
    if (nextUntil === null) break;
    until = nextUntil;
  }

  let found = 0;
  for (let i = 0; i < commits.length; i += 10) {
    const runs = await Promise.all(
      commits.slice(i, i + 10).map(async (commit) => {
        const pipes = await fetchJson<unknown>(
          `https://gitlab.com/api/v4/projects/${project}/pipelines?sha=${encodeURIComponent(commit.id)}`,
        );
        if (!Array.isArray(pipes)) {
          throw new Error("GitLab pipelines response was not an array.");
        }
        return { commit, pipes: pipes as RestPipeline[] };
      }),
    );
    for (const { commit, pipes } of runs) {
      for (const pipe of pipes) {
        found += show(pipe, commit.title, true);
      }
    }
  }

  return found;
}

async function searchMrs() {
  async function fetchMergeRequests(filter: string) {
    const results: MergeRequest[] = [];
    for (let page = 1; ; page++) {
      const batch = await fetchJson<unknown>(
        `https://gitlab.com/api/v4/projects/${project}/merge_requests?${filter}&per_page=100&page=${page}`,
      );
      if (!Array.isArray(batch)) {
        throw new Error("GitLab merge request response was not an array.");
      }
      results.push(...(batch as MergeRequest[]));
      if (batch.length < 100) break;
    }
    return results;
  }

  const [branchMatches, textMatches] = await Promise.all([
    fetchMergeRequests(`source_branch=${encodeURIComponent(search)}`),
    fetchMergeRequests(`search=${encodeURIComponent(search)}`),
  ]);

  const candidates = new Map<
    number,
    { mr: MergeRequest; exactPackageMatch: boolean }
  >();
  for (const mr of branchMatches) {
    candidates.set(mr.iid, { mr, exactPackageMatch: true });
  }
  for (const mr of textMatches) {
    if (!candidates.has(mr.iid)) {
      candidates.set(mr.iid, { mr, exactPackageMatch: false });
    }
  }

  const mrs = [...candidates.values()];
  let found = 0;
  for (let i = 0; i < mrs.length; i += 10) {
    const runs = await Promise.all(
      mrs.slice(i, i + 10).map(async ({ mr, exactPackageMatch }) => {
        const pipes = await fetchJson<unknown>(
          `https://gitlab.com/api/v4/projects/${project}/merge_requests/${mr.iid}/pipelines`,
        );
        if (!Array.isArray(pipes)) {
          throw new Error("GitLab merge request pipelines response was not an array.");
        }
        return { mr, pipes: pipes as RestPipeline[], exactPackageMatch };
      }),
    );
    for (const { mr, pipes, exactPackageMatch } of runs) {
      for (const pipe of pipes) {
        found += show(pipe, mr.title, exactPackageMatch);
      }
    }
  }

  return found;
}

async function searchTitles() {
  let cursor: string | null = null;
  let found = 0;

  for (let i = 0; i < pages; i++) {
    const json: GraphQLResponse = await fetchJson<GraphQLResponse>("https://gitlab.com/api/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: QUERY,
        variables: {
          fullPath: "fdroid/fdroiddata",
          first: 100,
          after: cursor,
        },
      }),
    });

    const pipelines: { nodes: Pipeline[]; pageInfo: PageInfo } | undefined =
      json.data?.project?.pipelines;
    if (!pipelines) {
      throw new Error("GitLab GraphQL response did not include pipeline data.");
    }
    const nodes: Pipeline[] = pipelines.nodes;
    const pageInfo: PageInfo = pipelines.pageInfo;

    for (const pipeline of nodes) {
      if (!pipeline.commit.title.toLowerCase().includes(search)) continue;
      found++;
      console.log(`\nhttps://gitlab.com${pipeline.path}`);
      console.log(`  ${pipeline.status.toLowerCase()} - ${pipeline.commit.title}`);
    }

    cursor = nextPipelineCursor(pageInfo.hasNextPage, pageInfo.endCursor, cursor);
    if (cursor === null) break;
  }

  return found;
}

try {
  const total = search.includes(".")
    ? (await searchCommits()) + (await searchMrs())
    : await searchTitles();
  if (total === 0) console.log("\nNo results found.");
  process.exit(0);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
