export interface ConfluenceConfig {
  baseUrl: string;
  username: string;
  password: string;
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
  status: string;
}

export interface ConfluencePage {
  id: string;
  type: string;
  status: string;
  title: string;
  space?: {
    id: string;
    key: string;
    name: string;
  };
  body?: {
    storage: {
      value: string;
      representation: string;
    };
  };
  version?: {
    number: number;
    by: {
      username: string;
      displayName: string;
    };
  };
}

export interface SearchResult {
  results: ConfluencePage[];
  start: number;
  limit: number;
  size: number;
  totalSize: number;
}

export interface ErrorResponse {
  statusCode: number;
  message: string;
  error?: any;
} 