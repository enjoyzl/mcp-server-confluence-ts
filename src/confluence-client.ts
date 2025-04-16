import axios from 'axios';

export interface ConfluenceConfig {
  baseUrl: string;
  username: string;
  password: string;
}

export class ConfluenceClient {
  private client: ReturnType<typeof axios.create>;

  constructor(config: ConfluenceConfig) {
    this.client = axios.create({
      baseURL: config.baseUrl,
      auth: {
        username: config.username,
        password: config.password
      }
    });
  }

  async getSpace(spaceKey: string) {
    const response = await this.client.get(`/rest/api/space/${spaceKey}`);
    return response.data;
  }

  async getPage(pageId: string) {
    const response = await this.client.get(`/rest/api/content/${pageId}`);
    return response.data;
  }

  async searchContent(query: string) {
    const response = await this.client.get('/rest/api/content/search', {
      params: {
        cql: query
      }
    });
    return response.data;
  }

  async getPageContent(pageId: string) {
    const response = await this.client.get(`/rest/api/content/${pageId}`, {
      params: {
        expand: 'body.storage,version,space,history,metadata.labels'
      }
    });
    return response.data;
  }
} 