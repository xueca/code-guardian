// 文件功能: 扫描 6 种反模式 | 数据流: detect_anti_patterns Tool → config-loader → lib/detector 模块 → 结构化报告
// 复用规则来源: .trae/rules/03-anti-patterns.md
const fs = require('fs');
const path = require('path');
const { loadConfig } = require('./lib/config-loader.js');

const detectDirectApiInView = require('./lib/direct_api_detector.js');
const detectLongTransformInView = require('./lib/long_transform_detector.js');
const detectBareAsync = require('./lib/bare_async_detector.js');
const detectResourceLeak = require('./lib/resource_leak_detector.js');
const detectModuleLevelState = require('./lib/module_state_detector.js');
const detectDuplicateCode = require('./lib/duplicate_code_detector.js');

module.exports = function detectAntiPatterns(projectRoot, filePath) {
  if (!filePath) {
    return { ok: false, error: '缺少 filePath 参数' };
  }

  const absPath = path.resolve(projectRoot, filePath);
  if (!fs.existsSync(absPath)) {
    return { ok: false, filePath, error: `文件不存在: ${filePath}` };
  }

  const content = fs.readFileSync(absPath, 'utf-8');
  const config = loadConfig(projectRoot);
  const switches = config.antiPatterns || {};
  const findings = [];

  if (switches.directApiInView !== false) {
    findings.push(...detectDirectApiInView(content, filePath));
  }
  if (switches.longTransformInView !== false) {
    findings.push(...detectLongTransformInView(content, filePath));
  }
  if (switches.bareAsync !== false) {
    findings.push(...detectBareAsync(content));
  }
  if (switches.resourceLeak !== false) {
    findings.push(...detectResourceLeak(content, filePath));
  }
  if (switches.moduleLevelState !== false) {
    findings.push(...detectModuleLevelState(content, filePath));
  }
  if (switches.duplicateCode !== false) {
    findings.push(...detectDuplicateCode(content, filePath));
  }

  return { ok: findings.length === 0, filePath, findings };
};
