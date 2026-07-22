export interface GraphQLResponse {
  data: {
    project: {
      pipelines: {
        nodes: Pipeline[];
        pageInfo: PageInfo;
      };
    };
  };
}

export interface Pipeline {
  path: string;
  status: string;
  commit: {
    title: string;
  };
}

export interface PageInfo {
  hasNextPage: boolean;
  endCursor: string | null;
}

export interface Commit {
  id: string;
  title: string;
}

export interface RestPipeline {
  web_url: string;
  status: string;
}

export interface MergeRequest {
  iid: number;
  title: string;
}
