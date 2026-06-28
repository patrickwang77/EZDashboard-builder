/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ColumnInfo, Slicer, RowData } from '../types';
import { Filter, Search, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';
import { ThemeId, getTheme } from '../themes';

interface SlicerConfiguratorProps {
  columns: ColumnInfo[];
  selectedSlicers: Slicer[];
  onToggleSlicer: (columnName: string) => void;
  themeId?: ThemeId;
}

export function SlicerConfigurator({ columns, selectedSlicers, onToggleSlicer, themeId = 'indigo' }: SlicerConfiguratorProps) {
  const theme = getTheme(themeId);
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-sm transition-colors">
      <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-1.5 mb-1 font-display">
        <Filter className={`w-4 h-4 ${theme.accentText}`} />
        設定篩選器 (Slicers)
      </h3>
      <p className="text-[10px] text-slate-400 dark:text-slate-500 mb-2.5">
        選擇要在儀表板側邊欄顯示的欄位，供使用者進行快速資料篩選過濾。
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto pr-1">
        {columns.map((col) => {
          const isSlicer = selectedSlicers.some((s) => s.columnName === col.name);
          return (
            <label
              key={col.name}
              style={isSlicer ? { borderColor: theme.chartColor } : undefined}
              className={`flex items-center gap-1.5 p-1.5 border rounded-lg cursor-pointer select-none text-[11px] transition-all ${
                isSlicer
                  ? `${theme.lightBg} ${theme.textClass} font-medium`
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
              }`}
            >
              <input
                type="checkbox"
                checked={isSlicer}
                onChange={() => onToggleSlicer(col.name)}
                style={{ color: theme.chartColor }}
                className="rounded border-slate-300 dark:border-slate-600 w-3 h-3"
              />
              <span className="truncate" title={col.name}>
                {col.name}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

interface SlicerFilterPanelProps {
  slicers: Slicer[];
  columns: ColumnInfo[];
  rawData: RowData[];
  onSlicerChange: (columnName: string, selectedValues: string[]) => void;
  onResetFilters: () => void;
  themeId?: ThemeId;
}

export function SlicerFilterPanel({
  slicers,
  columns,
  rawData,
  onSlicerChange,
  onResetFilters,
  themeId = 'indigo',
}: SlicerFilterPanelProps) {
  const theme = getTheme(themeId);
  // Store collapsed state per slicer
  const [collapsed, setCollapsed] = useState<{ [key: string]: boolean }>({});
  // Store local search query per slicer
  const [searchQueries, setSearchQueries] = useState<{ [key: string]: string }>({});

  const toggleCollapse = (colName: string) => {
    setCollapsed({ ...collapsed, [colName]: !collapsed[colName] });
  };

  const handleSearchChange = (colName: string, query: string) => {
    setSearchQueries({ ...searchQueries, [colName]: query });
  };

  const handleCheckboxChange = (colName: string, val: string, checked: boolean, currentSelected: string[]) => {
    let nextSelected = [...currentSelected];
    if (checked) {
      nextSelected.push(val);
    } else {
      nextSelected = nextSelected.filter((v) => v !== val);
    }
    onSlicerChange(colName, nextSelected);
  };

  const handleSelectAll = (colName: string, uniqueVals: string[]) => {
    // Standard BI convention: selecting all is the same as no active filter restrictions
    onSlicerChange(colName, []);
  };

  const handleClearAll = (colName: string) => {
    // If empty list, means nothing is restricted or everything is cleared
    // Wait, let's look at how we implemented it: if selectedValues is empty, we show all (no restriction).
    // If they want to "clear", they uncheck everything. Let's make it clear:
    onSlicerChange(colName, []);
  };

  if (slicers.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 text-center text-slate-400 dark:text-slate-500 text-xs shadow-sm transition-colors">
        <Filter className="w-4 h-4 mx-auto mb-1.5 text-slate-300 dark:text-slate-600" />
        <p className="font-semibold text-[11px]">未選取篩選器欄位</p>
        <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-0.5">請在上方勾選設定要啟用篩選的欄位。</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-sm h-fit max-h-[80vh] flex flex-col transition-colors">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2 mb-2.5">
        <div className="flex items-center gap-1 font-bold text-slate-700 dark:text-slate-300 text-[10px] tracking-wider uppercase">
          <Filter className={`w-3.5 h-3.5 ${theme.accentText}`} />
          <span>篩選器面版</span>
        </div>
        <button
          onClick={onResetFilters}
          className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
        >
          <RotateCcw className="w-2.5 h-2.5" />
          重設
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3.5 pr-1">
        {slicers.map((slic) => {
          const colName = slic.columnName;
          const isCollapsed = collapsed[colName] || false;
          const searchQuery = searchQueries[colName] || '';

          // Find column info
          const colInfo = columns.find((c) => c.name === colName);
          if (!colInfo) return null;

          // Extract all unique values for this slicer column directly from original rawData
          const uniqueValues = Array.from(
            new Set(
              rawData.map((row) => {
                const val = row[colName];
                return val !== undefined && val !== null ? String(val).trim() : 'Blank';
              })
            )
          ).sort();

          const filteredUniqueValues = uniqueValues.filter((v) =>
            v.toLowerCase().includes(searchQuery.toLowerCase())
          );

          const selectedCount = slic.selectedValues.length;

          return (
            <div key={colName} className="border-b border-slate-100 dark:border-slate-800 pb-2.5 last:border-0 last:pb-0">
              <div className="flex items-center justify-between mb-1">
                <button
                  onClick={() => toggleCollapse(colName)}
                  className="flex items-center gap-0.5 text-[11px] font-bold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors truncate"
                >
                  {isCollapsed ? <ChevronDown className="w-3 h-3 text-slate-400 dark:text-slate-500" /> : <ChevronUp className="w-3 h-3 text-slate-400 dark:text-slate-500" />}
                  <span className="truncate" title={colName}>{colName}</span>
                  {selectedCount > 0 && (
                    <span className={`ml-1 text-[8px] px-1 py-0.25 rounded font-bold ${theme.lightBg} ${theme.accentText}`}>
                      {selectedCount}
                    </span>
                  )}
                </button>

                <div className="flex items-center gap-1 text-[9px]">
                  <button
                    onClick={() => handleSelectAll(colName, uniqueValues)}
                    className={`hover:underline ${theme.accentText}`}
                  >
                    全選
                  </button>
                  <span className="text-slate-200 dark:text-slate-700">|</span>
                  <button onClick={() => handleClearAll(colName)} className="text-slate-500 dark:text-slate-400 hover:underline">
                    清除
                  </button>
                </div>
              </div>

              {!isCollapsed && (
                <div className="mt-1.5 space-y-1.5">
                  {/* Local Slicer Search */}
                  {uniqueValues.length > 5 && (
                    <div className="relative">
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => handleSearchChange(colName, e.target.value)}
                        placeholder="搜尋項目..."
                        style={{ focusBorderColor: theme.chartColor } as React.CSSProperties}
                        className="w-full text-[10px] pl-6 pr-2 py-0.5 border border-slate-200 dark:border-slate-700 rounded focus:outline-none focus:ring-1 focus:ring-slate-300 dark:focus:ring-slate-600 bg-slate-50/50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                      />
                      <Search className="w-3 h-3 text-slate-400 dark:text-slate-500 absolute left-2 top-1/2 -translate-y-1/2" />
                    </div>
                  )}

                  {/* Checkbox List */}
                  <div className="max-h-28 overflow-y-auto custom-scrollbar space-y-1 pr-1 pt-0.5">
                    {filteredUniqueValues.length === 0 ? (
                      <p className="text-[9px] text-slate-400 dark:text-slate-500 italic text-center py-1">無相符項目</p>
                    ) : (
                      filteredUniqueValues.map((val) => {
                        const isChecked = slic.selectedValues.includes(val);
                        return (
                          <label
                            key={val}
                            className="flex items-start gap-1.5 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white cursor-pointer select-none text-[11px] transition-colors py-0.25"
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) =>
                                handleCheckboxChange(colName, val, e.target.checked, slic.selectedValues)
                              }
                              style={{ color: theme.chartColor }}
                              className="rounded border-slate-300 dark:border-slate-600 w-3 h-3 mt-0.5"
                            />
                            <span className="truncate" title={val}>
                              {val === '' || val === 'Blank' ? <em className="text-slate-400 dark:text-slate-500">(空白)</em> : val}
                            </span>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
