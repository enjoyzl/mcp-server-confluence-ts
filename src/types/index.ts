export interface ConfluenceConfig {
  baseUrl: string;
  username: string;
  password: string;
  timeout?: number;
  rejectUnauthorized?: boolean;
}

export interface AppConfig {
  confluence: {
    url: string;
    username: string;
    password: string;
  };
  server: {
    port: number;
    env: 'development' | 'production';
    timeout: number;
  };
}

export interface ConfluenceSpace {
  id: string;
  key: string;
  name: string;
  type: string;
  _links: {
    webui: string;
    self: string;
  };
}

export interface ConfluencePage {
  id: string;
  type: string;
  status: string;
  title: string;
  space: ConfluenceSpace;
  body?: {
    storage: {
      value: string;
      representation: string;
    };
  };
  _links: {
    webui: string;
    edit?: string;
    tinyui?: string;
    self: string;
  };
}

export interface SearchResult {
  results: Array<{
    content: ConfluencePage;
    title: string;
    excerpt: string;
    url: string;
    resultGlobalContainer: {
      title: string;
      displayUrl: string;
    };
  }>;
  start: number;
  limit: number;
  size: number;
  totalSize: number;
  _links: {
    base: string;
    context: string;
    self: string;
  };
}

export interface ErrorResponse {
  message: string;
  statusCode?: number;
  [key: string]: any;
} 