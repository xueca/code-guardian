#!/usr/bin/env node
// 文件功能: Code Guardian MCP Server 入口 | 数据流: AI 调用 → Tool 执行 → 结构化报告
const path = require('path');
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { CallToolRequestSchema, ListToolsRequestSchema } = require('@modelcontextprotocol/sdk/types.js');

// 解析 --project-root 参数，未指定则使用当前工作目录
const args = require('process').argv.slice(2);
const rootFlag = args.indexOf('--project-root');
const PROJECT_ROOT = rootFlag !== -1
  ? path.resolve(args[rootFlag + 1])
  : process.cwd();

const checkFileSize = require('./tools/check_file_size.js');
const runESLint = require('./tools/run_eslint.js');
const validateArchitecture = require('./tools/validate_architecture.js');
const detectAntiPatterns = require('./tools/detect_anti_patterns.js');
const checkCommentCompliance = require('./tools/check_comment_compliance.js');
const fullHealthCheck = require('./tools/full_health_check.js');

const server = new Server(
  { name: 'code-guardian', version: '0.1.0' },
  { capabilities: { tools: {} } }
);

// 工具描述表
const TOOLS = [
  {
    name: 'check_file_size',
    description: '检查文件是否超过 .code-guardian.json 中定义的行数上限（支持 glob 模式匹配）',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: { type: 'string', description: '相对于项目根目录的文件路径' }
      },
      required: ['filePath']
    }
  },
  {
    name: 'run_eslint',
    description: '对指定文件运行 ESLint 检查（需要项目安装 eslint 及插件）',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: { type: 'string', description: '相对于项目根目录的文件路径' }
      },
      required: ['filePath']
    }
  },
  {
    name: 'validate_architecture',
    description: '检查架构分层合规：视图层 API 调用、依赖方向、资源泄露',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: { type: 'string', description: '相对于项目根目录的文件路径' }
      },
      required: ['filePath']
    }
  },
  {
    name: 'detect_anti_patterns',
    description: '扫描 6 种反模式：裸 async 无 catch、资源未清理、模块级状态、组件内长数据转换、视图层直接 API 调用、重复代码',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: { type: 'string', description: '相对于项目根目录的文件路径' }
      },
      required: ['filePath']
    }
  },
  {
    name: 'check_comment_compliance',
    description: '检查文件头注释和函数注释是否符合 .code-guardian.json 中 commentStandard 规范',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: { type: 'string', description: '相对于项目根目录的文件路径' }
      },
      required: ['filePath']
    }
  },
  {
    name: 'full_health_check',
    description: '一键运行全部 5 项检查，输出结构化报告',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: { type: 'string', description: '相对于项目根目录的文件路径' }
      },
      required: ['filePath']
    }
  }
];

// 注册工具列表
server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

async function handleToolCall(name, projectRoot, filePath) {
  switch (name) {
    case 'check_file_size':
      return checkFileSize(projectRoot, filePath);
    case 'run_eslint':
      return await runESLint(projectRoot, filePath);
    case 'validate_architecture':
      return validateArchitecture(projectRoot, filePath);
    case 'detect_anti_patterns':
      return detectAntiPatterns(projectRoot, filePath);
    case 'check_comment_compliance':
      return checkCommentCompliance(projectRoot, filePath);
    case 'full_health_check':
      return await fullHealthCheck(projectRoot, filePath);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// 处理工具调用
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const { filePath } = args || {};

  try {
    const result = await handleToolCall(name, PROJECT_ROOT, filePath);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  } catch (e) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ ok: false, error: e.message }, null, 2) }],
      isError: true
    };
  }
});

// 启动 stdio 传输
const transport = new StdioServerTransport();
server.connect(transport);
