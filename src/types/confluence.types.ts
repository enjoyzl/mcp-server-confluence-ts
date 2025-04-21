// Confluence API 配置
export interface ConfluenceConfig {
  baseUrl: string;
  username: string;
  password: string;
  timeout?: number;
  rejectUnauthorized?: boolean;
}

// Confluence 空间信息
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

// Confluence 页面信息
export interface ConfluencePage {
  id: string;
  type: string;
  status: string;
  title: string;
  space: ConfluenceSpace;
  version?: {
    number: number;
    by: {
      username: string;
      displayName: string;
    };
    when: string;
    message?: string;
  };
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

// 搜索结果
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

// API 错误响应
export interface ErrorResponse {
  message: string;
  statusCode?: number;
  error?: any;
  config?: {
    url?: string;
    method?: string;
    params?: any;
    headers?: Record<string, any>;
  };
}

// 创建页面请求参数
export interface CreatePageRequest {
  spaceKey: string;
  title: string;
  content: string;
  parentId?: string;
  representation?: 'storage' | 'wiki' | 'editor2' | 'view';
}

// 更新页面请求参数
export interface UpdatePageRequest {
  id: string;
  title?: string;
  content?: string;
  version?: number;
  representation?: 'storage' | 'wiki' | 'editor2' | 'view';
} 