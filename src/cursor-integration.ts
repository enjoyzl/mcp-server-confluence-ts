import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 定义日志函数
function log(message: string) {
  console.error(`[DEBUG] ${message}`);
}

log("MCP 客户端启动中...");
log(`当前目录: ${__dirname}`);

// 创建 MCP 客户端
const client = new Client({
  name: "confluence-mcp-client",
  version: "1.0.0",
  description: "Confluence MCP 客户端"
});

log("MCP 客户端已创建");

// 创建传输层
const transport = new StdioClientTransport({
  command: "cmd",
  args: ["/c", "npx", "tsx", path.join(__dirname, "index.ts")]
});

log(`传输层已创建，命令: cmd /c npx tsx ${path.join(__dirname, "index.ts")}`);

// 主函数
async function main() {
  log("主函数开始执行");
  
  try {
    // 连接服务器
    await client.connect(transport);
    log("MCP 客户端已成功连接");
    
    // 列出可用的工具
    const tools = await client.listTools();
    log(`可用的工具: ${JSON.stringify(tools)}`);
    
    // 保持进程运行
    process.on('SIGINT', async () => {
      log("收到 SIGINT 信号，正在关闭...");
      await transport.close();
      process.exit(0);
    });

    // 等待进程结束
    await new Promise(() => {});
  } catch (error) {
    log(`连接服务器失败: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

main().catch(error => {
  log(`未处理的错误: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}); 