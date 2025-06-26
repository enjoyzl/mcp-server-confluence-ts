import { ConfluenceSpace } from '../../types/confluence.types.js';
import { BaseService } from '../base.service.js';

/**
 * 空间服务类
 * 负责 Confluence 空间管理功能
 */
export class SpaceService extends BaseService {

  /**
   * 获取 Confluence 空间信息
   */
  public async getSpace(spaceKey: string): Promise<ConfluenceSpace> {
    if (!spaceKey) {
      throw new Error('Space key is required');
    }

    return this.getCachedData(
      `space:${spaceKey}`,
      () => this.retryOperation(async () => {
        this.logger.debug('Getting space:', spaceKey);
        const response = await this.client.get(`/rest/api/space/${spaceKey}`);
        return response.data;
      })
    );
  }
} 