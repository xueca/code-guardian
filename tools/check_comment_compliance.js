// 文件功能: 检查文件头注释和函数注释合规 | 数据流: check_comment_compliance Tool → 正则扫描 → 结构化报告
// 复用规则来源: .trae/rules/06-comment-standard.md
const fs = require('fs');
const path = require('path');

// 判断某行是否为函数注释（单行 // 或多行 /**）
function isFunctionCommentLine(line) {
  return /^\s*(\/\/|\/\*\*)/.test(line);
}

// 检查 .vue 文件头注释（HTML 注释 或 script 内 // 注释）
function checkVueFileHeader(content) {
  const issues = [];

  // 1. 检查 HTML 文件头注释：<!-- 页面功能: xxx → useXxx() -->
  const htmlCommentMatch = content.match(/^(?:\s*\n)?\s*<!--\s*([^>]+)\s*-->\s*/);
  if (htmlCommentMatch) {
    const comment = htmlCommentMatch[1];
    // 宽松匹配：必须包含功能描述（xxx:）和数据流指向（→ useXxx）
    const hasFunctionDesc = /[:：]\s*/.test(comment);
    const hasDataFlow = /→\s+use\w+/.test(comment) || /数据流\s*:/.test(comment);

    if (!hasFunctionDesc) {
      issues.push('HTML 文件头注释缺少功能描述（如 "AI对话页:"）');
    }
    if (!hasDataFlow) {
      issues.push('HTML 文件头注释缺少数据流说明（如 "→ useAiChat()"）');
    }
    return issues;
  }

  // 2. 检查 script 内文件头注释
  const scriptMatch = content.match(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/);
  if (scriptMatch) {
    const scriptLines = scriptMatch[1].split('\n');
    const firstNonEmpty = scriptLines.find(l => l.trim());
    if (firstNonEmpty && /文件功能\s*:/.test(firstNonEmpty)) {
      return issues; // script 内有文件头注释
    }
  }

  issues.push('缺少文件头注释（.vue 文件应在 template 前用 <!-- 页面功能: xxx → useXxx() -->）');
  return issues;
}

// 检查 .js 文件头注释
function checkJsFileHeader(lines) {
  const issues = [];
  const firstNonEmpty = lines.find(l => l.trim());

  if (!firstNonEmpty) {
    issues.push('文件为空，缺少文件头注释');
    return issues;
  }

  if (!/文件功能\s*:/.test(firstNonEmpty)) {
    issues.push('文件头注释缺少 "文件功能:" 字段');
  }
  if (!/数据流\s*:/.test(firstNonEmpty)) {
    issues.push('文件头注释缺少 "数据流" 说明（建议）');
  }

  return issues;
}

// 检查函数注释（简化版：函数定义前 3 行内是否有注释）
function checkFunctionComments(content, lines) {
  const issues = [];
  const functionPattern = /(?:async\s+)?function\s+(\w+)\s*\(/g;
  let m;

  while ((m = functionPattern.exec(content)) !== null) {
    const funcLine = content.slice(0, m.index).split('\n').length;
    const funcName = m[1];

    const startLine = Math.max(0, funcLine - 4);
    const prevLines = lines.slice(startLine, funcLine - 1);
    const hasComment = prevLines.some(l => isFunctionCommentLine(l));

    if (!hasComment) {
      issues.push(`函数 "${funcName}"（第 ${funcLine} 行）缺少函数注释`);
    }
  }

  return issues;
}

// 检查 Vue 模板区域注释（非强制，提供建议）
function checkVueTemplateComments(content) {
  const issues = [];
  const templateMatch = content.match(/<template>([\s\S]*?)<\/template>/);
  if (!templateMatch) return issues;

  const template = templateMatch[1];
  const templateLines = template.split('\n').length;
  const hasHtmlComment = /<!--\s+[^>]+\s+-->/.test(template);

  if (templateLines > 50 && !hasHtmlComment) {
    issues.push('Vue 模板超过 50 行，建议添加区域注释（<!-- 数据卡片区 --> 等）');
  }

  return issues;
}

module.exports = function checkCommentCompliance(projectRoot, filePath) {
  if (!filePath) {
    return { ok: false, error: '缺少 filePath 参数' };
  }

  const absPath = path.resolve(projectRoot, filePath);
  if (!fs.existsSync(absPath)) {
    return { ok: false, filePath, error: `文件不存在: ${filePath}` };
  }

  const ext = path.extname(filePath).toLowerCase();
  if (ext !== '.js' && ext !== '.vue') {
    return { ok: true, filePath, skipped: true, reason: '仅检查 .js 和 .vue 文件' };
  }

  const content = fs.readFileSync(absPath, 'utf-8');
  const lines = content.split('\n');
  let issues = [];

  if (ext === '.vue') {
    issues = [
      ...checkVueFileHeader(content),
      ...checkFunctionComments(content, lines),
      ...checkVueTemplateComments(content)
    ];
  } else {
    issues = [
      ...checkJsFileHeader(lines),
      ...checkFunctionComments(content, lines)
    ];
  }

  return { ok: issues.length === 0, filePath, issues };
};
