import process from "process";
import boxen from "boxen";
import { shouldIncludePipelineTitle } from "./search_helpers";
import type {
  GraphQLResponse,
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

const pages = Number(process.argv[3]) || 50;
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
  for (let page = 1; ; page++) {
    const res = await fetch(
      `https://gitlab.com/api/v4/projects/${project}/repository/commits?path=metadata/${search}.yml&per_page=100&page=${page}`,
    );
    const batch = await res.json();
    if (!Array.isArray(batch)) break;
    commits.push(...batch);
    if (batch.length < 100) break;
  }

  let found = 0;
  for (let i = 0; i < commits.length; i += 10) {
    const runs = await Promise.all(
      commits.slice(i, i + 10).map(async (commit) => {
        const res = await fetch(
          `https://gitlab.com/api/v4/projects/${project}/pipelines?sha=${commit.id}`,
        );
        const pipes = await res.json();
        return { commit, pipes: Array.isArray(pipes) ? pipes : [] };
      }),
    );
    for (const { commit, pipes } of runs) {
      for (const pipe of pipes as RestPipeline[]) {
        found += show(pipe, commit.title, true);
      }
    }
  }

  return found;
}

async function searchMrs() {
  const res = await fetch(
    `https://gitlab.com/api/v4/projects/${project}/merge_requests?search=${search}&per_page=100`,
  );
  const mrs = await res.json();
  if (!Array.isArray(mrs)) return 0;

  let found = 0;
  for (let i = 0; i < mrs.length; i += 10) {
    const runs = await Promise.all(
      mrs.slice(i, i + 10).map(async (mr: MergeRequest) => {
        const res = await fetch(
          `https://gitlab.com/api/v4/projects/${project}/merge_requests/${mr.iid}/pipelines`,
        );
        const pipes = await res.json();
        return { mr, pipes: Array.isArray(pipes) ? pipes : [] };
      }),
    );
    for (const { mr, pipes } of runs) {
      for (const pipe of pipes as RestPipeline[]) {
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
    const response = await fetch("https://gitlab.com/api/graphql", {
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

    const json: GraphQLResponse = await response.json();
    const { nodes, pageInfo } = json.data.project.pipelines;

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

const total = search.includes(".")
  ? (await searchCommits()) + (await searchMrs())
  : await searchTitles();
if (total === 0) console.log("\nNo results found.");
process.exit(0);
