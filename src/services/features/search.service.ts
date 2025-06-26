import { SearchResult } from '../../types/confluence.types.js';
import { BaseService, SearchOptions } from '../base.service.js';

/**
 * 搜索服务类
 * 负责 Confluence 内容搜索功能
 */
export class SearchService extends BaseService {

  /**
   * 搜索 Confluence 内容
   */
  public async searchContent(
    query: string,
    options: SearchOptions = {}
  ): Promise<SearchResult> {
    if (!query) {
      throw new Error('Search query is required');
    }

    const { limit = 100, start = 0, spaceKey, type } = options;
    
    // 构建 CQL 查询
    let cql = query;
    
    // 如果查询不包含 CQL 语法，则搜索文本内容
    if (!cql.includes('type') && !cql.includes('space') && !cql.includes('AND') && !cql.includes('OR')) {
      cql = `text ~ "${query.replace(/"/g, '\\"')}"`;
    }

    if (spaceKey) {
      cql = `${cql} AND space = "${spaceKey}"`;
    }
    if (type) {
      cql = `${cql} AND type = "${type}"`;
    }

    return this.retryOperation(async () => {
      this.logger.debug('Searching content:', { 
        originalQuery: query, 
        cql, 
        limit, 
        start,
        spaceKey,
        type
      });
      
      try {
        const response = await this.client.get('/rest/api/content/search', {
          params: {
            cql,
            limit,
            start,
            expand: 'space,history,version'
          }
        });
        
        this.logger.debug('Search successful:', {
          totalSize: response.data.size,
          resultsCount: response.data.results?.length || 0
        });
        
        return response.data;
      } catch (error: any) {
        this.logger.error('Search failed:', {
          originalQuery: query,
          cql,
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          message: error.message
        });
        
        // 如果是400错误且包含CQL语法错误，尝试简化查询
        if (error.response?.status === 400 && error.response?.data?.message?.includes('CQL')) {
          this.logger.warn('CQL syntax error, trying fallback search...');
          
          // 回退到基本文本搜索
          const fallbackCql = `text ~ "${query.replace(/"/g, '\\"')}"`;
          
          try {
            const fallbackResponse = await this.client.get('/rest/api/content/search', {
              params: {
                cql: fallbackCql,
                limit,
                start,
                expand: 'space,history,version'
              }
            });
            
            this.logger.debug('Fallback search successful');
            return fallbackResponse.data;
          } catch (fallbackError: any) {
            this.logger.error('Fallback search also failed:', fallbackError.response?.data);
            throw fallbackError;
          }
        }
        
        throw error;
      }
    });
  }
} 