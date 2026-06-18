// 文件功能: validate_architecture Tool 测试 | 数据流: node:test → validate_architecture → 断言
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const validateArchitecture = require('../tools/validate_architecture.js');

// 为每个测试创建独立临时目录，避免并行冲突
function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'cg-arch-test-'));
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

describe('validate_architecture', () => {
  it('通过：干净的 .vue 文件', () => {
    const dir = makeTempDir();
    const content = '<template><div>Hello</div></template>\n<script setup>\nconst msg = "hi"\n</script>';
    createFixture(dir, 'views/Clean.vue', content);
    const result = validateArchitecture(dir, 'views/Clean.vue');
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.issues.length, 0);
    cleanup(dir);
  });

  it('失败：.vue 文件直接调用 fetch', () => {
    const dir = makeTempDir();
    const content = '<template><div>Hello</div></template>\n<script setup>\nfetch("/api")\n</script>';
    createFixture(dir, 'views/Bad.vue', content);
    const result = validateArchitecture(dir, 'views/Bad.vue');
    assert.strictEqual(result.ok, false);
    assert.ok(result.issues.some(i => i.includes('直接 API 调用')));
    cleanup(dir);
  });

  it('失败：controller 反向 import views', () => {
    const dir = makeTempDir();
    const content = 'const view = require("../views/Home.vue")\nmodule.exports = {}';
    createFixture(dir, 'controllers/Bad.js', content);
    const result = validateArchitecture(dir, 'controllers/Bad.js');
    assert.strictEqual(result.ok, false);
    assert.ok(result.issues.some(i => i.includes('禁止的依赖')));
    cleanup(dir);
  });

  it('通过：controller 正常依赖', () => {
    const dir = makeTempDir();
    const content = 'const db = require("../models/db")\nmodule.exports = {}';
    createFixture(dir, 'controllers/Good.js', content);
    const result = validateArchitecture(dir, 'controllers/Good.js');
    assert.strictEqual(result.ok, true);
    cleanup(dir);
  });

  it('失败：composable import views', () => {
    const dir = makeTempDir();
    const content = 'import { useView } from "../views/helper"\nexport function useX() {}';
    createFixture(dir, 'composables/Bad.js', content);
    const result = validateArchitecture(dir, 'composables/Bad.js');
    assert.strictEqual(result.ok, false);
    assert.ok(result.issues.some(i => i.includes('禁止的依赖')));
    cleanup(dir);
  });

  it('失败：资源泄露 setInterval 无 clearInterval', () => {
    const dir = makeTempDir();
    const content = 'export function useTimer() { setInterval(() => {}, 1000) }';
    createFixture(dir, 'composables/Leak.js', content);
    const result = validateArchitecture(dir, 'composables/Leak.js');
    assert.strictEqual(result.ok, false);
    assert.ok(result.issues.some(i => i.includes('setInterval')));
    cleanup(dir);
  });
});