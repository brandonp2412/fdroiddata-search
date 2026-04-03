import process from "process";
import { SingleBar, Presets } from "cli-progress";
import boxen from "boxen";
import type { GraphQLResponse } from "./interfaces";

const search = process.argv[2]?.toLowerCase();
if (!search) {
  console.error("Usage: bun search.ts MY_APP_NAME [LIMIT]");
  process.exit(1);
}
console.log(boxen(`Searching for ${search}...`, { padding: 1 }));

const limit = process.argv[3] === undefined ? 99 : Number(process.argv[3]);
const bar1 = new SingleBar({}, Presets.shades_classic);
bar1.start(limit, 0);

const QUERY = `
  query getPipelines($fullPath: ID!, $first: Int, $after: String) {
    project(fullPath: $fullPath) {
      pipelines(first: $first, after: $after) {
        nodes {
          path
          commit { title }
          detailedStatus { label }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  }
`;

let page = 0;
let cursor: string | null = null;

while (page < limit) {
  const response = await fetch("https://gitlab.com/api/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: QUERY,
      variables: {
        fullPath: "fdroid/fdroiddata",
        first: 20,
        after: cursor,
      },
    }),
  });

  const json: GraphQLResponse = await response.json();
  const { nodes, pageInfo } = json.data.project.pipelines;

  for (const pipeline of nodes) {
    if (pipeline.detailedStatus.label === "skipped") continue;
    if (pipeline.detailedStatus.label === "canceled") continue;
    if (!pipeline.commit.title.toLowerCase().includes(search)) continue;
    console.log("\nhttps://gitlab.com" + pipeline.path);
  }

  page++;
  bar1.update(page);

  if (!pageInfo.hasNextPage) break;
  cursor = pageInfo.endCursor;
}

process.exit(0);
