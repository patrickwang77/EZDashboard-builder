/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { ColumnInfo, CardConfig, OperationType, ChartType } from '../types';
import { X, Plus, Check, Settings, Info } from 'lucide-react';

interface CardEditorProps {
  columns: ColumnInfo[];
  editingCard: CardConfig | null; // If null, we are in "Create" mode
  onSave: (card: CardConfig) => void;
  onCancel: () => void;
}

export default function CardEditor({ columns, editingCard, onSave, onCancel }: CardEditorProps) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState<'metric' | 'chart' | 'table'>('metric');
  const [width, setWidth] = useState<'1/3' | '1/2' | '2/3' | 'full'>('1/3');

  // Metric settings
  const [metricCol, setMetricCol] = useState('');
  const [metricOp, setMetricOp] = useState<OperationType>('SUM');
  const [metricPrefix, setMetricPrefix] = useState('');
  const [metricSuffix, setMetricSuffix] = useState('');

  // Chart settings
  const [chartType, setChartType] = useState<ChartType>('bar');
  const [chartXCol, setChartXCol] = useState('');
  const [chartYCol, setChartYCol] = useState('');
  const [chartYCol2, setChartYCol2] = useState(''); // Plan column for overlaid bar
  const [donutRange, setDonutRange] = useState<'full' | 'half'>('full'); // Circle range for donut
  const [chartAgg, setChartAgg] = useState<'SUM' | 'AVG' | 'RAW'>('SUM');

  // Table settings
  const [tableCols, setTableCols] = useState<string[]>([]);
  const [tablePageSize, setTablePageSize] = useState<number>(8);
  const [tableSubtotalCols, setTableSubtotalCols] = useState<string[]>([]);
  const [tableGroupByCol, setTableGroupByCol] = useState<string>('');

  // Load editing card data if present
  useEffect(() => {
    if (editingCard) {
      setTitle(editingCard.title);
      setType(editingCard.type);
      setWidth(editingCard.width);

      if (editingCard.type === 'metric' && editingCard.metric) {
        setMetricCol(editingCard.metric.column);
        setMetricOp(editingCard.metric.operation);
        setMetricPrefix(editingCard.metric.prefix || '');
        setMetricSuffix(editingCard.metric.suffix || '');
      } else if (editingCard.type === 'chart' && editingCard.chart) {
        setChartType(editingCard.chart.type);
        setChartXCol(editingCard.chart.xAxisColumn);
        setChartYCol(editingCard.chart.yAxisColumn);
        setChartYCol2(editingCard.chart.yAxisColumn2 || '');
        setDonutRange(editingCard.chart.donutRange || 'full');
        setChartAgg(editingCard.chart.aggregate);
      } else if (editingCard.type === 'table' && editingCard.table) {
        setTableCols(editingCard.table.columns);
        setTablePageSize(editingCard.table.pageSize);
        setTableSubtotalCols(editingCard.table.subtotalColumns || []);
        setTableGroupByCol(editingCard.table.groupByColumn || '');
      }
    } else {
      // Set defaults in create mode
      setTitle('');
      setType('metric');
      setWidth('1/3');
      
      const firstNumCol = columns.find((c) => c.isNumeric)?.name || '';
      const firstStrCol = columns.find((c) => !c.isNumeric)?.name || columns[0]?.name || '';
      
      setMetricCol(firstNumCol);
      setMetricOp('SUM');
      setMetricPrefix('');
      setMetricSuffix('');

      setChartType('bar');
      setChartXCol(firstStrCol);
      setChartYCol(firstNumCol);
      setChartYCol2(firstNumCol);
      setDonutRange('full');
      setChartAgg('SUM');

      setTableCols(columns.slice(0, 5).map((c) => c.name));
      setTablePageSize(8);
      setTableSubtotalCols([]);
      setTableGroupByCol('');
    }
  }, [editingCard, columns]);

  // Adjust default width when type changes
  useEffect(() => {
    if (!editingCard) {
      if (type === 'metric') setWidth('1/3');
      else if (type === 'chart') setWidth('1/2');
      else if (type === 'table') setWidth('full');
    }
  }, [type, editingCard]);

  const handleSave = () => {
    const cardTitle = title.trim() || (type === 'metric' ? '指標卡片' : type === 'chart' ? '數據圖表' : '資料明細表');

    const card: CardConfig = {
      id: editingCard?.id || `card-${Date.now()}`,
      title: cardTitle,
      type,
      width,
    };

    if (type === 'metric') {
      card.metric = {
        column: metricCol || columns[0]?.name || '',
        operation: metricOp,
        prefix: metricPrefix,
        suffix: metricSuffix,
      };
    } else if (type === 'chart') {
      card.chart = {
        type: chartType,
        xAxisColumn: chartXCol || columns[0]?.name || '',
        yAxisColumn: chartYCol || columns.find((c) => c.isNumeric)?.name || columns[0]?.name || '',
        yAxisColumn2: (chartType === 'overlaid-bar' || chartType === 'donut') ? (chartYCol2 || chartYCol) : undefined,
        donutRange: chartType === 'donut' ? donutRange : undefined,
        aggregate: chartAgg,
      };
    } else if (type === 'table') {
      card.table = {
        columns: tableCols,
        pageSize: tablePageSize,
        subtotalColumns: tableSubtotalCols,
        groupByColumn: tableGroupByCol || undefined,
      };
    }

    onSave(card);
  };

  const toggleTableColumn = (colName: string) => {
    if (tableCols.includes(colName)) {
      setTableCols(tableCols.filter((c) => c !== colName));
    } else {
      setTableCols([...tableCols, colName]);
    }
  };

  const toggleTableSubtotalColumn = (colName: string) => {
    if (tableSubtotalCols.includes(colName)) {
      setTableSubtotalCols(tableSubtotalCols.filter((c) => c !== colName));
    } else {
      setTableSubtotalCols([...tableSubtotalCols, colName]);
    }
  };

  const numericCols = columns.filter((c) => c.isNumeric);

  return (
    <div className="bg-white dark:bg-slate-900 text-slate-800 dark:text-white rounded-2xl p-5 shadow-xl border border-slate-200 dark:border-slate-800 flex flex-col gap-4">
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
        <h4 className="text-sm font-semibold flex items-center gap-2 font-display">
          <Settings className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          {editingCard ? '編輯儀表板卡片' : '新增儀表板卡片 (Custom Card)'}
        </h4>
        <button onClick={onCancel} className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left column: Card identity */}
        <div className="space-y-3.5">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">卡片標題</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="輸入卡片自訂標題..."
              className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">卡片類型</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as any)}
                className="w-full text-xs px-2 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-white"
              >
                <option value="metric">指標卡 (Metric)</option>
                <option value="chart">圖表卡 (Chart)</option>
                <option value="table">明細資料表 (Table)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">卡片寬度 (佈局)</label>
              <select
                value={width}
                onChange={(e) => setWidth(e.target.value as any)}
                className="w-full text-xs px-2 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-white"
              >
                <option value="1/3">1/3 寬度 (細)</option>
                <option value="1/2">1/2 寬度 (中)</option>
                <option value="2/3">2/3 寬度 (寬)</option>
                <option value="full">100% 滿版</option>
              </select>
            </div>
          </div>
        </div>

        {/* Right column: Specific configurations based on Card Type */}
        <div className="bg-slate-100/60 dark:bg-slate-800/40 p-3.5 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3.5">
          {type === 'metric' && (
            <div className="space-y-3">
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800 pb-1 flex items-center gap-1">
                <Info className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                指標運算設定
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1">計算欄位</label>
                  <select
                    value={metricCol}
                    onChange={(e) => setMetricCol(e.target.value)}
                    className="w-full text-xs px-2 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-white"
                  >
                    {columns.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.name} {c.isNumeric ? '(數值)' : '(字串)'}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1">運算方法</label>
                  <select
                    value={metricOp}
                    onChange={(e) => setMetricOp(e.target.value as any)}
                    className="w-full text-xs px-2 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-white"
                  >
                    <option value="SUM">加總 (SUM)</option>
                    <option value="AVG">平均 (AVG)</option>
                    <option value="COUNT">計數 (COUNT)</option>
                    <option value="MIN">最小值 (MIN)</option>
                    <option value="MAX">最大值 (MAX)</option>
                    <option value="MEDIAN">中位數 (MEDIAN)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1">數值前綴 (Prefix)</label>
                  <input
                    type="text"
                    value={metricPrefix}
                    onChange={(e) => setMetricPrefix(e.target.value)}
                    placeholder="如: NT$、$"
                    className="w-full text-xs px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1">數值後綴 (Suffix)</label>
                  <input
                    type="text"
                    value={metricSuffix}
                    onChange={(e) => setMetricSuffix(e.target.value)}
                    placeholder="如: 元、%、個"
                    className="w-full text-xs px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-white"
                  />
                </div>
              </div>
            </div>
          )}

          {type === 'chart' && (
            <div className="space-y-3">
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800 pb-1 flex items-center gap-1">
                <Info className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                圖表設定
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1">圖表呈現類型</label>
                  <select
                    value={chartType}
                    onChange={(e) => setChartType(e.target.value as any)}
                    className="w-full text-xs px-2 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-white"
                  >
                    <option value="bar">長條圖 (Bar)</option>
                    <option value="line">折線圖 (Line)</option>
                    <option value="area">面積圖 (Area)</option>
                    <option value="pie">圓餅圖 (Pie)</option>
                    <option value="donut">圓環圖 (Donut)</option>
                    <option value="overlaid-bar">實際與計劃重疊圖 (Overlaid Bar)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1">圖表數據聚合</label>
                  <select
                    value={chartAgg}
                    onChange={(e) => setChartAgg(e.target.value as any)}
                    className="w-full text-xs px-2 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-white"
                  >
                    <option value="SUM">加總 (SUM)</option>
                    <option value="AVG">平均 (AVG)</option>
                    <option value="RAW">原始值 (RAW - 最多100筆)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1">X 軸 (分類維度)</label>
                  <select
                    value={chartXCol}
                    onChange={(e) => setChartXCol(e.target.value)}
                    className="w-full text-xs px-2 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-white"
                  >
                    {columns.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                    Y 軸 {(chartType === 'overlaid-bar' || chartType === 'donut') ? '(實際值 - Actual)' : '(數值度量)'}
                  </label>
                  <select
                    value={chartYCol}
                    onChange={(e) => setChartYCol(e.target.value)}
                    className="w-full text-xs px-2 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-white"
                  >
                    {numericCols.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {(chartType === 'overlaid-bar' || chartType === 'donut') && (
                <div className="bg-slate-50 dark:bg-slate-900/40 p-2 border border-slate-200 dark:border-slate-800 rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400">Y 軸 2 (計畫值 - Plan / 比較對象)</label>
                    <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/10 px-1 py-0.2 rounded">支援進度比較</span>
                  </div>
                  <select
                    value={chartYCol2}
                    onChange={(e) => setChartYCol2(e.target.value)}
                    className="w-full text-xs px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-white"
                  >
                    {numericCols.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <span className="text-[9px] text-slate-500 dark:text-slate-400 mt-1 block">
                    {chartType === 'overlaid-bar' 
                      ? '重疊圖將用於比較 Actual（前端窄柱）與 Plan（後端寬柱）之完成度。' 
                      : '圓環圖將用於比較實際值（彩色進度環）與計劃值（背景底圈）之整體目標完成百分比（進度條儀表板模式）。'}
                  </span>
                </div>
              )}

              {chartType === 'donut' && (
                <div className="bg-slate-50 dark:bg-slate-900/40 p-2 border border-slate-200 dark:border-slate-800 rounded-lg">
                  <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1">圓環範圍範疇</label>
                  <select
                    value={donutRange}
                    onChange={(e) => setDonutRange(e.target.value as any)}
                    className="w-full text-xs px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-white"
                  >
                    <option value="full">360° 完整全圓環 (Full Donut)</option>
                    <option value="half">180° 頂部拱形半圓環 (Half Donut)</option>
                  </select>
                  <span className="text-[9px] text-slate-500 dark:text-slate-400 mt-1 block">半圓環適合展示像是儀表板、目標完成百分比等半圓儀錶效果。</span>
                </div>
              )}
            </div>
          )}

          {type === 'table' && (
            <div className="space-y-2.5">
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800 pb-1 flex items-center gap-1">
                <Info className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                表格顯示設定
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1">每頁顯示筆數</label>
                  <select
                    value={tablePageSize}
                    onChange={(e) => setTablePageSize(Number(e.target.value))}
                    className="w-full text-xs px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-white"
                  >
                    <option value={5}>5 筆</option>
                    <option value={8}>8 筆</option>
                    <option value={10}>10 筆</option>
                    <option value={15}>15 筆</option>
                    <option value={20}>20 筆</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1">群組/小計維度欄位 (選用)</label>
                  <select
                    value={tableGroupByCol}
                    onChange={(e) => setTableGroupByCol(e.target.value)}
                    className="w-full text-xs px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-white"
                  >
                    <option value="">-- 顯示原始明細資料 --</option>
                    {columns.map((c) => (
                      <option key={c.name} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {tableGroupByCol && (
                <span className="text-[9px] text-emerald-600 dark:text-emerald-400 mt-0.5 block font-medium">
                  💡 已啟用分組：將依「{tableGroupByCol}」進行加總彙總。請於下方勾選要加總的數值欄位。
                </span>
              )}

              {!tableGroupByCol && (
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5">要呈現的欄位 (複選)</label>
                  <div className="grid grid-cols-2 gap-1.5 max-h-24 overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-slate-900/60 p-2 border border-slate-200 dark:border-slate-700/60 rounded-xl">
                    {columns.map((c) => {
                      const isChecked = tableCols.includes(c.name);
                      return (
                        <button
                          key={c.name}
                          onClick={() => toggleTableColumn(c.name)}
                          className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] text-left transition-colors truncate ${
                            isChecked
                              ? 'bg-indigo-600/20 text-indigo-700 dark:text-indigo-300 font-medium'
                              : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          {isChecked ? <Check className="w-3 h-3 text-indigo-600 dark:text-indigo-400" /> : <div className="w-3 h-3 border border-slate-300 dark:border-slate-600 rounded"></div>}
                          <span className="truncate">{c.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5">要計算小計的數值欄位 (複選)</label>
                <div className="grid grid-cols-2 gap-1.5 max-h-24 overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-slate-900/60 p-2 border border-slate-200 dark:border-slate-700/60 rounded-xl">
                  {columns.filter(c => c.isNumeric).map((c) => {
                    const isChecked = tableSubtotalCols.includes(c.name);
                    return (
                      <button
                        key={c.name}
                        onClick={() => toggleTableSubtotalColumn(c.name)}
                        className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] text-left transition-colors truncate ${
                          isChecked
                            ? 'bg-emerald-600/20 text-emerald-700 dark:text-emerald-300 font-medium'
                            : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        {isChecked ? <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> : <div className="w-3 h-3 border border-slate-300 dark:border-slate-600 rounded"></div>}
                        <span className="truncate">{c.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-2.5 mt-2 border-t border-slate-200 dark:border-slate-800 pt-3">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
        >
          取消
        </button>
        <button
          onClick={handleSave}
          className="inline-flex items-center gap-1.5 px-4.5 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-slate-800 dark:text-white rounded-xl transition-colors shadow-sm"
        >
          {editingCard ? '儲存變更' : '新增至儀表板'}
        </button>
      </div>
    </div>
  );
}
