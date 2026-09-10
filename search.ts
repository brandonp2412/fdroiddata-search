import process from "process";
import boxen from "boxen";
import { parsePageLimit } from "./args";
import { shouldIncludePipelineTitle } from "./search_helpers";
import { fetchJson } from "./http";
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
  const commits: Commit[] = [];
  const metadataPath = encodeURIComponent(`metadata/${search}.yml`);
  for (let page = 1; ; page++) {
    const batch = await fetchJson<unknown>(
      `https://gitlab.com/api/v4/projects/${project}/repository/commits?path=${metadataPath}&per_page=100&page=${page}`,
    );
    if (!Array.isArray(batch)) {
      throw new Error("GitLab commits response was not an array.");
    }
    commits.push(...(batch as Commit[]));
    if (batch.length < 100) break;
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
  const mrs = await fetchJson<unknown>(
    `https://gitlab.com/api/v4/projects/${project}/merge_requests?search=${encodeURIComponent(search)}&per_page=100`,
  );
  if (!Array.isArray(mrs)) {
    throw new Error("GitLab merge request response was not an array.");
  }

  let found = 0;
  for (let i = 0; i < mrs.length; i += 10) {
    const runs = await Promise.all(
      (mrs as MergeRequest[]).slice(i, i + 10).map(async (mr) => {
        const pipes = await fetchJson<unknown>(
          `https://gitlab.com/api/v4/projects/${project}/merge_requests/${mr.iid}/pipelines`,
        );
        if (!Array.isArray(pipes)) {
          throw new Error("GitLab merge request pipelines response was not an array.");
        }
        return { mr, pipes: pipes as RestPipeline[] };
      }),
    );
    for (const { mr, pipes } of runs) {
      for (const pipe of pipes) {
        found += show(pipe, mr.title);
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

    if (!pageInfo.hasNextPage) break;
    cursor = pageInfo.endCursor;
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
