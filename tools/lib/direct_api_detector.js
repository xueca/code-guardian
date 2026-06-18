// 文件功能: 检测视图层直接 API 调用 | 数据流: detect_anti_patterns → direct_api_detector → 报告
const { getLine } = require('./function_body.js');

module.exports = function detectDirectApiInView(content, filePath) {
  const findings = [];
  const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase();
  if (ext !== '.vue') return findings;

  const directApiPattern = /\bfetch\s*\(|\baxios\s*\.|new\s+EventSource\s*\(/g;
  let m;
  while ((m = directApiPattern.exec(content)) !== null) {
    findings.push({
      pattern: 'direct-api-in-view',
      message: '视图层直接调用 API',
      line: getLine(content, m.index)
    });
  }
  return findings;
};
