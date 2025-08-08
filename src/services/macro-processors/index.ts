/**
 * 宏处理器模块导出
 * 
 * 统一导出所有宏处理器相关的类和接口
 */

export { BaseMacroProcessor } from './base-macro-processor.js';
export { MarkdownMacroProcessor } from './markdown-macro-processor.js';

// 当其他具体的宏处理器实现后，在这里添加导出
// export { CodeMacroProcessor } from './code-macro-processor.js';
// export { InfoMacroProcessor } from './info-macro-processor.js';
// export { TableMacroProcessor } from './table-macro-processor.js';
// export { ChartMacroProcessor } from './chart-macro-processor.js';
// export { IncludeMacroProcessor } from './include-macro-processor.js';
// export { CustomMacroProcessor } from './custom-macro-processor.js';