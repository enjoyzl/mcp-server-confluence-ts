#!/usr/bin/env node

import dotenv from 'dotenv';
import { ConfluenceService } from '../dist/services/confluence.service.js';

// 加载环境变量
dotenv.config();

async function testExportWithDebug() {
    try {
        console.log('开始测试导出功能...');
        console.log('环境变量:', {
            url: process.env.CONFLUENCE_URL,
            username: process.env.CONFLUENCE_USERNAME,
            hasPassword: !!process.env.CONFLUENCE_PASSWORD
        });
        
        const service = new ConfluenceService({
            baseUrl: process.env.CONFLUENCE_URL,
            username: process.env.CONFLUENCE_USERNAME,
            password: process.env.CONFLUENCE_PASSWORD,
            timeout: parseInt(process.env.TIMEOUT) || 10000
        });
        
        // 导出测试页面
        const result = await service.exportPage({
            pageId: '104762256', // 数据防篡改签名方案
            outputDir: 'confluence-export-debug',
            includeMetadata: true,
            overwrite: true
        });
        
        console.log('导出结果:', JSON.stringify(result, null, 2));
        
        if (result.success) {
            console.log('导出成功！');
            result.exportedFiles.forEach(file => {
                console.log(`- 文件: ${file.filePath}, 大小: ${file.fileSize} bytes`);
            });
        } else {
            console.log('导出失败！');
            result.errors.forEach(error => {
                console.log(`- 错误: ${error.error}`);
            });
        }
        
    } catch (error) {
        console.error('测试失败:', error);
    }
}

testExportWithDebug();