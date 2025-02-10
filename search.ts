import process from "process";
import { SingleBar, Presets } from "cli-progress";
import boxen from "boxen";
import type { Pipeline } from "./interfaces";

const search = process.argv[2];
if (!search) {
  console.error("Usage: bun search.ts MY_APP_NAME [LIMIT]");
  process.exit(1);
}
console.log(boxen(`Searching for ${search}...`, { padding: 1 }));

let page = 0;
const limit = process.argv[3] === undefined ? 99 : Number(process.argv[3]);
const bar1 = new SingleBar({}, Presets.shades_classic);
bar1.start(limit, 0);

while (page < limit) {
  const response = await fetch(
    `https://gitlab.com/fdroid/fdroiddata/-/pipelines.json?scope=all&page=${page}`
  );

  const json: { count: any; pipelines: Pipeline[] } = await response.json();

  for (const pipeline of json.pipelines) {
    if (pipeline.details.status.label == "skipped") continue;
    if (pipeline.details.status.label == "canceled") continue;
    if (!pipeline.commit.title.toLowerCase().includes(search)) continue;
    console.log("\nhttps://gitlab.com" + pipeline.path);
  }

  page++;
  bar1.update(page);
}

process.exit(0);
