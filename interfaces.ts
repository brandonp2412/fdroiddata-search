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
  commit: {
    title: string;
  };
  detailedStatus: {
    label: string;
  };
}

export interface PageInfo {
  hasNextPage: boolean;
  endCursor: string | null;
}
