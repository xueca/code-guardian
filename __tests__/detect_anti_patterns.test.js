// 文件功能: detect_anti_patterns Tool 测试 | 数据流: node:test → detect_anti_patterns → 断言
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const detectAntiPatterns = require('../tools/detect_anti_patterns.js');

// 为每个测试创建独立临时目录，避免并行冲突
function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'cg-ap-test-'));
}

function createFixture(dir, name, content) {
  const filePath = path.join(dir, name);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf-8');
  return filePath;
}

function cleanup(dir) {
  try { fs.rmSync(dir, { recursive: true }); } catch (e) { /* ignore */ }
}

describe('detect_anti_patterns', () => {
  it('通过：干净的 .vue 文件', () => {
    const dir = makeTempDir();
    const content = '<template><div>Hello</div></template>\n<script setup>\nconst msg = "hi"\n</script>';
    createFixture(dir, 'views/Clean.vue', content);
    const result = detectAntiPatterns(dir, 'views/Clean.vue');
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.findings.length, 0);
    cleanup(dir);
  });

  it('失败：.vue 文件直接 axios', () => {
    const dir = makeTempDir();
    const content = '<template><div>Hello</div></template>\n<script setup>\naxios.get("/api")\n</script>';
    createFixture(dir, 'views/Bad.vue', content);
    const result = detectAntiPatterns(dir, 'views/Bad.vue');
    assert.strictEqual(result.ok, false);
    assert.ok(result.findings.some(f => f.pattern === 'direct-api-in-view'));
    cleanup(dir);
  });

  it('失败：async 函数无 try-catch', () => {
    const dir = makeTempDir();
    const content = 'async function fetchData() { return await api.get() }';
    createFixture(dir, 'api/bad.js', content);
    const result = detectAntiPatterns(dir, 'api/bad.js');
    assert.strictEqual(result.ok, false);
    assert.ok(result.findings.some(f => f.pattern === 'bare-async'));
    cleanup(dir);
  });

  it('通过：async 函数有 try-catch', () => {
    const dir = makeTempDir();
    const content = 'async function fetchData() { try { return await api.get() } catch(e) {} }';
    createFixture(dir, 'api/good.js', content);
    const result = detectAntiPatterns(dir, 'api/good.js');
    assert.strictEqual(result.ok, true);
    cleanup(dir);
  });

  it('失败：模块级状态变量', () => {
    const dir = makeTempDir();
    const content = 'let currentStream = null\nexport function useStream() {}';
    createFixture(dir, 'composables/bad.js', content);
    const result = detectAntiPatterns(dir, 'composables/bad.js');
    assert.strictEqual(result.ok, false);
    assert.ok(result.findings.some(f => f.pattern === 'module-level-state'));
    cleanup(dir);
  });

  it('失败：资源泄露（无清理）', () => {
    const dir = makeTempDir();
    const content = 'export function useTimer() { setInterval(() => {}, 1000) }';
    createFixture(dir, 'views/leak.vue', content);
    const result = detectAntiPatterns(dir, 'views/leak.vue');
    assert.strictEqual(result.ok, false);
    assert.ok(result.findings.some(f => f.pattern === 'resource-leak'));
    cleanup(dir);
  });
});