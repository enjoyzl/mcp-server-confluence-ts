// Confluence API 配置
export interface ConfluenceConfig {
  baseUrl: string;
  username?: string;
  password?: string;
  accessToken?: string;
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

// 搜索结果项
export interface SearchResultItem {
  id: string;
  type: string;
  status: string;
  title: string;
  space: ConfluenceSpace;
  history?: {
    latest: boolean;
    createdBy: {
      username: string;
      displayName: string;
    };
    createdDate: string;
  };
  version?: {
    number: number;
    by: {
      username: string;
      displayName: string;
    };
    when: string;
    message?: string;
  };
  _links: {
    webui: string;
    self: string;
    [key: string]: string;
  };
  _expandable?: {
    [key: string]: string;
  };
}

// 搜索结果接口
export interface SearchResult {
  results: SearchResultItem[];
  start: number;
  limit: number;
  size: number;
  totalSize?: number;
  cqlQuery?: string;
  searchDuration?: number;
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

// Confluence 评论信息
export interface ConfluenceComment {
  id: string;
  type: string;
  status: string;
  title: string;
  body: {
    storage: {
      value: string;
      representation: string;
    };
  };
  version: {
    number: number;
    by: {
      username: string;
      displayName: string;
      profilePicture?: {
        path: string;
        width: number;
        height: number;
        isDefault: boolean;
      };
    };
    when: string;
    message?: string;
  };
  history: {
    latest: boolean;
    createdBy: {
      username: string;
      displayName: string;
      profilePicture?: {
        path: string;
        width: number;
        height: number;
        isDefault: boolean;
      };
    };
    createdDate: string;
  };
  container: {
    id: string;
    type: string;
    title: string;
  };
  _links: {
    webui: string;
    self: string;
  };
}

// 评论搜索结果
export interface CommentSearchResult {
  results: ConfluenceComment[];
  start: number;
  limit: number;
  size: number;
  totalSize?: number;
  _links: {
    base: string;
    context: string;
    self: string;
  };
}

// 创建评论请求参数
export interface CreateCommentRequest {
  pageId: string;
  content: string;
  representation?: 'storage' | 'wiki' | 'editor2' | 'view';
  parentCommentId?: string; // 用于回复评论
}

// 更新评论请求参数
export interface UpdateCommentRequest {
  id: string;
  content: string;
  version?: number; // 可选，自动获取并递增
  representation?: 'storage' | 'wiki' | 'editor2' | 'view';
}

// 回复评论请求参数
export interface ReplyCommentRequest {
  pageId: string;
  parentCommentId: string;
  content: string;
  watch?: boolean;
}

// 行内评论信息
export interface InlineComment {
  id: string;
  originalSelection: string;
  body: string;
  matchIndex: number;
  numMatches: number;
  serializedHighlights: string;
  authorDisplayName: string;
  authorUserName: string;
  authorAvatarUrl: string;
  containerId: string;
  parentCommentId: string;
  lastFetchTime: string;
  hasDeletePermission: boolean;
  hasEditPermission: boolean;
  hasResolvePermission: boolean;
  resolveProperties: {
    resolved: boolean;
    resolvedTime: number;
  };
  deleted: boolean;
  created?: string;
  updated?: string;
}

// 创建行内评论请求参数
export interface CreateInlineCommentRequest {
  pageId: string;
  content: string;
  originalSelection: string;
  matchIndex?: number;
  numMatches?: number;
  serializedHighlights?: string;
  parentCommentId?: string;
}

// 更新行内评论请求参数
export interface UpdateInlineCommentRequest {
  commentId: string;
  content: string;
  version?: number; // 可选，因为会从现有评论中获取
}

// 回复行内评论请求参数
export interface ReplyInlineCommentRequest {
  commentId: string;
  pageId: string;
  content: string;
} 