class LunoTestRunner {
  constructor() {}

  static async run(env) {
    const container = (env && env.container) || document.getElementById('app-container') || document.body;
    container.innerHTML = '';

    const root = document.createElement('div');
    root.style.cssText = 'padding:1rem; font-family:monospace; background:#0d1117; border-radius:10px; border:2px solid #00f2fe;';
    root.innerHTML = '<h2 style="color:#00f2fe; margin-bottom:0.75rem;">🧪 Luno Diagnostic & AST Verification Suite</h2><div id="test-results"></div>';
    container.appendChild(root);

    const resultsBox = root.querySelector('#test-results');

    const tests = [
      {
        name: 'Parser: Strip markdown code fences with language tags',
        fn: () => {
          const input = '```html\n<script data-file="A.js">console.log(1);<\/script>\n```';
          const parsed = LunoPayloadParser.parse(input);
          return parsed.files.length === 1 && parsed.files[0].filePath === 'A.js';
        }
      },
      {
        name: 'Parser: Surgical method container extraction',
        fn: () => {
          const input = '<script data-file="MyClass.js" data-method="MyClass.render" data-action="patch">\nrender() { return 42; }\n<\/script>';
          const parsed = LunoPayloadParser.parse(input);
          return parsed.files.length === 1 && parsed.files[0].methodSpec === 'MyClass.render' && parsed.files[0].action === 'patch';
        }
      },
      {
        name: 'Patcher: Surgical instance method replacement in ES6 class',
        fn: () => {
          const source = 'class App {\n  render() {\n    return 1;\n  }\n}';
          const patched = LunoClassPatcher.patchMethodInSource(source, 'App.render', 'render() { return 2; }');
          return patched.includes('return 2;') && !patched.includes('return 1;');
        }
      },
      {
        name: 'Patcher: Static method insertion into ES6 class',
        fn: () => {
          const source = 'class App {\n  init() {}\n}';
          const patched = LunoClassPatcher.patchMethodInSource(source, 'App.version', 'static version() { return "1.0"; }', { allowInsert: true });
          return patched.includes('static version()');
        }
      },
      {
        name: 'Patcher: Method deletion in source',
        fn: () => {
          const source = 'class App {\n  old() { return false; }\n  new() { return true; }\n}';
          const patched = LunoClassPatcher.deleteMethodInSource(source, 'App.old');
          return !patched.includes('old()') && patched.includes('new()');
        }
      }
    ];

    let passed = 0;
    tests.forEach((t, i) => {
      let isOk = false;
      let err = null;
      try {
        isOk = t.fn();
      } catch (e) {
        err = e.message;
      }

      if (isOk) passed++;

      const row = document.createElement('div');
      row.className = 'test-card';
      row.innerHTML = `
        <div><strong>#${i + 1} ${t.name}</strong>${err ? `<div style="color:#ff7b72; font-size:0.75rem;">Error: ${err}</div>` : ''}</div>
        <div class="${isOk ? 'test-pass' : 'test-fail'}">${isOk ? 'PASSED ✓' : 'FAILED ✗'}</div>
      `;
      resultsBox.appendChild(row);
    });

    const summary = document.createElement('div');
    summary.style.cssText = 'margin-top:1rem; padding:0.75rem; background:#161b22; border-radius:6px; font-weight:bold; color:' + (passed === tests.length ? '#3fb950' : '#ff7b72') + ';';
    summary.textContent = `Results: ${passed} / ${tests.length} tests passed cleanly.`;
    root.appendChild(summary);
  }
}

globalThis.LunoTestRunner = LunoTestRunner;
if (typeof module !== 'undefined' && module.exports) module.exports = LunoTestRunner;