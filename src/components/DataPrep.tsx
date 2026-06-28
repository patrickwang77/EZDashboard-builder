/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { RowData } from '../types';
import {
  buildRowsFromMatrix,
  detectHeaderRow,
  PrepConfig,
  CsvEncoding,
  detectCsvEncoding,
  decodeCsvBytes,
} from '../utils';
import { Table2, Wand2, X, Check, AlertCircle } from 'lucide-react';

interface DataPrepProps {
  fileName: string;
  /** Pre-parsed matrix (xlsx/xls). */
  matrix?: any[][];
  /** Raw CSV bytes — lets the user switch encoding (UTF-8 / Big5) live. */
  csvBytes?: Uint8Array;
  onConfirm: (rows: RowData[]) => void;
  onCancel: () => void;
}

const PREVIEW_ROWS = 10;
const PREVIEW_COLS = 12;

function csvTextToMatrix(text: string): any[][] {
  const wb = XLSX.read(text, { type: 'string' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '', blankrows: false });
}

export default function DataPrep({ fileName, matrix, csvBytes, onConfirm, onCancel }: DataPrepProps) {
  // CSV encoding ('auto' resolves via BOM/heuristic).
  const [encChoice, setEncChoice] = useState<'auto' | CsvEncoding>('auto');
  const detectedEnc = useMemo(() => (csvBytes ? detectCsvEncoding(csvBytes) : 'utf-8'), [csvBytes]);
  const resolvedEnc: CsvEncoding = encChoice === 'auto' ? detectedEnc : encChoice;

  // Working matrix: decode CSV bytes with the chosen encoding, or use the xlsx matrix.
  const workMatrix = useMemo<any[][]>(() => {
    if (csvBytes) {
      try { return csvTextToMatrix(decodeCsvBytes(csvBytes, resolvedEnc)); }
      catch { return []; }
    }
    return matrix || [];
  }, [csvBytes, matrix, resolvedEnc]);

  const [config, setConfig] = useState<PrepConfig>(() => ({
    headerRow: detectHeaderRow(csvBytes ? csvTextToMatrix(decodeCsvBytes(csvBytes, resolvedEnc)) : (matrix || [])),
    unpivot: false,
    idColumns: [],
    categoryName: '類別',
    valueName: '數值',
    forwardFill: false,
  }));

  // Normalized header names for the current header row (drives the id-column picker).
  const headers = useMemo(
    () => buildRowsFromMatrix(workMatrix, { ...config, unpivot: false }).columns,
    [workMatrix, config.headerRow]
  );

  // Final result preview.
  const result = useMemo(() => buildRowsFromMatrix(workMatrix, config), [workMatrix, config]);

  const maxCols = Math.min(PREVIEW_COLS, Math.max(0, ...workMatrix.map((r) => r.length)));
  const previewMatrix = workMatrix.slice(0, PREVIEW_ROWS);

  const update = (patch: Partial<PrepConfig>) => setConfig((c) => ({ ...c, ...patch }));

  const toggleId = (name: string) =>
    setConfig((c) => ({
      ...c,
      idColumns: c.idColumns.includes(name)
        ? c.idColumns.filter((x) => x !== name)
        : [...c.idColumns, name],
    }));

  const cellText = (v: any) => (v === undefined || v === null ? '' : String(v));

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-lg">
              <Table2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 font-display">整理資料 (Data Prep)</h3>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate max-w-md" title={fileName}>{fileName}</p>
            </div>
          </div>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto custom-scrollbar p-5 space-y-4">
          {/* CSV text encoding (avoids Chinese mojibake) */}
          {csvBytes && (
            <div className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-lg px-3 py-2">
              <span className="font-semibold">文字編碼：</span>
              <select
                value={encChoice}
                onChange={(e) => { setEncChoice(e.target.value as any); update({ idColumns: [] }); }}
                className="text-[11px] px-2 py-1 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
              >
                <option value="auto">自動偵測（{detectedEnc === 'big5' ? 'Big5' : 'UTF-8'}）</option>
                <option value="utf-8">UTF-8</option>
                <option value="big5">Big5（繁中 Excel）</option>
              </select>
              <span className="text-[10px] text-slate-400 dark:text-slate-500">若中文變亂碼，請切換編碼</span>
            </div>
          )}

          {/* Raw preview — click a row to set it as the header */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                原始資料預覽（點一列設為標題列）
              </label>
              <span className="text-[10px] text-slate-400 dark:text-slate-500">共 {workMatrix.length} 列</span>
            </div>
            <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-lg">
              <table className="text-[11px] border-collapse w-full">
                <tbody>
                  {previewMatrix.map((row, r) => {
                    const isHeader = r === config.headerRow;
                    const isSkipped = r < config.headerRow;
                    return (
                      <tr
                        key={r}
                        onClick={() => update({ headerRow: r, idColumns: [] })}
                        className={`cursor-pointer transition-colors ${
                          isHeader
                            ? 'bg-indigo-50 dark:bg-indigo-950/40'
                            : isSkipped
                            ? 'opacity-40 hover:opacity-70'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                        }`}
                      >
                        <td className="px-2 py-1 text-[9px] font-mono text-slate-400 dark:text-slate-500 border-r border-slate-100 dark:border-slate-800 select-none whitespace-nowrap">
                          {isHeader ? '標題▶' : r + 1}
                        </td>
                        {Array.from({ length: maxCols }).map((_, c) => (
                          <td
                            key={c}
                            className={`px-2 py-1 border-r border-slate-100 dark:border-slate-800 max-w-[140px] truncate ${
                              isHeader
                                ? 'font-bold text-indigo-700 dark:text-indigo-300'
                                : 'text-slate-600 dark:text-slate-300'
                            }`}
                            title={cellText(row[c])}
                          >
                            {cellText(row[c])}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center gap-3 mt-2">
              <label className="flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-300">
                標題列在第
                <input
                  type="number"
                  min={1}
                  max={workMatrix.length}
                  value={config.headerRow + 1}
                  onChange={(e) => update({ headerRow: Math.max(0, (parseInt(e.target.value) || 1) - 1), idColumns: [] })}
                  className="w-14 text-xs px-2 py-1 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-center"
                />
                列（上方 {config.headerRow} 列將略過）
              </label>
              <label className="flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-300 cursor-pointer">
                <input type="checkbox" checked={config.forwardFill} onChange={(e) => update({ forwardFill: e.target.checked })} className="w-3.5 h-3.5 rounded border-slate-300 dark:border-slate-600 text-indigo-600" />
                向下填滿空白（合併儲存格）
              </label>
            </div>
          </div>

          {/* Crosstab → unpivot */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-3 bg-slate-50/50 dark:bg-slate-800/30">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer">
              <input type="checkbox" checked={config.unpivot} onChange={(e) => update({ unpivot: e.target.checked })} className="w-3.5 h-3.5 rounded border-slate-300 dark:border-slate-600 text-indigo-600" />
              <Wand2 className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
              這是交叉表：欄名其實是資料值，需要反轉成標準表 (Unpivot)
            </label>
            {config.unpivot && (
              <div className="mt-3 space-y-2.5">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1">保留欄位（維度，其餘欄位會被反轉）</label>
                  <div className="flex flex-wrap gap-1.5">
                    {headers.map((h) => {
                      const on = config.idColumns.includes(h);
                      return (
                        <button
                          key={h}
                          type="button"
                          onClick={() => toggleId(h)}
                          className={`text-[10px] px-2 py-1 rounded-lg border transition-colors ${
                            on
                              ? 'bg-indigo-600/15 border-indigo-400 dark:border-indigo-500 text-indigo-700 dark:text-indigo-300 font-semibold'
                              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          {on ? '✓ ' : ''}{h}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1">類別欄名稱</label>
                    <input value={config.categoryName} onChange={(e) => update({ categoryName: e.target.value })} className="w-full text-xs px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1">數值欄名稱</label>
                    <input value={config.valueName} onChange={(e) => update({ valueName: e.target.value })} className="w-full text-xs px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100" />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Result preview */}
          <div>
            <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">整理後結果預覽</label>
            {result.rows.length === 0 ? (
              <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-rose-600 dark:text-rose-400">
                <AlertCircle className="w-3.5 h-3.5" /> 沒有可用的資料列，請調整標題列或設定。
              </div>
            ) : (
              <div className="mt-1.5 overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-lg">
                <table className="text-[11px] border-collapse w-full">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      {result.columns.map((c) => (
                        <th key={c} className="px-2 py-1.5 text-left font-bold border-b border-slate-100 dark:border-slate-800 truncate max-w-[140px]">{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="text-slate-600 dark:text-slate-300">
                    {result.rows.slice(0, 5).map((row, i) => (
                      <tr key={i} className="border-b border-slate-50 dark:border-slate-800/60">
                        {result.columns.map((c) => (
                          <td key={c} className="px-2 py-1 truncate max-w-[140px]" title={cellText(row[c])}>{cellText(row[c])}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
              共 {result.columns.length} 欄、{result.rows.length} 列（僅顯示前 5 列）
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-slate-100 dark:border-slate-800">
          <button onClick={onCancel} className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
            取消
          </button>
          <button
            onClick={() => onConfirm(result.rows)}
            disabled={result.rows.length === 0}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm transition-colors disabled:opacity-40"
          >
            <Check className="w-3.5 h-3.5" />
            確認匯入
          </button>
        </div>
      </div>
    </div>
  );
}
