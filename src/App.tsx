/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  RowData,
  ColumnInfo,
  Slicer,
  CalculatedColumn,
  CardConfig,
  PresetTemplateId,
} from './types';
import { analyzeColumns, compileFormula } from './utils';
import { generateHtmlDashboard } from './exportTemplate';
import { ThemeId, THEME_PRESETS, getTheme } from './themes';

import UploadZone from './components/UploadZone';
import DashboardCards from './components/DashboardCards';
import { SlicerConfigurator, SlicerFilterPanel } from './components/SlicerSelector';
import CalculatedColumns from './components/CalculatedColumns';
import CardEditor from './components/CardEditor';
import ErrorBoundary from './components/ErrorBoundary';

import {
  FileSpreadsheet,
  Download,
  RotateCcw,
  Plus,
  LayoutGrid,
  TrendingUp,
  BarChart2,
  Sliders,
  ChevronDown,
  ChevronUp,
  Calculator,
  LayoutTemplate,
  Info,
  Palette,
  Sun,
  Moon,
  Monitor,
} from 'lucide-react';

export default function App() {
  // 1. Base Data State
  const [fileName, setFileName] = useState<string | null>(null);
  const [originalRows, setOriginalRows] = useState<RowData[] | null>(null);

  // 2. Calculations & Schema State
  const [calculatedColumns, setCalculatedColumns] = useState<CalculatedColumn[]>([]);

  // 3. Slicer Configuration State
  const [slicers, setSlicers] = useState<Slicer[]>([]);

  // 4. Layout Template State
  const [currentTemplateId, setCurrentTemplateId] = useState<PresetTemplateId>('preset-sales');
  const [customCards, setCustomCards] = useState<CardConfig[]>([]);

  // 5. Card Editor State
  const [editingCard, setEditingCard] = useState<CardConfig | null>(null);
  const [isAddingCard, setIsAddingCard] = useState(false);

  // 6. Accordion/Collapsible UI state
  const [isCalcsOpen, setIsCalcsOpen] = useState(false);
  const [isSlicersOpen, setIsSlicersOpen] = useState(false);

  // 7. Theme state & Custom color picking
  const [currentThemeId, setCurrentThemeId] = useState<ThemeId>('indigo');
  const [customPrimaryHex, setCustomPrimaryHex] = useState<string>(() => {
    return localStorage.getItem('dashboard-custom-primary-hex') || '#4f46e5';
  });
  const currentTheme = useMemo(() => getTheme(currentThemeId, customPrimaryHex), [currentThemeId, customPrimaryHex]);

  // 8. Persistent Saved Layouts state
  interface SavedLayout {
    id: string;
    name: string;
    cards: CardConfig[];
    slicers: Slicer[];
    calculatedColumns: CalculatedColumn[];
    themeId: ThemeId;
    customPrimaryHex?: string;
    createdAt: string;
  }
  const [savedLayouts, setSavedLayouts] = useState<SavedLayout[]>(() => {
    try {
      const stored = localStorage.getItem('dashboard-saved-layouts');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [newLayoutName, setNewLayoutName] = useState('');

  // 9. Dark/Light/System Theme Mode State
  const [colorMode, setColorMode] = useState<'light' | 'dark' | 'system'>(() => {
    return (localStorage.getItem('dashboard-color-mode') as 'light' | 'dark' | 'system') || 'light';
  });

  // Sync Color Mode to HTML tag
  useEffect(() => {
    localStorage.setItem('dashboard-color-mode', colorMode);
    const root = document.documentElement;
    
    const applyMode = (mode: 'light' | 'dark' | 'system') => {
      if (mode === 'dark') {
        root.classList.add('dark');
      } else if (mode === 'light') {
        root.classList.remove('dark');
      } else {
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (isDark) {
          root.classList.add('dark');
        } else {
          root.classList.remove('dark');
        }
      }
    };

    applyMode(colorMode);

    if (colorMode === 'system') {
      const media = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = (e: MediaQueryListEvent) => {
        if (e.matches) {
          root.classList.add('dark');
        } else {
          root.classList.remove('dark');
        }
      };
      media.addEventListener('change', listener);
      return () => media.removeEventListener('change', listener);
    }
  }, [colorMode]);

  // ---------------------------------------------------------------------------
  // PIPELINE STEP A: Calculate Dynamic Columns on raw data rows
  // ---------------------------------------------------------------------------
  const recalculatedRows = useMemo(() => {
    if (!originalRows) return [];

    // Compile any free-form formulas ONCE (not per row).
    const compiled = calculatedColumns.map((cc) =>
      cc.expr ? compileFormula(cc.expr) : null
    );

    return originalRows.map((row) => {
      const copy = { ...row };

      calculatedColumns.forEach((cc, idx) => {
        const fx = compiled[idx];
        if (fx) {
          // Advanced formula mode
          copy[cc.name] = fx.ok ? fx.evaluate(copy) : 0;
          return;
        }

        // Legacy two-operand mode
        const valA = Number(copy[cc.colA as string]);
        const valB =
          cc.operandBType === 'column' && cc.colB
            ? Number(copy[cc.colB])
            : Number(cc.constantB);

        let result = 0;
        if (!isNaN(valA) && !isNaN(valB)) {
          switch (cc.operator) {
            case '+':
              result = valA + valB;
              break;
            case '-':
              result = valA - valB;
              break;
            case '*':
              result = valA * valB;
              break;
            case '/':
              result = valB !== 0 ? valA / valB : 0;
              break;
          }
        }
        copy[cc.name] = result;
      });

      return copy;
    });
  }, [originalRows, calculatedColumns]);

  // ---------------------------------------------------------------------------
  // PIPELINE STEP B: Extract Column Metadata and Types from recalculated rows
  // ---------------------------------------------------------------------------
  const columns = useMemo(() => {
    return analyzeColumns(recalculatedRows);
  }, [recalculatedRows]);

  // ---------------------------------------------------------------------------
  // PIPELINE STEP C: Auto-Assign Template Cards based on detected columns
  // ---------------------------------------------------------------------------
  const activeCards = useMemo(() => {
    if (currentTemplateId === 'preset-custom') {
      return customCards;
    }

    // Dynamic generation of cards for presets based on the uploaded data's columns
    const numCols = columns.filter((c) => c.isNumeric).map((c) => c.name);
    const strCols = columns.filter((c) => !c.isNumeric).map((c) => c.name);

    const defaultNum = numCols[0] || columns[0]?.name || '';
    const secondaryNum = numCols[1] || numCols[0] || columns[0]?.name || '';
    const defaultCat = strCols[0] || columns[0]?.name || '';
    const secondaryCat = strCols[1] || strCols[0] || columns[0]?.name || '';

    if (currentTemplateId === 'preset-sales') {
      return [
        {
          id: 'sales-metric-sum',
          title: defaultNum ? `總 ${defaultNum} 加總` : '資料總計',
          type: 'metric' as const,
          width: '1/3' as const,
          metric: { column: defaultNum, operation: 'SUM' as const, prefix: '' },
        },
        {
          id: 'sales-metric-avg',
          title: defaultNum ? `平均 ${defaultNum}` : '平均數值',
          type: 'metric' as const,
          width: '1/3' as const,
          metric: { column: defaultNum, operation: 'AVG' as const },
        },
        {
          id: 'sales-metric-count',
          title: '總資料筆數',
          type: 'metric' as const,
          width: '1/3' as const,
          metric: { column: defaultNum, operation: 'COUNT' as const, suffix: '筆' },
        },
        {
          id: 'sales-chart-bar',
          title: defaultCat && defaultNum ? `各 ${defaultCat} 之 ${defaultNum} 加總` : '分類統計圖',
          type: 'chart' as const,
          width: '1/2' as const,
          chart: {
            type: 'bar' as const,
            xAxisColumn: defaultCat,
            yAxisColumn: defaultNum,
            aggregate: 'SUM' as const,
          },
        },
        {
          id: 'sales-chart-pie',
          title: secondaryCat && defaultNum ? `各 ${secondaryCat} 之 ${defaultNum} 平均佔比` : '維度比例圖',
          type: 'chart' as const,
          width: '1/2' as const,
          chart: {
            type: 'pie' as const,
            xAxisColumn: secondaryCat,
            yAxisColumn: defaultNum,
            aggregate: 'AVG' as const,
          },
        },
        {
          id: 'sales-table-detail',
          title: '明細資料表',
          type: 'table' as const,
          width: 'full' as const,
          table: {
            columns: columns.slice(0, 6).map((c) => c.name),
            pageSize: 8,
          },
        },
      ];
    }

    if (currentTemplateId === 'preset-ops') {
      return [
        {
          id: 'ops-metric-avg',
          title: secondaryNum ? `平均 ${secondaryNum}` : '指標平均',
          type: 'metric' as const,
          width: '1/3' as const,
          metric: { column: secondaryNum, operation: 'AVG' as const },
        },
        {
          id: 'ops-metric-max',
          title: secondaryNum ? `最大 ${secondaryNum}` : '最高指標',
          type: 'metric' as const,
          width: '1/3' as const,
          metric: { column: secondaryNum, operation: 'MAX' as const },
        },
        {
          id: 'ops-metric-min',
          title: secondaryNum ? `最小 ${secondaryNum}` : '最低指標',
          type: 'metric' as const,
          width: '1/3' as const,
          metric: { column: secondaryNum, operation: 'MIN' as const },
        },
        {
          id: 'ops-chart-area',
          title: defaultCat && secondaryNum ? `各 ${defaultCat} 之 ${secondaryNum} 平均值分佈` : '指標分佈趨勢',
          type: 'chart' as const,
          width: 'full' as const,
          chart: {
            type: 'area' as const,
            xAxisColumn: defaultCat,
            yAxisColumn: secondaryNum,
            aggregate: 'AVG' as const,
          },
        },
        {
          id: 'ops-table-detail',
          title: '資料詳細列表',
          type: 'table' as const,
          width: 'full' as const,
          table: {
            columns: columns.slice(0, 8).map((c) => c.name),
            pageSize: 10,
          },
        },
      ];
    }

    if (currentTemplateId === 'preset-minimal') {
      return [
        {
          id: 'min-metric-sum',
          title: defaultNum ? `${defaultNum} 加總` : '資料總計',
          type: 'metric' as const,
          width: '1/2' as const,
          metric: { column: defaultNum, operation: 'SUM' as const },
        },
        {
          id: 'min-metric-count',
          title: '總筆數',
          type: 'metric' as const,
          width: '1/2' as const,
          metric: { column: defaultNum, operation: 'COUNT' as const, suffix: '筆' },
        },
        {
          id: 'min-chart-line',
          title: defaultCat && defaultNum ? `${defaultCat} 的 ${defaultNum} 平均趨勢` : '數據折線走勢',
          type: 'chart' as const,
          width: 'full' as const,
          chart: {
            type: 'line' as const,
            xAxisColumn: defaultCat,
            yAxisColumn: defaultNum,
            aggregate: 'AVG' as const,
          },
        },
      ];
    }

    return [];
  }, [columns, currentTemplateId, customCards]);

  // ---------------------------------------------------------------------------
  // PIPELINE STEP D: Filter rows dynamically based on Slicer values selected
  // ---------------------------------------------------------------------------
  const filteredRows = useMemo(() => {
    let filtered = recalculatedRows;

    slicers.forEach((slic) => {
      if (slic.selectedValues.length > 0) {
        filtered = filtered.filter((row) => {
          const rowVal = row[slic.columnName];
          const strVal =
            rowVal !== undefined && rowVal !== null ? String(rowVal).trim() : 'Blank';
          return slic.selectedValues.includes(strVal);
        });
      }
    });

    return filtered;
  }, [recalculatedRows, slicers]);

  // ---------------------------------------------------------------------------
  // HANDLERS
  // ---------------------------------------------------------------------------
  const handleDataLoaded = (name: string, rows: RowData[]) => {
    setFileName(name);
    setOriginalRows(rows);
    setCalculatedColumns([]);

    // Extract dynamic metadata to choose default slicers
    const analyzedCols = analyzeColumns(rows);
    const textCols = analyzedCols.filter((c) => !c.isNumeric).map((c) => c.name);
    const initialSlicers = textCols.slice(0, 2).map((col) => ({
      columnName: col,
      selectedValues: [],
    }));

    setSlicers(initialSlicers);
    setCurrentTemplateId('preset-sales');
    setCustomCards([]);
    setIsAddingCard(false);
    setEditingCard(null);
  };

  const handleToggleSlicer = (colName: string) => {
    const exists = slicers.some((s) => s.columnName === colName);
    if (exists) {
      setSlicers(slicers.filter((s) => s.columnName !== colName));
    } else {
      setSlicers([...slicers, { columnName: colName, selectedValues: [] }]);
    }
  };

  const handleSlicerValuesChange = (colName: string, selected: string[]) => {
    setSlicers(
      slicers.map((s) =>
        s.columnName === colName ? { ...s, selectedValues: selected } : s
      )
    );
  };

  const handleResetAllFilters = () => {
    setSlicers(slicers.map((s) => ({ ...s, selectedValues: [] })));
  };

  const handleAddCalculatedColumn = (newCol: CalculatedColumn) => {
    setCalculatedColumns([...calculatedColumns, newCol]);
  };

  const handleRemoveCalculatedColumn = (colName: string) => {
    setCalculatedColumns(calculatedColumns.filter((cc) => cc.name !== colName));
    
    // Clear slicers that might use this column if any
    setSlicers(slicers.filter((s) => s.columnName !== colName));
  };

  const handleSaveCard = (card: CardConfig) => {
    const isEdit = customCards.some((c) => c.id === card.id);
    if (isEdit) {
      setCustomCards(customCards.map((c) => (c.id === card.id ? card : c)));
    } else {
      setCustomCards([...customCards, card]);
    }
    setIsAddingCard(false);
    setEditingCard(null);
  };

  const handleDeleteCard = (cardId: string) => {
    setCustomCards(customCards.filter((c) => c.id !== cardId));
  };

  const handleReorderCards = (reordered: CardConfig[]) => {
    setCustomCards(reordered);
  };

  const handleStartAddCard = () => {
    setEditingCard(null);
    setIsAddingCard(true);
  };

  const handleStartEditCard = (card: CardConfig) => {
    setEditingCard(card);
    setIsAddingCard(true);
  };

  const handleTemplateChange = (templateId: PresetTemplateId) => {
    setCurrentTemplateId(templateId);
    if (templateId === 'preset-custom' && customCards.length === 0) {
      // If switching to custom, populate with current preset cards as a starting point
      setCustomCards(activeCards);
    }
  };

  // ---------------------------------------------------------------------------
  // LAYOUT SAVE / LOAD / DELETE PERSISTENCE
  // ---------------------------------------------------------------------------
  const handleSaveCurrentLayout = () => {
    if (!newLayoutName.trim()) return;
    const newLayout: SavedLayout = {
      id: 'layout-' + Date.now(),
      name: newLayoutName.trim(),
      cards: activeCards,
      slicers: slicers,
      calculatedColumns: calculatedColumns,
      themeId: currentThemeId,
      customPrimaryHex: customPrimaryHex,
      createdAt: new Date().toISOString(),
    };
    const updated = [...savedLayouts, newLayout];
    setSavedLayouts(updated);
    localStorage.setItem('dashboard-saved-layouts', JSON.stringify(updated));
    setNewLayoutName('');
    setShowSaveModal(false);
  };

  const handleLoadLayout = (layout: SavedLayout) => {
    setCustomCards(layout.cards);
    setSlicers(layout.slicers);
    setCalculatedColumns(layout.calculatedColumns);
    setCurrentThemeId(layout.themeId);
    if (layout.customPrimaryHex) {
      setCustomPrimaryHex(layout.customPrimaryHex);
      localStorage.setItem('dashboard-custom-primary-hex', layout.customPrimaryHex);
    }
    setCurrentTemplateId('preset-custom');
  };

  const handleDeleteLayout = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = savedLayouts.filter(l => l.id !== id);
    setSavedLayouts(updated);
    localStorage.setItem('dashboard-saved-layouts', JSON.stringify(updated));
  };

  const handleDownloadHtml = () => {
    if (!fileName) return;

    const htmlContent = generateHtmlDashboard(
      fileName.replace(/\.[^/.]+$/, ""),
      recalculatedRows,
      columns,
      activeCards,
      slicers,
      currentThemeId,
      customPrimaryHex
    );

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    const formattedName = fileName.replace(/\.[^/.]+$/, "");
    link.download = `${formattedName}_互動式儀表板.html`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">
      
      {/* Top Premium Navbar */}
      <nav className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 py-2.5 px-4 shadow-sm sticky top-0 z-30 transition-colors duration-200">
        <div className="max-w-[1536px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className={`p-1.5 ${currentTheme.primary} text-white rounded-lg shadow-sm transition-colors duration-200`}>
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight font-display">
                  資料表互動式儀表板產生器
                </h1>
                <span className={`${currentTheme.lightBg} ${currentTheme.textClass} text-[9px] font-semibold px-1.5 py-0.5 rounded border ${currentTheme.lightBorder} uppercase tracking-wider font-mono transition-all duration-200`}>
                  High Density Mode
                </span>
              </div>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.25">
                將 Excel / CSV 轉換為精美、單檔可攜的互動式 Web Dashboard
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end flex-wrap sm:flex-nowrap">
            {/* Custom Color Picker for Custom Theme */}
            {currentThemeId === 'custom' && (
              <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 transition-all duration-200">
                <input
                  type="color"
                  value={customPrimaryHex}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCustomPrimaryHex(val);
                    localStorage.setItem('dashboard-custom-primary-hex', val);
                  }}
                  className="w-4 h-4 rounded-full cursor-pointer border border-slate-300 dark:border-slate-600 outline-none p-0 bg-transparent"
                  title="選擇自訂主題的主色調"
                />
                <input
                  type="text"
                  value={customPrimaryHex}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (/^#[0-9A-Fa-f]{0,6}$/.test(val)) {
                      setCustomPrimaryHex(val);
                      if (val.length === 7) {
                        localStorage.setItem('dashboard-custom-primary-hex', val);
                      }
                    }
                  }}
                  className="w-14 bg-transparent border-0 text-[10px] font-mono text-slate-700 dark:text-slate-200 focus:ring-0 focus:outline-none p-0 text-center uppercase"
                  placeholder="#HEX"
                />
              </div>
            )}

            {/* Theme Selector UI */}
            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 transition-colors duration-200">
              <Palette className={`w-3.5 h-3.5 ${currentTheme.accentText} transition-colors duration-200`} />
              <span className="text-[10px] text-slate-400 dark:text-slate-400 font-bold">主題：</span>
              <select
                value={currentThemeId}
                onChange={(e) => setCurrentThemeId(e.target.value as ThemeId)}
                className="bg-transparent text-slate-700 dark:text-slate-200 text-[11px] font-bold outline-none cursor-pointer pr-1"
              >
                {THEME_PRESETS.map((t) => (
                  <option key={t.id} value={t.id} className="bg-white dark:bg-slate-800 text-slate-800 dark:text-white">
                    {t.name}
                  </option>
                ))}
                <option value="custom" className="bg-white dark:bg-slate-800 text-slate-800 dark:text-white font-semibold text-indigo-600">
                  ✨ 自訂配色 (Custom Color)
                </option>
              </select>
            </div>

            {/* Appearance Mode Selector */}
            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 transition-colors duration-200">
              {colorMode === 'light' ? (
                <Sun className="w-3.5 h-3.5 text-amber-500" />
              ) : colorMode === 'dark' ? (
                <Moon className="w-3.5 h-3.5 text-indigo-400" />
              ) : (
                <Monitor className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
              )}
              <span className="text-[10px] text-slate-400 dark:text-slate-400 font-bold">外觀：</span>
              <select
                value={colorMode}
                onChange={(e) => setColorMode(e.target.value as 'light' | 'dark' | 'system')}
                className="bg-transparent text-slate-700 dark:text-slate-200 text-[11px] font-bold outline-none cursor-pointer pr-1"
              >
                <option value="light" className="bg-white dark:bg-slate-800 text-slate-800 dark:text-white">淺色模式 (Light)</option>
                <option value="dark" className="bg-white dark:bg-slate-800 text-slate-800 dark:text-white">深色模式 (Dark)</option>
                <option value="system" className="bg-white dark:bg-slate-800 text-slate-800 dark:text-white">系統同步 (System)</option>
              </select>
            </div>

            {fileName && (
              <>
                <button
                  onClick={() => {
                    setFileName(null);
                    setOriginalRows(null);
                  }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-medium rounded-lg text-[11px] hover:bg-slate-50 dark:hover:bg-slate-800 transition-all bg-white dark:bg-slate-900 shadow-sm"
                >
                  <RotateCcw className="w-3 h-3" />
                  重設/上傳新檔
                </button>
                
                <button
                  onClick={handleDownloadHtml}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 ${currentTheme.primary} ${currentTheme.hover} text-white font-semibold rounded-lg text-[11px] transition-all shadow-sm`}
                >
                  <Download className="w-3 h-3" />
                  下載 HTML 儀表板
                </button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Main Container */}
      <div className="flex-1 max-w-[1536px] w-full mx-auto p-3 sm:p-4 lg:p-5 flex flex-col gap-3.5">
        
        {/* State A: No file loaded yet */}
        {!originalRows ? (
          <div className="flex-1 flex flex-col items-center justify-center py-10 lg:py-16">
            <div className="text-center max-w-xl mb-10">
              <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white font-display sm:text-4xl">
                立即將試算表轉換為互動式網頁看板
              </h2>
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                只需拖放您的資料表檔案。系統將自動分析數據結構，為您量身打造合適的視覺化圖表與高階 KPI 資訊卡，並可一鍵打包下載為可隨身攜帶的單一檔案 HTML 儀表板（資料、樣式與圖表全部內嵌，完全離線、雙擊即用，無需網路或伺服器）。
              </p>
            </div>

            <UploadZone onDataLoaded={handleDataLoaded} />
          </div>
        ) : (
          
          /* State B: Dashboard Config and Preview Mode */
          <div className="space-y-3.5 animate-fade-in">
            
            {/* Header file badge info */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-3 transition-colors duration-200">
              <div className="flex items-center gap-2.5 truncate">
                <div className="p-1.5 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 rounded-lg border border-emerald-100 dark:border-emerald-900/30">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <div className="truncate">
                  <div className="text-[10px] text-slate-400 dark:text-slate-500">目前載入之資料表</div>
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate" title={fileName || ''}>{fileName}</div>
                </div>
              </div>

              <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 font-medium shrink-0 border-t md:border-t-0 pt-2.5 md:pt-0 w-full md:w-auto border-slate-100 dark:border-slate-800">
                <div>原始欄位數：<span className="text-slate-800 dark:text-slate-200 font-bold">{(Object.keys(originalRows[0] || {}).length)}</span></div>
                <div className="w-px h-3 bg-slate-200 dark:bg-slate-800"></div>
                <div>總數據量：<span className="text-slate-800 dark:text-slate-200 font-bold">{originalRows.length.toLocaleString()}</span> 筆</div>
                <div className="w-px h-3 bg-slate-200 dark:bg-slate-800"></div>
                <div>自訂欄位：<span className="text-slate-800 dark:text-slate-200 font-bold">{calculatedColumns.length}</span> 個</div>
              </div>
            </div>

            {/* Config Accordion panel */}
            <div className="space-y-2.5">
              
              {/* Layout Presets selector row */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-sm transition-colors duration-200">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3 border-b border-slate-100 dark:border-slate-800 pb-2.5">
                  <div className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <LayoutTemplate className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                    選擇儀表板版面範本 (Template Layouts)
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                  {[
                    {
                      id: 'preset-sales',
                      name: '銷售業績指標 (Sales Preset)',
                      desc: '高階 KPI 指標卡、類別佔比圖及數據明細。適合銷售額與產品分析。',
                      icon: TrendingUp,
                      color: 'border-indigo-500 bg-indigo-50/20 dark:bg-indigo-950/10 text-indigo-900 dark:text-indigo-100',
                    },
                    {
                      id: 'preset-ops',
                      name: '營運效能分佈 (Ops Preset)',
                      desc: '著重於最大、最低、平均指標，以及滿意度或效能趨勢面積圖。',
                      icon: BarChart2,
                      color: 'border-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/10 text-emerald-900 dark:text-emerald-100',
                    },
                    {
                      id: 'preset-minimal',
                      name: '精簡高階看板 (Minimal Preset)',
                      desc: '極簡精緻的單卡設計，呈現最重要的指標總計與走勢折線圖。',
                      icon: LayoutGrid,
                      color: 'border-amber-500 bg-amber-50/20 dark:bg-amber-950/10 text-amber-900 dark:text-amber-100',
                    },
                    {
                      id: 'preset-custom',
                      name: '自訂卡片版面 (Custom Layout)',
                      desc: '自由建立各寬度卡片，自訂指標運算、圖表種類、與表格顯示欄位。',
                      icon: Sliders,
                      color: 'border-rose-500 bg-rose-50/20 dark:bg-rose-950/10 text-rose-900 dark:text-rose-100',
                    },
                  ].map((tpl) => {
                    const isActive = currentTemplateId === tpl.id;
                    const Icon = tpl.icon;
                    return (
                      <button
                        key={tpl.id}
                        onClick={() => handleTemplateChange(tpl.id as PresetTemplateId)}
                        className={`text-left p-3 border-2 rounded-xl transition-all cursor-pointer flex flex-col justify-between h-28 ${
                          isActive
                            ? `${tpl.color} border-current ring-1 ring-current shadow-sm`
                            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-1.5 font-bold text-[11px]">
                            <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500'}`} />
                            <span className="truncate">{tpl.name}</span>
                          </div>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                            {tpl.desc}
                          </p>
                        </div>
                        {isActive && (
                          <span className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 border border-indigo-150 dark:border-indigo-900 bg-indigo-50/50 dark:bg-indigo-950/30 px-1.5 py-0.25 rounded w-fit mt-1 self-end">
                            使用中
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Custom layout saving and loading control center */}
                <div className="mt-3.5 pt-3.5 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
                      我的自訂版面：
                    </span>
                    {savedLayouts.length > 0 ? (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <select
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val) {
                              const layout = savedLayouts.find(l => l.id === val);
                              if (layout) handleLoadLayout(layout);
                            }
                            e.target.value = ''; // reset selection
                          }}
                          className="text-[11px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 font-bold px-2 py-1 cursor-pointer outline-none"
                          defaultValue=""
                        >
                          <option value="" disabled>📂 選擇並載入已儲存佈局 ({savedLayouts.length})</option>
                          {savedLayouts.map((l) => (
                            <option key={l.id} value={l.id}>
                              {l.name} ({new Date(l.createdAt).toLocaleDateString()})
                            </option>
                          ))}
                        </select>
                        
                        {/* Quick delete selected layout button list */}
                        <div className="flex flex-wrap items-center gap-1">
                          {savedLayouts.map(l => (
                            <button
                              key={`del-${l.id}`}
                              onClick={(e) => handleDeleteLayout(l.id, e)}
                              className="text-[9px] px-1.5 py-0.5 border border-rose-100 dark:border-rose-950/40 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded cursor-pointer transition-all"
                              title={`刪除 "${l.name}"`}
                            >
                              ✕ {l.name.slice(0, 8)}{l.name.length > 8 ? '..' : ''}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <span className="text-[10px] text-slate-400 italic">目前無已儲存的自訂佈局。</span>
                    )}
                  </div>

                  <button
                    onClick={() => {
                      setNewLayoutName('');
                      setShowSaveModal(true);
                    }}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-all cursor-pointer shadow-sm`}
                  >
                    💾 儲存目前版面配置到瀏覽器
                  </button>
                </div>
              </div>

              {/* Collapsible: Calculated Columns Builder */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 shadow-sm overflow-hidden transition-colors duration-200">
                <button
                  onClick={() => setIsCalcsOpen(!isCalcsOpen)}
                  className="w-full flex items-center justify-between p-2.5 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-[11px] font-bold"
                >
                  <div className="flex items-center gap-1.5">
                    <Calculator className={`w-4 h-4 ${currentTheme.accentText}`} />
                    <span>1. 自訂公式數值計算 ({calculatedColumns.length} 個已建立)</span>
                  </div>
                  {isCalcsOpen ? <ChevronUp className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />}
                </button>

                {isCalcsOpen && (
                  <div className="p-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/10 dark:bg-slate-950/10">
                    <CalculatedColumns
                      columns={columns}
                      calculatedColumns={calculatedColumns}
                      onAddCalculatedColumn={handleAddCalculatedColumn}
                      onRemoveCalculatedColumn={handleRemoveCalculatedColumn}
                    />
                  </div>
                )}
              </div>

              {/* Collapsible: Slicers (Filters) Configuration */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 shadow-sm overflow-hidden transition-colors duration-200">
                <button
                  onClick={() => setIsSlicersOpen(!isSlicersOpen)}
                  className="w-full flex items-center justify-between p-2.5 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-[11px] font-bold"
                >
                  <div className="flex items-center gap-1.5">
                    <Sliders className={`w-4 h-4 ${currentTheme.accentText}`} />
                    <span>2. 設定篩選器欄位 ({slicers.length} 個已啟用)</span>
                  </div>
                  {isSlicersOpen ? <ChevronUp className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />}
                </button>

                {isSlicersOpen && (
                  <div className="p-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/10 dark:bg-slate-950/10">
                    <SlicerConfigurator
                      columns={columns}
                      selectedSlicers={slicers}
                      onToggleSlicer={handleToggleSlicer}
                      themeId={currentThemeId}
                    />
                  </div>
                )}
              </div>

            </div>

            {/* Active Card Creator (Only in custom layout mode) */}
            {currentTemplateId === 'preset-custom' && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-sm space-y-3 transition-colors duration-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-200 font-display">
                      自訂看板元件卡片
                    </h3>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                      您可在下方點擊「新增卡片」自訂看板，或是直接在預覽區拖曳卡片以自訂排列順序。
                    </p>
                  </div>
                  {!isAddingCard && (
                    <button
                      onClick={handleStartAddCard}
                      className={`inline-flex items-center gap-1 px-3 py-1.5 ${currentTheme.primary} ${currentTheme.hover} text-white text-[11px] font-bold rounded-lg transition-all shadow-sm`}
                    >
                      <Plus className="w-3 h-3" />
                      新增卡片
                    </button>
                  )}
                </div>

                {isAddingCard && (
                  <CardEditor
                    columns={columns}
                    editingCard={editingCard}
                    onSave={handleSaveCard}
                    onCancel={() => {
                      setIsAddingCard(false);
                      setEditingCard(null);
                    }}
                  />
                )}
              </div>
            )}

            {/* Interactive Dashboard Live Preview */}
            <div>
              <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                <BarChart2 className={`w-4 h-4 ${currentTheme.accentText}`} />
                儀表板即時預覽 (Interactive Live Preview)
              </div>

              <div className="flex flex-col lg:flex-row gap-3.5">
                
                {/* Slicer active filter Sidebar (1/4 width) */}
                <div className="w-full lg:w-56 shrink-0 flex flex-col gap-3">
                  <SlicerFilterPanel
                    slicers={slicers}
                    columns={columns}
                    rawData={recalculatedRows}
                    onSlicerChange={handleSlicerValuesChange}
                    onResetFilters={handleResetAllFilters}
                    themeId={currentThemeId}
                  />
                </div>

                {/* Main Cards Grid Preview (3/4 width) */}
                <div className="flex-1 flex flex-col gap-3.5">
                  {/* Filter summary info banner */}
                  {slicers.some((s) => s.selectedValues.length > 0) && (
                    <div className={`border rounded-xl px-4 py-2 flex items-center justify-between text-xs shadow-sm ${currentTheme.lightBg} ${currentTheme.lightBorder} ${currentTheme.textClass}`}>
                      <div className="flex items-center gap-1.5">
                        <Info className={`w-4 h-4 ${currentTheme.accentText} shrink-0`} />
                        <span>
                          已套用篩選。符合的資料筆數為：
                          <strong className={`font-bold mx-1 ${currentTheme.textClass}`}>
                            {filteredRows.length.toLocaleString()}
                          </strong>{' '}
                          / {originalRows.length.toLocaleString()} 筆 (佔{' '}
                          <strong className={currentTheme.textClass}>
                            {((filteredRows.length / originalRows.length) * 100).toFixed(1)}%
                          </strong>
                          )
                        </span>
                      </div>
                      <button
                        onClick={handleResetAllFilters}
                        className={`text-xs font-semibold hover:underline ${currentTheme.accentText} hover:opacity-85`}
                      >
                        清除篩選
                      </button>
                    </div>
                  )}

                  {/* Render the grid of cards */}
                  <ErrorBoundary
                    resetKey={`${currentTemplateId}:${activeCards.map((c) => c.id).join(',')}`}
                    fallbackTitle="儀表板卡片渲染失敗，請調整卡片設定後重試"
                  >
                    <DashboardCards
                      cards={activeCards}
                      filteredRows={filteredRows}
                      onEditCard={handleStartEditCard}
                      onDeleteCard={handleDeleteCard}
                      isCustomMode={currentTemplateId === 'preset-custom'}
                      themeId={currentThemeId}
                      customPrimaryHex={customPrimaryHex}
                      colorMode={colorMode}
                      onReorderCards={handleReorderCards}
                    />
                  </ErrorBoundary>
                </div>

              </div>
            </div>

          </div>
        )}

      </div>

      <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 py-4 text-center text-[10px] text-slate-400 dark:text-slate-500 mt-auto transition-colors duration-200">
        資料表互動式儀表板產生器 • 支援 XLS, XLSX, CSV • 設計並下載單一檔案、可攜式互動看板
      </footer>

      {/* Save Layout Dialog Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 w-full max-w-sm shadow-xl space-y-4 transition-colors duration-200">
            <div>
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 font-display">
                <span>💾 儲存自訂版面佈局</span>
              </h3>
              <p className="text-[10px] text-slate-400 mt-1">
                這會將您目前的卡片組合、運算欄位、篩選器啟用狀態及主題配色儲存至瀏覽器 localStorage。
              </p>
            </div>
            <div>
              <label className="block text-[9px] font-bold text-slate-400 mb-1.5 uppercase tracking-wider">版面佈局名稱</label>
              <input
                type="text"
                value={newLayoutName}
                onChange={(e) => setNewLayoutName(e.target.value)}
                placeholder="例如: 產品銷量對比看板"
                className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-100"
                autoFocus
              />
            </div>
            <div className="flex gap-2 justify-end text-[11px] font-bold pt-2">
              <button
                onClick={() => {
                  setShowSaveModal(false);
                  setNewLayoutName('');
                }}
                className="px-3 py-1.5 bg-slate-150 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg cursor-pointer"
              >
                取消
              </button>
              <button
                onClick={handleSaveCurrentLayout}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg cursor-pointer shadow-sm"
              >
                確認儲存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
