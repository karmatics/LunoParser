class LunoTestRunner {
  static async run(env) {
    const target = (env && env.container) || document.getElementById("app-container") || document.body;
    return LunoTestRunner.mountUI(target);
  }

  constructor() {}

  static results = [];

  static assert(title, condition, detail) {
    var det = detail || '';
    var item = { title: title, success: Boolean(condition), detail: det };
    LunoTestRunner.results.push(item);
    console.log((item.success ? '✅ PASSED: ' : '❌ FAILED: ') + title + (det ? (' (' + det + ')') : ''));
    return item;
  }

  static async runTestSuite() {
      LunoTestRunner.results = [];
      console.log('🧪 Starting Luno Modular Test Suite...');

      if (typeof LunoAcornLoader !== 'undefined' && LunoAcornLoader.ensureLoaded) {
        try { await LunoAcornLoader.ensureLoaded(); } catch (e) {}
      }

      // Run modular test suites
      await LunoTestRunner.runDiffTests();
      await LunoTestRunner.runDiskBrowserTests();
      await LunoTestRunner.runHistoryTests();

      var passed = LunoTestRunner.results.filter(r => r.success).length;
      var total = LunoTestRunner.results.length;
      console.log('🏁 Modular Test Suite Completed: ' + passed + '/' + total + ' Passed.');

      return {
        total: total,
        passed: passed,
        failed: total - passed,
        details: LunoTestRunner.results
      };
    }
  static mountUI(container) {
      if (!container || typeof document === 'undefined') return;
      container.innerHTML = '';
      var m = (typeof LunoUIComponents !== 'undefined' && LunoUIComponents.makeElement)
        ? LunoUIComponents.makeElement
        : function(tag, attrs) {
            var el = document.createElement(tag || 'div');
            if (attrs && typeof attrs === 'object') Object.assign(el, attrs);
            for (var i = 2; i < arguments.length; i++) {
              var c = arguments[i];
              if (c) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
            }
            return el;
          };

      var resultsContainer = m('div', { id: 'test-results-list', style: { display: 'flex', flexDirection: 'column', gap: '0.5rem' } });
      var summaryBadge = m('span', {
        id: 'test-summary-badge',
        style: { fontSize: '0.75rem', color: '#00f2fe', background: '#003847', border: '1px solid #00f2fe', padding: '0.2rem 0.6rem', borderRadius: '12px', fontWeight: 'bold' }
      }, '⚡ Running suite...');

      var headerRow = m('div', {
        style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem', flexWrap: 'wrap', gap: '0.4rem' }
      },
        m('h2', { id: 'test-suite-header-title', style: { color: '#00f2fe', fontSize: '1.1rem', margin: 0 } }, '🧪 Luno Diagnostic Test Suite'),
        summaryBadge
      );

      var card = m('div', {
        style: { background: '#161b22', border: '2px solid #00f2fe', borderRadius: '10px', padding: '1rem', color: '#c9d1d9', fontFamily: 'monospace', maxWidth: '720px', margin: '1rem auto', boxShadow: '0 4px 16px rgba(0,242,254,0.2)' }
      },
        headerRow,
        m('button', {
          id: 'btn-rerun-test-suite',
          style: { padding: '0.65rem 1.2rem', background: '#238636', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'monospace', marginBottom: '1rem', boxShadow: '0 2px 8px rgba(35,134,54,0.3)' },
          onclick: function() {
            LunoTestRunner.runTestSuite().then(function() {
              LunoTestRunner.mountUI(container);
            });
          }
        }, '▶ Run Diagnostic Suite'),
        resultsContainer
      );

      container.appendChild(card);

      LunoTestRunner.runTestSuite().then(function(summary) {
        resultsContainer.innerHTML = '';
        var passedCount = summary ? summary.passed : LunoTestRunner.results.filter(r => r.success).length;
        var totalCount = summary ? summary.total : LunoTestRunner.results.length;
        var allPassed = (passedCount === totalCount && totalCount > 0);

        var titleEl = document.getElementById('test-suite-header-title');
        if (titleEl) titleEl.textContent = '🧪 Luno Diagnostic Test Suite (' + totalCount + ' Tests)';

        var badgeEl = document.getElementById('test-summary-badge');
        if (badgeEl) {
          badgeEl.textContent = allPassed ? ('✅ ' + passedCount + '/' + totalCount + ' Passed (100%)') : ('⚠️ ' + passedCount + '/' + totalCount + ' Passed');
          badgeEl.style.color = allPassed ? '#3fb950' : '#ff7b72';
          badgeEl.style.background = allPassed ? '#0d2818' : '#3c1418';
          badgeEl.style.borderColor = allPassed ? '#238636' : '#da3633';
        }

        LunoTestRunner.results.forEach(function(r) {
          resultsContainer.appendChild(m('div', {
            style: {
              background: '#0d1117',
              border: '1px solid ' + (r.success ? '#238636' : '#da3633'),
              borderRadius: '6px',
              padding: '0.55rem 0.75rem',
              fontSize: '0.78rem',
              color: r.success ? '#7ee787' : '#ff7b72',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '0.4rem'
            }
          },
            m('span', {}, (r.success ? '✅ ' : '❌ ') + r.title),
            r.detail ? m('span', { style: { color: '#8b949e', fontSize: '0.72rem', flexShrink: 0 } }, r.detail) : null
          ));
        });
      });
    }

  static async runDiffTests() {
      try {
        if (typeof CodeDiffer !== 'undefined' && typeof CodeDiffer.analyzeDiff === 'function') {
          var oldJs = 'function hello() {\n  return 1;\n}';
          var newJs = 'function hello() {\n  console.log("greeting");\n  return 2;\n}';
          var jsDiff = CodeDiffer.analyzeDiff(oldJs, newJs, 'src/App.js');
          var jsOk = (jsDiff.linesAdded === 2) && (jsDiff.linesRemoved === 1) && (jsDiff.byteDelta > 0);

          var oldHtml = '<div class="card">\n  <p>Title</p>\n</div>';
          var newHtml = '<div class="card" id="main">\n  <p>Title</p>\n  <span>Badge</span>\n</div>';
          var htmlDiff = CodeDiffer.analyzeDiff(oldHtml, newHtml, 'index.html');
          var htmlOk = htmlDiff.isHtml && (htmlDiff.linesAdded === 2) && (htmlDiff.linesRemoved === 1) && (htmlDiff.byteDelta > 0);

          LunoTestRunner.assert(
            'CodeDiffer: Multi-Language LCS Diffing & Byte Deltas (JS & HTML)',
            jsOk && htmlOk,
            'Computed line additions/removals and byte deltas for JS and HTML templates'
          );
        } else {
          LunoTestRunner.assert('CodeDiffer: Multi-Language LCS Diffing', false, 'CodeDiffer unavailable');
        }
      } catch (e) {
        LunoTestRunner.assert('CodeDiffer: Multi-Language LCS Diffing', false, e.message);
      }

      try {
        if (typeof LunoSettings !== 'undefined' && typeof LunoSettings.diffReviewEnabled === 'function') {
          var origPref = LunoSettings.diffReviewEnabled();
          LunoSettings.setDiffReviewEnabled(false);
          var setOff = !LunoSettings.diffReviewEnabled();
          LunoSettings.setDiffReviewEnabled(true);
          var setOn = LunoSettings.diffReviewEnabled();
          LunoSettings.setDiffReviewEnabled(origPref);

          var colorPref = LunoSettings.colorizedFeedbackEnabled();

          LunoTestRunner.assert(
            'LunoSettings: Diff Review & Colorized Feedback Toggles',
            setOff && setOn && (typeof colorPref === 'boolean'),
            'Persisted diff review and colorized output preferences'
          );
        } else {
          LunoTestRunner.assert('LunoSettings: Diff Preferences', false, 'LunoSettings unavailable');
        }
      } catch (e) {
        LunoTestRunner.assert('LunoSettings: Diff Preferences', false, e.message);
      }

      try {
        if (typeof CodeDiffer !== 'undefined' && typeof CodeDiffer.renderUnifiedDiffTable === 'function') {
          var tOld = 'const x = 1;\nconst y = 2;\n';
          var tNew = 'const x = 1;\nconst y = 3;\nconst z = 4;\n';
          var domTable = CodeDiffer.renderUnifiedDiffTable(tOld, tNew, 'test.js');
          var pills = CodeDiffer.createStatsPills(1, 2, 14);

          var hasTableEl = (domTable instanceof HTMLElement) && (domTable.querySelectorAll('tr').length >= 3);
          var hasPillColors = pills.includes('#3fb950') && pills.includes('#ff7b72') && pills.includes('+2 LOC');

          LunoTestRunner.assert(
            'CodeDiffer: Unified Table Generator & Interactive Stats Pills',
            hasTableEl && hasPillColors,
            'Rendered colorized diff DOM table with line numbers and green/red pills'
          );
        } else {
          LunoTestRunner.assert('CodeDiffer: Table Generator', false, 'CodeDiffer unavailable');
        }
      } catch (e) {
        LunoTestRunner.assert('CodeDiffer: Table Generator', false, e.message);
      }
    }

  static async runDiskBrowserTests() {
      try {
        if (typeof DiskBrowser !== 'undefined' && typeof DiskBrowser.sortItems === 'function') {
          var sampleItems = [
            { name: 'b_old.js', size: 100, mtimeMs: 1000 },
            { name: 'a_new.html', size: 500, mtimeMs: 5000 },
            { name: 'c_mid.css', size: 200, mtimeMs: 2500 }
          ];

          var byDate = DiskBrowser.sortItems(sampleItems, 'date', 'desc');
          var isDateSorted = (byDate[0].mtimeMs === 5000) && (byDate[2].mtimeMs === 1000);

          var byExt = DiskBrowser.sortItems(sampleItems, 'ext', 'asc');
          var isExtSorted = byExt[0].name.endsWith('.css') && byExt[2].name.endsWith('.js');

          LunoTestRunner.assert(
            'DiskBrowser: Multi-Column Sorting (Date & Extension)',
            isDateSorted && isExtSorted,
            'Sorted file lists by modification date and extension ascending/descending'
          );
        } else {
          LunoTestRunner.assert('DiskBrowser: Multi-Column Sorting', false, 'DiskBrowser.sortItems unavailable');
        }
      } catch (e) {
        LunoTestRunner.assert('DiskBrowser: Multi-Column Sorting', false, e.message);
      }

      try {
        if (typeof DiskBrowser !== 'undefined' && typeof DiskBrowser.filterItems === 'function') {
          var files = [
            { name: 'App.js', relativePath: 'src/App.js', dirPath: 'src' },
            { name: 'style.css', relativePath: 'css/style.css', dirPath: 'css' },
            { name: 'index.html', relativePath: 'index.html', dirPath: '' }
          ];

          DiskBrowser.selectedDirectory = 'src';
          DiskBrowser.filterType = 'all';
          DiskBrowser.searchQuery = '';
          var dirFiltered = DiskBrowser.filterItems(files);
          var dirOk = (dirFiltered.length === 1) && (dirFiltered[0].name === 'App.js');

          DiskBrowser.selectedDirectory = '';
          DiskBrowser.filterType = 'css';
          var typeFiltered = DiskBrowser.filterItems(files);
          var typeOk = (typeFiltered.length === 1) && (typeFiltered[0].name === 'style.css');

          DiskBrowser.selectedDirectory = '';
          DiskBrowser.filterType = 'all';

          LunoTestRunner.assert(
            'DiskBrowser: Directory Drill-Down & Type Filter Chips',
            dirOk && typeOk,
            'Filtered files by directory hierarchy and type chips cleanly'
          );
        } else {
          LunoTestRunner.assert('DiskBrowser: Directory Filtering', false, 'DiskBrowser.filterItems unavailable');
        }
      } catch (e) {
        LunoTestRunner.assert('DiskBrowser: Directory Drill-Down & Type Filter Chips', false, e.message);
      }
    }

  static async runHistoryTests() {
      try {
        if (typeof LunoHistoryManager !== 'undefined' && typeof LunoHistoryManager.recordChanges === 'function') {
          var mockDiffs = [{
            filePath: 'LunoParser/test_history.txt',
            target: 'LunoParser/test_history.txt',
            mode: 'test-write',
            linesAdded: 3,
            linesRemoved: 0,
            byteDelta: 24,
            oldContent: 'initial text\n',
            newContent: 'initial text\nadded line 1\nadded line 2\n'
          }];

          await LunoHistoryManager.recordChanges(mockDiffs, 'TestProj');
          var records = await LunoHistoryManager.getAllRecords('TestProj');
          var found = records.some(function(r) { return r.filePath === 'LunoParser/test_history.txt'; });

          await LunoHistoryManager.clearHistory('TestProj');

          LunoTestRunner.assert(
            'LunoHistoryManager: Snapshot Recording & IndexedDB Retrieval',
            Boolean(found),
            'Successfully recorded and retrieved file diff snapshot'
          );
        } else {
          LunoTestRunner.assert('LunoHistoryManager: Snapshot Recording', false, 'LunoHistoryManager unavailable');
        }
      } catch (e) {
        LunoTestRunner.assert('LunoHistoryManager: Snapshot Recording', false, e.message);
      }
    }
}

globalThis.LunoTestRunner = LunoTestRunner;
if (typeof module !== 'undefined' && module.exports) module.exports = LunoTestRunner;