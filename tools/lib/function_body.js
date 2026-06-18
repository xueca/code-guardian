// 文件功能: 基于大括号计数提取函数体 | 数据流: detect_anti_patterns 各 detector 共享
const fs = require('fs');
const path = require('path');

// 提取函数体范围（简化版，基于大括号计数）
function extractFunctionBody(content, startIndex) {
  const bodyStart = content.indexOf('{', startIndex);
  if (bodyStart === -1) return null;

  let braceCount = 1;
  let i = bodyStart + 1;
  while (i < content.length && braceCount > 0) {
    if (content[i] === '{') braceCount++;
    if (content[i] === '}') braceCount--;
    i++;
  }
  return content.slice(bodyStart + 1, i - 1);
}

// 计算匹配位置所在行号
function getLine(content, index) {
  return content.slice(0, index).split('\n').length;
}

module.exports = { extractFunctionBody, getLine };
