const search = process.argv[2];
if (!search) {
  console.error("Usage: bun search.ts MY_APP_NAME");
  process.exit(1);
}

let page = 0;
const limit = 999;

while (page < limit) {
  const response = await fetch(
    `https://gitlab.com/fdroid/fdroiddata/-/pipelines.json?scope=all&page=${page}`
  );

  const json: { count: any; pipelines: Pipeline[] } = await response.json();

  for (const pipeline of json.pipelines) {
    if (pipeline.commit.title.toLowerCase().includes(search))
      console.log(pipeline.path);
  }

  page++;

  if (page % 5 === 0) console.log(`Got page ${page}`);
}

export interface Pipeline {
  id: number;
  iid: number;
  user: User;
  active: boolean;
  name: any;
  source: string;
  created_at: string;
  updated_at: string;
  path: string;
  flags: Flags;
  details: Details;
  merge_request: MergeRequest;
  ref: Ref;
  commit: Commit;
  merge_request_event_type: string;
  failed_builds_count: number;
  pipeline_schedule: any;
  project: Project;
  triggered_by: any;
  triggered: any[];
}

export interface User {
  id: number;
  username: string;
  name: string;
  state: string;
  locked: boolean;
  avatar_url: string;
  web_url: string;
  show_status: boolean;
  path: string;
}

export interface Flags {
  stuck: boolean;
  auto_devops: boolean;
  merge_request: boolean;
  yaml_errors: boolean;
  retryable: boolean;
  cancelable: boolean;
  failure_reason: boolean;
  detached_merge_request_pipeline: boolean;
  merge_request_pipeline: boolean;
  merged_result_pipeline: boolean;
  merge_train_pipeline: boolean;
  latest: boolean;
}

export interface Details {
  status: Status;
  stages: any[];
  duration: any;
  finished_at: any;
  event_type_name: string;
  has_manual_actions: boolean;
  has_scheduled_actions: boolean;
}

export interface Status {
  icon: string;
  text: string;
  label: string;
  group: string;
  tooltip: string;
  has_details: boolean;
  details_path: string;
  illustration: any;
  favicon: string;
}

export interface MergeRequest {
  iid: number;
  path: string;
  title: string;
  source_branch: string;
  source_branch_path: any;
  target_branch: string;
  target_branch_path: string;
}

export interface Ref {
  name: string;
  path: string;
  tag: boolean;
  branch: boolean;
  merge_request: boolean;
}

export interface Commit {
  id: string;
  short_id: string;
  created_at: string;
  parent_ids: string[];
  title: string;
  message: string;
  author_name: string;
  author_email: string;
  authored_date: string;
  committer_name: string;
  committer_email: string;
  committed_date: string;
  trailers: Trailers;
  extended_trailers: ExtendedTrailers;
  web_url: string;
  author: any;
  author_gravatar_url: string;
  commit_url: string;
  commit_path: string;
}

export interface Trailers {}

export interface ExtendedTrailers {}

export interface Project {
  id: number;
  name: string;
  full_path: string;
  full_name: string;
  refs_url: string;
  forked: boolean;
}
