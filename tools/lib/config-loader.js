// 文件功能: 加载 .code-guardian.json 配置 | 数据流: 各 Tool → 读取配置 → 返回配置对象
const fs = require('fs');
const path = require('path');

const DEFAULT_CONFIG = {
  fileSizeLimits: {
    '**/*.js': 150,
    '**/*.vue': 200
  }
};

function loadConfig(projectRoot) {
  const configPath = path.join(projectRoot, '.code-guardian.json');

  if (fs.existsSync(configPath)) {
    try {
      const userConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      return { ...DEFAULT_CONFIG, ...userConfig };
    } catch (e) {
      throw new Error(`解析 .code-guardian.json 失败: ${e.message}`);
    }
  }

  // 回退：尝试读取 code-guardian 包自带的默认配置
  const selfConfigPath = path.resolve(__dirname, '..', '..', '.code-guardian.json');
  if (fs.existsSync(selfConfigPath)) {
    try {
      return JSON.parse(fs.readFileSync(selfConfigPath, 'utf-8'));
    } catch (e) {
      // 忽略，使用默认
    }
  }

  return DEFAULT_CONFIG;
}

// glob 转正则：支持 **/ 前缀匹配和 /** 后缀匹配
function globToRegex(pattern) {
  const escaped = pattern
    .replace(/\*\*\//g, '{{GLOBSTAR_SLASH}}')   // **/ 占位
    .replace(/\/\*\*/g, '{{SLASH_GLOBSTAR}}')   // /** 占位
    .replace(/\*/g, '[^/\\\\]*')              // * 匹配非斜杠字符
    .replace(/\{\{GLOBSTAR_SLASH\}\}/g, '(?:.*/)?')   // 还原 **/
    .replace(/\{\{SLASH_GLOBSTAR\}\}/g, '(?:/.*)?');  // 还原 /**
  return new RegExp('^' + escaped + '$', 'i');
}

// 根据文件路径匹配配置中的 glob 模式，返回第一个匹配的值
function matchGlobConfig(filePath, globMap) {
  for (const [pattern, value] of Object.entries(globMap)) {
    const regex = globToRegex(pattern);
    if (regex.test(filePath)) return value;
  }
  return undefined;
}

module.exports = { loadConfig, matchGlobConfig, globToRegex };
