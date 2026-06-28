/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CardConfig, Slicer, RowData, ColumnInfo } from './types';
import { ThemeId, getTheme, mix } from './themes';
import { buildChartModel } from './chartModel';
import { LUCIDE_ICONS } from './exportIcons';
// Inlined so exported dashboards run fully offline (no CDN):
import exportCss from './exportStyles.css?inline';
// Relative path bypasses chart.js's package "exports" map (which hides /dist).
import chartUmd from '../node_modules/chart.js/dist/chart.umd.js?raw';

export function generateHtmlDashboard(
  fileName: string,
  rows: RowData[],
  columns: ColumnInfo[],
  cards: CardConfig[],
  slicers: Slicer[],
  themeId: ThemeId = 'indigo',
  customPrimaryHex?: string
): string {
  const theme = getTheme(themeId, customPrimaryHex);

  // Escape text that is interpolated into the static HTML (filename / title).
  const esc = (s: unknown): string =>
    String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  // Serialize configurations. Escaping "<" prevents a "</script>" inside any
  // cell value from prematurely closing the embedded <script> tag (which would
  // both break JSON parsing and allow script injection).
  const safeJson = (o: unknown): string =>
    JSON.stringify(o).replace(/[<\u2028\u2029]/g, function (c) {
      return "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0");
    });

  const rowsJson = safeJson(rows);
  const columnsJson = safeJson(columns);
  const cardsJson = safeJson(cards);
  const slicersJson = safeJson(slicers);
  const safeFileName = esc(fileName);

  // Embed the EXACT same chart builder the live preview uses, so preview === export.
  const chartModelSrc = buildChartModel.toString();
  const paletteJson = safeJson({
    chartColor: theme.chartColor,
    hex100: theme.hex100,
    pieColors: theme.pieColors,
  });

  // Full brand scale as CSS variables (precompiled Tailwind maps brand-* to these).
  // 300/400/900/950 are derived from the 600 base for dark-mode tints.
  const brandRootCss = [
    `--brand-50:${theme.hex50}`,
    `--brand-100:${theme.hex100}`,
    `--brand-300:${mix(theme.hex600, '#ffffff', 0.5)}`,
    `--brand-400:${mix(theme.hex600, '#ffffff', 0.3)}`,
    `--brand-600:${theme.hex600}`,
    `--brand-700:${theme.hex700}`,
    `--brand-900:${mix(theme.hex600, '#000000', 0.45)}`,
    `--brand-950:${mix(theme.hex600, '#000000', 0.6)}`,
  ].join(';');
  const lucideIconsJson = safeJson(LUCIDE_ICONS);

  return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeFileName} - 互動式儀表板</title>

  <!-- Brand palette (per-theme) + precompiled Tailwind — fully offline, no CDN -->
  <style>:root{${brandRootCss}}</style>
  <style>${exportCss}</style>

  <!-- Chart.js (inlined UMD — offline) -->
  <script>${chartUmd}</script>

  <style>
    body {
      font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif;
    }
    .custom-scrollbar::-webkit-scrollbar {
      width: 6px;
      height: 6px;
    }
    .custom-scrollbar::-webkit-scrollbar-track {
      background: transparent;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
      background: #cbd5e1;
      border-radius: 3px;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
      background: #94a3b8;
    }
  </style>
</head>
<body class="bg-slate-50 text-slate-800 dark:bg-slate-950 dark:text-slate-100 min-h-screen flex flex-col transition-colors duration-200">

  <!-- Top Header Bar -->
  <header class="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-40 px-4 py-2.5 shadow-sm transition-colors duration-200">
    <div class="max-w-[1536px] mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-3">
      <div class="flex items-center gap-2.5">
        <div class="p-1.5 bg-brand-50 dark:bg-brand-950/40 text-brand-600 dark:text-brand-400 rounded-lg">
          <i data-lucide="layout-dashboard" class="w-5 h-5"></i>
        </div>
        <div>
          <div class="flex items-center gap-1.5">
            <h1 class="text-sm font-bold text-slate-900 dark:text-white tracking-tight font-display">${safeFileName}</h1>
            <span class="bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300 text-[9px] font-semibold px-1.5 py-0.5 rounded border border-brand-100 dark:border-brand-900 uppercase tracking-wider font-mono">
              High Density Mode
            </span>
          </div>
          <p class="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-1 mt-0.25">
            <i data-lucide="calendar" class="w-3 h-3"></i>
            匯出時間: <span id="export-time"></span> • 
            總資料筆數: <span class="font-semibold text-slate-700 dark:text-slate-300">${rows.length}</span> 筆
          </p>
        </div>
      </div>
      <div class="flex items-center gap-2 flex-wrap md:flex-nowrap">
        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-150 dark:border-emerald-900">
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          可攜式互動看板
        </span>

        <!-- Theme Mode Selector -->
        <div class="flex items-center gap-1 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg px-2 py-1 shadow-sm text-slate-600 dark:text-slate-300">
          <i data-lucide="sun" class="w-3.5 h-3.5 text-slate-400 dark:text-slate-500"></i>
          <select id="export-theme-mode" onchange="setThemeMode(this.value)" class="bg-transparent text-slate-700 dark:text-slate-200 text-[11px] font-bold outline-none cursor-pointer">
            <option value="light" class="bg-white dark:bg-slate-800 text-slate-800 dark:text-white">淺色模式 (Light)</option>
            <option value="dark" class="bg-white dark:bg-slate-800 text-slate-800 dark:text-white">深色模式 (Dark)</option>
            <option value="system" class="bg-white dark:bg-slate-800 text-slate-800 dark:text-white">系統同步 (System)</option>
          </select>
        </div>

        <button onclick="resetFilters()" class="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm">
          <i data-lucide="rotate-ccw" class="w-3 h-3"></i>
          重設篩選
        </button>
      </div>
    </div>
  </header>

  <div class="flex-1 max-w-[1536px] w-full mx-auto p-3 sm:p-4 lg:p-5 flex flex-col lg:flex-row gap-3.5">
    
    <!-- Left Sidebar: Slicers (Filters) -->
    <aside class="w-full lg:w-56 shrink-0 flex flex-col gap-3">
      <div class="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-3 sticky top-16 max-h-[85vh] flex flex-col transition-colors duration-200">
        <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2 mb-2.5">
          <div class="flex items-center gap-1.5 text-slate-800 dark:text-slate-200 font-bold text-xs">
            <i data-lucide="sliders-horizontal" class="w-3.5 h-3.5 text-brand-600"></i>
            <span>篩選器 (Slicers)</span>
          </div>
          <span id="active-filter-badge" class="hidden text-[9px] px-1.5 py-0.25 bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300 border border-brand-100 dark:border-brand-900 font-bold rounded"></span>
        </div>

        <div id="slicer-container" class="flex-1 overflow-y-auto custom-scrollbar space-y-3.5 pr-1">
          <!-- Slicers will be dynamically rendered here -->
          <div id="no-slicers-msg" class="text-xs text-slate-400 dark:text-slate-500 text-center py-6 hidden">
            未設定任何篩選器。
          </div>
        </div>
      </div>
    </aside>

    <!-- Main Content Panel: Dashboard Cards -->
    <main class="flex-1 flex flex-col gap-3.5">
      
      <!-- Filter status bar -->
      <div id="filter-summary-bar" class="hidden items-center justify-between bg-brand-50/50 dark:bg-brand-950/20 border border-brand-100 dark:border-brand-900 rounded-xl px-3 py-1.5 text-xs text-brand-700 dark:text-brand-300">
        <div class="flex items-center gap-1.5">
          <i data-lucide="info" class="w-3.5 h-3.5 text-brand-600 dark:text-brand-400 shrink-0"></i>
          <span>目前已套用篩選。顯示符合的資料：<strong id="filtered-count" class="text-slate-950 dark:text-white">0</strong> / ${rows.length} 筆 (佔 <strong id="filtered-pct" class="text-slate-950 dark:text-white">100%</strong>)</span>
        </div>
        <button onclick="resetFilters()" class="text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 font-bold">清除所有</button>
      </div>

      <!-- Dashboard Cards Grid -->
      <div id="dashboard-grid" class="grid grid-cols-1 md:grid-cols-6 gap-3">
        <!-- Cards will be dynamically rendered here -->
      </div>
    </main>

  </div>

  <footer class="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 py-4 px-6 text-center text-xs text-slate-400 dark:text-slate-500 mt-auto transition-colors duration-200">
    由 Spreadsheet Dashboard Generator 自動產生 • 單一檔案、完全離線運作（資料、樣式與圖表皆已內嵌，無需網路或伺服器）。
  </footer>

  <!-- RAW DATA & CONFIG EMBED -->
  <script id="raw-data-script" type="application/json">${rowsJson}</script>
  <script id="columns-script" type="application/json">${columnsJson}</script>
  <script id="cards-script" type="application/json">${cardsJson}</script>
  <script id="slicers-script" type="application/json">${slicersJson}</script>

  <!-- Inline Lucide icons (offline replacement for the lucide CDN) -->
  <script>
    (function () {
      var ICONS = ${lucideIconsJson};
      function createIcons() {
        document.querySelectorAll('[data-lucide]').forEach(function (el) {
          var inner = ICONS[el.getAttribute('data-lucide')];
          if (!inner) return;
          var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
          svg.setAttribute('viewBox', '0 0 24 24');
          svg.setAttribute('fill', 'none');
          svg.setAttribute('stroke', 'currentColor');
          svg.setAttribute('stroke-width', '2');
          svg.setAttribute('stroke-linecap', 'round');
          svg.setAttribute('stroke-linejoin', 'round');
          if (el.getAttribute('class')) svg.setAttribute('class', el.getAttribute('class'));
          svg.innerHTML = inner;
          el.replaceWith(svg);
        });
      }
      window.lucide = { createIcons: createIcons };
    })();
  </script>

  <!-- Interactive Logic Script -->
  <script>
    // 1. Core State
    let rawData = [];
    let columns = [];
    let cards = [];
    let slicers = [];
    
    let currentFilters = {}; // columnName -> Set of selected values
    let chartInstances = {}; // cardId -> ChartJS instance
    
    // Pagination for card tables
    let tablePagination = {}; // cardId -> currentPage
    let tableSorts = {}; // cardId -> { column, direction }
    let lastFilteredRows = []; // cache for table sorting trigger

    // Keep charts readable even with very high-cardinality columns.
    const MAX_CHART_CATEGORIES = 30;

    // Escape any spreadsheet-derived text before inserting it via innerHTML.
    function esc(s) {
      if (s === null || s === undefined) return '';
      return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    // Theme palette + the SHARED chart builder (identical to the live preview).
    // The builder source is captured via Function.prototype.toString(); esbuild's
    // keepNames option sprinkles __name(...) calls inside it whose helper lives in
    // the app bundle, so we provide an identity shim here for the standalone file.
    function __name(fn) { return fn; }
    const PALETTE = ${paletteJson};
    const buildChartModel = ${chartModelSrc};

    // 2. Initialize
    window.addEventListener('DOMContentLoaded', () => {
      // Parse embedded data
      try {
        rawData = JSON.parse(document.getElementById('raw-data-script').textContent);
        columns = JSON.parse(document.getElementById('columns-script').textContent);
        cards = JSON.parse(document.getElementById('cards-script').textContent);
        slicers = JSON.parse(document.getElementById('slicers-script').textContent);
      } catch (err) {
        console.error("Error parsing embedded data:", err);
      }

      // Set timestamp
      const now = new Date();
      document.getElementById('export-time').innerText = now.toLocaleString('zh-Hant');

      // Initialize filter state
      slicers.forEach(s => {
        currentFilters[s.columnName] = new Set();
      });

      // Render Slicer Sidebar UI
      renderSlicerSidebar();

      // Render Empty Dashboard Card Skeleton elements
      buildDashboardSkeleton();

      // Execute Filter & Update for the first time
      runFilterAndRender();

      // Initialize lucide icons
      lucide.createIcons();

      // Initialize theme/appearance mode
      const savedMode = localStorage.getItem('dashboard-appearance-mode') || 'light';
      document.getElementById('export-theme-mode').value = savedMode;
      setThemeMode(savedMode);
    });

    // 3. Render Slicer Sidebar Controls
    function renderSlicerSidebar() {
      const container = document.getElementById('slicer-container');
      const noMsg = document.getElementById('no-slicers-msg');
      container.innerHTML = '';

      if (slicers.length === 0) {
        noMsg.classList.remove('hidden');
        return;
      }
      noMsg.classList.add('hidden');

      slicers.forEach((slic, idx) => {
        const colName = slic.columnName;
        const colInfo = columns.find(c => c.name === colName);
        if (!colInfo) return;

        // Extract all unique values from rawData
        const uniqueValues = Array.from(new Set(
          rawData.map(row => {
            const val = row[colName];
            return val !== undefined && val !== null ? String(val).trim() : 'Blank';
          })
        )).sort();

        const filterBox = document.createElement('div');
        filterBox.className = 'border-b border-slate-100 dark:border-slate-800 pb-4 mb-4 last:border-0 last:pb-0 last:mb-0';
        filterBox.setAttribute('data-filter-box', String(idx));

        const colNameEsc = esc(colName);

        filterBox.innerHTML = \`
          <div class="flex items-center justify-between mb-1">
            <span class="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate" title="\${colNameEsc}">\${colNameEsc}</span>
            <div class="flex items-center gap-1.5 text-[10px]">
              <button type="button" data-action="all" data-col="\${colNameEsc}" class="text-brand-600 dark:text-brand-400 hover:underline">全選</button>
              <span class="text-slate-300 dark:text-slate-700">|</span>
              <button type="button" data-action="clear" data-col="\${colNameEsc}" class="text-slate-500 dark:text-slate-400 hover:underline">清空</button>
            </div>
          </div>

          <!-- Search in slicer -->
          \${uniqueValues.length > 6 ? \`
          <div class="relative mb-2">
            <input type="text" data-search-box placeholder="搜尋項目..."
                   class="w-full text-xs pl-7 pr-3 py-1 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-md focus:outline-none focus:border-brand-600 focus:ring-0" />
            <i data-lucide="search" class="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2"></i>
          </div>
          \` : ''}

          <div data-list class="max-h-40 overflow-y-auto custom-scrollbar space-y-1.5 pr-1 text-xs">
            \${uniqueValues.map(val => {
              const checked = currentFilters[colName].has(val) ? 'checked' : '';
              const valEsc = esc(val);
              return \`
                <label class="flex items-start gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer select-none transition-colors py-0.5" data-val="\${esc(val.toLowerCase())}">
                  <input type="checkbox" data-column="\${colNameEsc}" value="\${valEsc}"
                         class="rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-850 text-brand-600 focus:ring-brand-600 w-3.5 h-3.5 mt-0.5" \${checked} />
                  <span class="truncate" title="\${valEsc}">\${val === '' || val === 'Blank' ? '<em>(空白)</em>' : valEsc}</span>
                </label>
              \`;
            }).join('')}
          </div>
        \`;

        container.appendChild(filterBox);
      });

      // Event delegation — no spreadsheet text is ever placed into inline handlers.
      container.onclick = function (e) {
        const btn = e.target.closest('button[data-action]');
        if (!btn) return;
        toggleAllSlicerValues(btn.getAttribute('data-col'), btn.getAttribute('data-action') === 'all');
      };
      container.oninput = function (e) {
        const inp = e.target.closest('input[data-search-box]');
        if (inp) filterSlicerList(inp);
      };
      container.onchange = function (e) {
        const cb = e.target.closest('input[type="checkbox"][data-column]');
        if (cb) handleSlicerChange(cb);
      };

      lucide.createIcons();
    }

    // Dynamic filtering within the slicer list (scoped to the input's own box)
    function filterSlicerList(inputEl) {
      const q = inputEl.value.toLowerCase();
      const box = inputEl.closest('[data-filter-box]');
      if (!box) return;
      const listDiv = box.querySelector('[data-list]');
      if (!listDiv) return;
      const labels = listDiv.getElementsByTagName('label');

      for (let label of labels) {
        const valAttr = label.getAttribute('data-val') || '';
        if (valAttr.includes(q)) {
          label.classList.remove('hidden');
          label.classList.add('flex');
        } else {
          label.classList.remove('flex');
          label.classList.add('hidden');
        }
      }
    }

    // Toggle all slicer values on/off
    function toggleAllSlicerValues(colName, selectAll) {
      const filterSet = currentFilters[colName];
      if (!filterSet) return;
      filterSet.clear();

      // Match checkboxes by comparing the decoded data-column (avoids selector injection)
      const checkboxes = document.querySelectorAll('input[type="checkbox"][data-column]');
      checkboxes.forEach(cb => {
        if (cb.getAttribute('data-column') !== colName) return;
        cb.checked = selectAll;
        if (selectAll) filterSet.add(cb.value);
      });

      // Selecting everything is equivalent to no filter (empty set = show all).
      if (selectAll) filterSet.clear();

      runFilterAndRender();
    }

    // Handle single checkbox click
    function handleSlicerChange(input) {
      const colName = input.getAttribute('data-column');
      const val = input.value;
      const checked = input.checked;

      const filterSet = currentFilters[colName];
      if (checked) {
        filterSet.add(val);
      } else {
        filterSet.delete(val);
      }

      runFilterAndRender();
    }

    // Reset all filters in sidebar
    function resetFilters() {
      Object.keys(currentFilters).forEach(key => {
        currentFilters[key].clear();
      });

      // Uncheck everything
      const checkboxes = document.querySelectorAll('input[type="checkbox"]');
      checkboxes.forEach(cb => {
        cb.checked = false;
      });

      runFilterAndRender();
    }

    // 4. Data Filter Engine
    function runFilterAndRender() {
      // Determine active filters
      let isFiltering = false;
      const activeFilterColumns = [];

      Object.keys(currentFilters).forEach(col => {
        if (currentFilters[col].size > 0) {
          isFiltering = true;
          activeFilterColumns.push(col);
        }
      });

      // Filter rows
      let filteredData = rawData;
      if (isFiltering) {
        filteredData = rawData.filter(row => {
          return activeFilterColumns.every(col => {
            const val = row[col];
            const strVal = val !== undefined && val !== null ? String(val).trim() : 'Blank';
            return currentFilters[col].has(strVal);
          });
        });
      }

      // Update Top Status Bar
      const summaryBar = document.getElementById('filter-summary-bar');
      const badge = document.getElementById('active-filter-badge');

      if (isFiltering) {
        summaryBar.classList.remove('hidden');
        summaryBar.classList.add('flex');
        
        badge.classList.remove('hidden');
        badge.innerText = \`已套用 \${activeFilterColumns.length} 個篩選\`;

        const countSpan = document.getElementById('filtered-count');
        const pctSpan = document.getElementById('filtered-pct');
        countSpan.innerText = filteredData.length.toLocaleString();
        
        const pct = ((filteredData.length / rawData.length) * 100).toFixed(1);
        pctSpan.innerText = pct + '%';
      } else {
        summaryBar.classList.remove('flex');
        summaryBar.classList.add('hidden');
        badge.classList.add('hidden');
      }

      // Update Cards
      updateDashboardCards(filteredData);
    }

    // 5. Build Dashboard Skeleton Grid
    function buildDashboardSkeleton() {
      const grid = document.getElementById('dashboard-grid');
      grid.innerHTML = '';

      if (cards.length === 0) {
        grid.innerHTML = \`
          <div class="col-span-1 md:col-span-6 flex flex-col items-center justify-center py-20 text-slate-400 dark:text-slate-500">
            <i data-lucide="layout" class="w-12 h-12 stroke-1 mb-3"></i>
            <p class="text-sm">尚未設定任何資訊卡片。</p>
          </div>
        \`;
        return;
      }

      cards.forEach((card, idx) => {
        // Determine grid colspan based on card width
        let colSpanClass = 'col-span-1 md:col-span-6';
        if (card.width === '1/3') colSpanClass = 'col-span-1 md:col-span-2';
        else if (card.width === '1/2') colSpanClass = 'col-span-1 md:col-span-3';
        else if (card.width === '2/3') colSpanClass = 'col-span-1 md:col-span-4';

        const cardElement = document.createElement('div');
        cardElement.id = \`card-\${card.id}\`;
        cardElement.className = \`bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-sm p-3.5 flex flex-col h-fit overflow-hidden transition-colors duration-200 \${colSpanClass}\`;
        
        // Inside structure based on Card Type
        if (card.type === 'metric') {
          cardElement.innerHTML = \`
            <div class="flex items-center justify-between mb-1.5">
              <span class="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider truncate" title="\${esc(card.title)}">\${esc(card.title)}</span>
              <div class="p-1.5 bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 rounded-lg">
                <i data-lucide="calculator" class="w-3.5 h-3.5"></i>
              </div>
            </div>
            <div class="flex flex-col mt-0.5">
              <span id="metric-val-\${card.id}" class="text-2xl font-bold text-slate-900 dark:text-white tracking-tight font-display">0</span>
              <span id="metric-sub-\${card.id}" class="text-[9px] text-slate-400 dark:text-slate-500 mt-0.5 truncate"></span>
            </div>
          \`;
        } else if (card.type === 'chart') {
          cardElement.innerHTML = \`
            <div class="flex items-center justify-between mb-2 border-b border-slate-100 dark:border-slate-800 pb-1.5">
              <span class="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate" title="\${esc(card.title)}">\${esc(card.title)}</span>
              <div class="p-1 bg-brand-50 dark:bg-brand-950/40 text-brand-600 dark:text-brand-400 rounded">
                <i data-lucide="bar-chart-3" class="w-3.5 h-3.5"></i>
              </div>
            </div>
            <div class="relative h-52 w-full flex items-center justify-center">
              <canvas id="chart-canvas-\${card.id}"></canvas>
              <div id="chart-overlay-\${card.id}" class="absolute pointer-events-none flex-col items-center justify-center hidden">
                <span id="chart-overlay-pct-\${card.id}" class="text-base font-extrabold text-slate-800 dark:text-slate-100 font-display">0%</span>
                <span id="chart-overlay-lbl-\${card.id}" class="text-[9px] text-slate-400 dark:text-slate-500 font-semibold tracking-wide">達成率</span>
              </div>
            </div>
          \`;
        } else if (card.type === 'table') {
          tablePagination[card.id] = 0; // page 0
          cardElement.innerHTML = \`
            <div class="flex items-center justify-between mb-2 border-b border-slate-100 dark:border-slate-800 pb-1.5">
              <span class="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate" title="\${esc(card.title)}">\${esc(card.title)}</span>
              <span class="text-[9px] bg-slate-100 dark:bg-slate-800 px-2 py-0.25 rounded text-slate-500 dark:text-slate-400 font-mono" id="table-badge-\${card.id}"></span>
            </div>
            <div class="overflow-x-auto custom-scrollbar border border-slate-100 dark:border-slate-800 rounded-lg mb-2">
              <table class="w-full text-left border-collapse text-[11px]">
                <thead>
                  <tr id="th-\${card.id}" class="bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-medium">
                    <!-- Column headers -->
                  </tr>
                </thead>
                <tbody id="tb-\${card.id}" class="text-slate-600 dark:text-slate-300 divide-y divide-slate-100 dark:divide-slate-800">
                  <!-- Row data -->
                </tbody>
                <tfoot id="tf-\${card.id}">
                  <!-- Subtotal data -->
                </tfoot>
              </table>
            </div>
            <!-- Pagination -->
            <div class="flex items-center justify-between mt-auto pt-1.5 text-[10px] text-slate-500 dark:text-slate-400 border-t border-slate-50 dark:border-slate-800">
              <span id="table-info-\${card.id}"></span>
              <div class="flex gap-1">
                <button id="btn-prev-\${card.id}" class="px-1.5 py-0.5 bg-slate-50 dark:bg-slate-850 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 text-[10px]" disabled>上一頁</button>
                <button id="btn-next-\${card.id}" class="px-1.5 py-0.5 bg-slate-50 dark:bg-slate-850 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 text-[10px]" disabled>下一頁</button>
              </div>
            </div>
          \`;
        }

        grid.appendChild(cardElement);
      });
      lucide.createIcons();
    }

    // 6. Update Cards Content Dynamically based on Filtered Data
    function updateDashboardCards(filteredRows) {
      lastFilteredRows = filteredRows;
      cards.forEach(card => {
        if (card.type === 'metric') {
          renderMetricCard(card, filteredRows);
        } else if (card.type === 'chart') {
          renderChartCard(card, filteredRows);
        } else if (card.type === 'table') {
          renderTableCard(card, filteredRows);
        }
      });
    }

    // A. Render single metric card
    function renderMetricCard(card, filteredRows) {
      const config = card.metric;
      if (!config) return;

      const valSpan = document.getElementById(\`metric-val-\${card.id}\`);
      const subSpan = document.getElementById(\`metric-sub-\${card.id}\`);

      const colName = config.column;
      const op = config.operation;

      // Extract numeric values
      const numbers = filteredRows
        .map(r => Number(r[colName]))
        .filter(n => !isNaN(n));

      let result = 0;
      if (op === 'COUNT') {
        // Count non-empty values of the chosen column.
        result = filteredRows.reduce(function (c, r) {
          const v = r[colName];
          return c + (v !== undefined && v !== null && String(v).trim() !== '' ? 1 : 0);
        }, 0);
      } else if (numbers.length > 0) {
        if (op === 'SUM') result = numbers.reduce((a, b) => a + b, 0);
        else if (op === 'AVG') result = numbers.reduce((a, b) => a + b, 0) / numbers.length;
        // reduce instead of Math.min/max(...arr) to avoid call-stack overflow on huge datasets
        else if (op === 'MIN') result = numbers.reduce((m, v) => (v < m ? v : m), numbers[0]);
        else if (op === 'MAX') result = numbers.reduce((m, v) => (v > m ? v : m), numbers[0]);
        else if (op === 'MEDIAN') {
          const sorted = [...numbers].sort((a, b) => a - b);
          const mid = Math.floor(sorted.length / 2);
          result = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
        }
      }

      // Format result
      let formatted = result.toLocaleString(undefined, { maximumFractionDigits: 2 });
      if (config.prefix) formatted = config.prefix + ' ' + formatted;
      if (config.suffix) formatted = formatted + ' ' + config.suffix;

      valSpan.innerText = formatted;
      subSpan.innerText = \`欄位: \${colName} (\${op})\`;
    }

    // B. Render single chart card
    function renderChartCard(card, filteredRows) {
      const config = card.chart;
      if (!config) return;
      const canvas = document.getElementById('chart-canvas-' + card.id);
      if (!canvas) return;
      try {
        const isDark = document.documentElement.classList.contains('dark');
        const model = buildChartModel(config, filteredRows, PALETTE, isDark, MAX_CHART_CATEGORIES);

        if (chartInstances[card.id]) chartInstances[card.id].destroy();
        chartInstances[card.id] = new Chart(canvas, { type: model.type, data: model.data, options: model.options });

        const overlayEl = document.getElementById('chart-overlay-' + card.id);
        if (overlayEl) {
          if (model.donut && model.donut.isProgress) {
            overlayEl.classList.remove('hidden');
            overlayEl.classList.add('flex');
            if (model.donut.range === 'half') {
              overlayEl.className = 'absolute pointer-events-none flex flex-col items-center justify-center bottom-8';
            } else {
              overlayEl.className = 'absolute pointer-events-none flex flex-col items-center justify-center inset-0';
            }
            document.getElementById('chart-overlay-pct-' + card.id).innerText = model.donut.percent + '%';
          } else {
            overlayEl.classList.remove('flex');
            overlayEl.classList.add('hidden');
          }
        }
      } catch (err) {
        console.error('Error rendering chart for card ' + card.id + ':', err);
      }
    }

    // C. Render single Table Card (with client-side pagination)
    function renderTableCard(card, filteredRows) {
      const config = card.table;
      if (!config) return;

      const cardId = card.id;
      const isGrouped = !!config.groupByColumn;

      const displayCols = isGrouped
        ? [config.groupByColumn, ...(config.subtotalColumns && config.subtotalColumns.length > 0
            ? config.subtotalColumns
            : Object.keys(filteredRows[0] || {}).filter(k => k !== config.groupByColumn && !isNaN(Number(filteredRows[0]?.[k] || ''))))]
        : (config.columns.length > 0 ? config.columns : Object.keys(filteredRows[0] || {}));

      const pageSize = config.pageSize || 10;

      // Group and aggregate if groupByColumn is set
      let baseRows = [];
      if (isGrouped && config.groupByColumn) {
        const groupCol = config.groupByColumn;
        const groups = {};

        filteredRows.forEach(row => {
          const keyVal = row[groupCol] !== undefined && row[groupCol] !== null ? String(row[groupCol]) : '(空白)';
          if (!groups[keyVal]) {
            groups[keyVal] = {
              [groupCol]: keyVal
            };
            displayCols.slice(1).forEach(col => {
              groups[keyVal][col] = 0;
            });
          }

          displayCols.slice(1).forEach(col => {
            const v = Number(row[col]);
            if (!isNaN(v)) {
              groups[keyVal][col] = (groups[keyVal][col] || 0) + v;
            }
          });
        });

        baseRows = Object.values(groups);
      } else {
        baseRows = [...filteredRows];
      }
      
      // Sort Rows if sorted
      let sortedRows = [...baseRows];
      const sortConfig = tableSorts[cardId];
      if (sortConfig) {
        const { column, direction } = sortConfig;
        sortedRows.sort((a, b) => {
          const valA = a[column];
          const valB = b[column];
          
          const numA = Number(valA);
          const numB = Number(valB);
          const isNumA = !isNaN(numA) && valA !== null && valA !== '';
          const isNumB = !isNaN(numB) && valB !== null && valB !== '';
          
          if (isNumA && isNumB) {
            return direction === 'asc' ? numA - numB : numB - numA;
          }
          
          const strA = valA !== undefined && valA !== null ? String(valA) : '';
          const strB = valB !== undefined && valB !== null ? String(valB) : '';
          return direction === 'asc'
            ? strA.localeCompare(strB, 'zh-TW', { numeric: true })
            : strB.localeCompare(strA, 'zh-TW', { numeric: true });
        });
      }

      const totalRows = sortedRows.length;
      const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
      
      // Keep current page within boundaries
      if (tablePagination[cardId] >= totalPages) {
        tablePagination[cardId] = totalPages - 1;
      }
      if (tablePagination[cardId] < 0) {
        tablePagination[cardId] = 0;
      }
      
      const currPage = tablePagination[cardId];
      const startIdx = currPage * pageSize;
      const endIdx = Math.min(startIdx + pageSize, totalRows);
      const slicedRows = sortedRows.slice(startIdx, endIdx);

      // Render Headers
      const thTr = document.getElementById(\`th-\${cardId}\`);
      thTr.innerHTML = displayCols.map(col => {
        let sortIcon = '';
        if (sortConfig && sortConfig.column === col) {
          if (sortConfig.direction === 'asc') {
            sortIcon = '<i data-lucide="arrow-up" class="w-3.5 h-3.5 ml-1 inline-block shrink-0 text-slate-700 dark:text-slate-300"></i>';
          } else {
            sortIcon = '<i data-lucide="arrow-down" class="w-3.5 h-3.5 ml-1 inline-block shrink-0 text-slate-700 dark:text-slate-300"></i>';
          }
        } else {
          sortIcon = '<i data-lucide="arrow-up-down" class="w-2.5 h-2.5 ml-1 inline-block text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 shrink-0"></i>';
        }
        const colEsc = esc(col);
        return \`
          <th class="px-2 py-1.5 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-100 dark:border-slate-800 text-left shrink-0 truncate max-w-[150px] cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 select-none group"
              title="\${colEsc} - 點擊以排序"
              data-col="\${colEsc}">
            <div class="flex items-center gap-0.5 truncate">
              <span class="truncate">\${colEsc}</span>
              \${sortIcon}
            </div>
          </th>
        \`;
      }).join('');

      // Delegated sort handler (column names never enter inline JS). onclick
      // property assignment overwrites cleanly on each re-render — no duplicates.
      thTr.onclick = function (e) {
        const th = e.target.closest('th[data-col]');
        if (th) handleTableSort(cardId, th.getAttribute('data-col'));
      };

      // Render Rows
      const tb = document.getElementById(\`tb-\${cardId}\`);
      tb.innerHTML = '';

      if (slicedRows.length === 0) {
        tb.innerHTML = \`
          <tr>
            <td colspan="\${displayCols.length}" class="px-2 py-4 text-center text-slate-400 dark:text-slate-500 italic">
              無相符資料。
            </td>
          </tr>
        \`;
      } else {
        slicedRows.forEach(row => {
          const rowHtml = displayCols.map(col => {
            const rawVal = row[col];
            const strVal = rawVal !== undefined && rawVal !== null ? String(rawVal) : '';
            const isNum = !isNaN(Number(rawVal)) && strVal !== '';
            const alignClass = isNum ? 'text-right font-mono' : 'text-left';
            const displayVal = isNum ? Number(rawVal).toLocaleString(undefined, { maximumFractionDigits: 2 }) : strVal;
            return \`<td class="px-2 py-1 border-b border-slate-100 dark:border-slate-800 truncate max-w-[150px] \${alignClass}" title="\${esc(displayVal)}">\${esc(displayVal)}</td>\`;
          }).join('');
          
          const tr = document.createElement('tr');
          tr.className = 'hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors';
          tr.innerHTML = rowHtml;
          tb.appendChild(tr);
        });
      }

      // Render Subtotal if configured
      const tf = document.getElementById(\`tf-\${cardId}\`);
      if (tf) {
        const hasFooter = (isGrouped && displayCols.length > 1) || (!isGrouped && config.subtotalColumns && config.subtotalColumns.length > 0);
        if (hasFooter) {
          tf.className = "bg-slate-50 dark:bg-slate-800/80 border-t-2 border-slate-200 dark:border-slate-700 font-semibold text-slate-700 dark:text-slate-200";
          // Built with plain string concatenation (no nested template literals)
          // so the runtime evaluates it instead of printing the source.
          const footerCells = displayCols.map(function (col, idx) {
            const isFirst = idx === 0;
            const isSumCol = isGrouped ? idx > 0 : (config.subtotalColumns && config.subtotalColumns.includes(col));

            if (isFirst) {
              const labelText = isGrouped ? '總計 (Total)' : '小計 (Subtotal)';
              return '<td class="px-2 py-1.5 text-left text-[10px] font-bold text-slate-500 dark:text-slate-400">' + esc(labelText) + '</td>';
            }

            if (isSumCol) {
              const sumVal = filteredRows.reduce(function (sum, r) {
                const v = Number(r[col]);
                return sum + (isNaN(v) ? 0 : v);
              }, 0);
              return '<td class="px-2 py-1.5 text-right font-mono text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">' + sumVal.toLocaleString(undefined, { maximumFractionDigits: 2 }) + '</td>';
            }

            return '<td class="px-2 py-1.5"></td>';
          }).join('');
          tf.innerHTML = '<tr>' + footerCells + '</tr>';
        } else {
          tf.innerHTML = '';
          tf.className = '';
        }
      }

      // Update Pagination UI
      document.getElementById(\`table-badge-\${cardId}\`).innerText = \`共 \${totalRows} 筆\`;
      
      const infoSpan = document.getElementById(\`table-info-\${cardId}\`);
      if (totalRows > 0) {
        infoSpan.innerText = \`顯示 \${startIdx + 1} - \${endIdx} 筆，共 \${totalRows} 筆 (頁次 \${currPage + 1}/\${totalPages})\`;
      } else {
        infoSpan.innerText = '顯示 0 - 0 筆，共 0 筆';
      }

      // Hook up buttons
      const btnPrev = document.getElementById(\`btn-prev-\${cardId}\`);
      const btnNext = document.getElementById(\`btn-next-\${cardId}\`);

      btnPrev.disabled = currPage === 0;
      btnNext.disabled = currPage >= totalPages - 1;

      btnPrev.onclick = () => {
        tablePagination[cardId]--;
        renderTableCard(card, filteredRows);
      };

      btnNext.onclick = () => {
        tablePagination[cardId]++;
        renderTableCard(card, filteredRows);
      };
    }

    // Sort Click handler
    window.handleTableSort = function(cardId, col) {
      const currentSort = tableSorts[cardId];
      if (!currentSort || currentSort.column !== col) {
        tableSorts[cardId] = { column: col, direction: 'asc' };
      } else if (currentSort.direction === 'asc') {
        tableSorts[cardId] = { column: col, direction: 'desc' };
      } else {
        delete tableSorts[cardId];
      }
      
      tablePagination[cardId] = 0;
      
      const card = cards.find(c => c.id === cardId);
      if (card) {
        renderTableCard(card, lastFilteredRows);
      }
      lucide.createIcons();
    };

    // Theme and Appearance Mode Support
    function setThemeMode(mode) {
      localStorage.setItem('dashboard-appearance-mode', mode);
      const root = document.documentElement;
      let isDark = false;
      
      if (mode === 'dark') {
        root.classList.add('dark');
        isDark = true;
      } else if (mode === 'light') {
        root.classList.remove('dark');
        isDark = false;
      } else {
        // system
        isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (isDark) {
          root.classList.add('dark');
        } else {
          root.classList.remove('dark');
        }
      }
      
      // Rebuild charts so grid/axis/series colors are regenerated for the new mode
      // (the model is the single source of truth — no per-property patching).
      if (lastFilteredRows && cards && cards.length) {
        updateDashboardCards(lastFilteredRows);
      }
    }

  </script>
</body>
</html>`;
}
