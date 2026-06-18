// 文件功能: 检查文件行数是否超过项目约束 | 数据流: check_file_size Tool → config-loader → 读取文件统计行数 → 结构化报告
const fs = require('fs');
const path = require('path');
const { loadConfig, matchGlobConfig } = require('./lib/config-loader.js');

// 计算文件实际行数
function countLines(content) {
  if (!content) return 0;
  const trimmed = content.replace(/\n\s*$/, '');
  return trimmed ? trimmed.split('\n').length : 0;
}

module.exports = function checkFileSize(projectRoot, filePath) {
  if (!filePath) {
    return { ok: false, error: '缺少 filePath 参数' };
  }

  const absPath = path.resolve(projectRoot, filePath);
  if (!fs.existsSync(absPath)) {
    return { ok: false, filePath, error: `文件不存在: ${filePath}` };
  }

  const stat = fs.statSync(absPath);
  if (!stat.isFile()) {
    return { ok: false, filePath, error: `路径不是文件: ${filePath}` };
  }

  // 从配置读取行数限制
  const config = loadConfig(projectRoot);
  const limit = matchGlobConfig(filePath, config.fileSizeLimits);

  if (limit === undefined) {
    return { ok: true, filePath, lines: 0, limit: '未定义', reason: '该文件类型无行数限制配置' };
  }

  const content = fs.readFileSync(absPath, 'utf-8');
  const lines = countLines(content);
  const ok = lines <= limit;

  return {
    ok,
    filePath,
    lines,
    limit,
    exceeded: ok ? 0 : lines - limit
  };
};
