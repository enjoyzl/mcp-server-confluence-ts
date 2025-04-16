import axios, { AxiosInstance, AxiosError } from 'axios';
import { Logger } from '../utils/logger.js';
import { 
  ConfluenceConfig, 
  ConfluenceSpace, 
  ConfluencePage, 
  SearchResult,
  ErrorResponse 
} from '../types/index.js';

export class ConfluenceClient {
  private client: AxiosInstance;
  private logger: Logger;

  constructor(config: ConfluenceConfig) {
    this.logger = Logger.getInstance();
    this.client = axios.create({
      baseURL: config.baseUrl,
      auth: {
        username: config.username,
        password: config.password
      },
      timeout: 10000,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    // 添加响应拦截器
    this.client.interceptors.response.use(
      response => response,
      (error: AxiosError) => this.handleError(error)
    );
  }

  private handleError(error: AxiosError): never {
    const response: ErrorResponse = {
      statusCode: error.response?.status || 500,
      message: error.message,
      error: error.response?.data
    };

    this.logger.error('Confluence API Error:', response);
    throw response;
  }

  async getSpace(spaceKey: string): Promise<ConfluenceSpace> {
    this.logger.debug('Getting space:', spaceKey);
    const response = await this.client.get(`/rest/api/space/${spaceKey}`);
    return response.data;
  }

  async getPage(pageId: string): Promise<ConfluencePage> {
    this.logger.debug('Getting page:', pageId);
    const response = await this.client.get(`/rest/api/content/${pageId}`);
    return response.data;
  }

  async searchContent(query: string): Promise<SearchResult> {
    this.logger.debug('Searching content:', query);
    const response = await this.client.get('/rest/api/content/search', {
      params: {
        cql: query,
        limit: 100
      }
    });
    return response.data;
  }

  async getPageContent(pageId: string): Promise<ConfluencePage> {
    this.logger.debug('Getting page content:', pageId);
    const response = await this.client.get(`/rest/api/content/${pageId}`, {
      params: {
        expand: 'body.storage,version,space,history,metadata.labels'
      }
    });
    return response.data;
  }
} 