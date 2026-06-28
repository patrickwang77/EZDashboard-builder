/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ColumnInfo, CalculatedColumn } from '../types';
import { compileFormula } from '../utils';
import { Plus, Trash2, Calculator, AlertCircle, Info } from 'lucide-react';

interface CalculatedColumnsProps {
  columns: ColumnInfo[];
  calculatedColumns: CalculatedColumn[];
  onAddCalculatedColumn: (newCol: CalculatedColumn) => void;
  onRemoveCalculatedColumn: (name: string) => void;
}

export default function CalculatedColumns({
  columns,
  calculatedColumns,
  onAddCalculatedColumn,
  onRemoveCalculatedColumn,
}: CalculatedColumnsProps) {
  const [name, setName] = useState('');
  const [colA, setColA] = useState('');
  const [operator, setOperator] = useState<'+' | '-' | '*' | '/'>('*');
  const [operandBType, setOperandBType] = useState<'column' | 'constant'>('column');
  const [colB, setColB] = useState('');
  const [constantB, setConstantB] = useState<number>(1);
  const [error, setError] = useState<string | null>(null);

  // Advanced free-form formula mode
  const [mode, setMode] = useState<'simple' | 'advanced'>('simple');
  const [expr, setExpr] = useState('');
  const compiled = expr.trim() ? compileFormula(expr) : null;

  // Filter numeric columns for calculation candidates
  const numericColumns = columns.filter((c) => c.isNumeric);

  // Automatically select first numeric column if available
  React.useEffect(() => {
    if (numericColumns.length > 0) {
      if (!colA) setColA(numericColumns[0].name);
      if (!colB && numericColumns.length > 1) {
        setColB(numericColumns[1].name);
      } else if (!colB) {
        setColB(numericColumns[0].name);
      }
    }
  }, [columns]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('請輸入計算欄位名稱');
      return;
    }

    // Check if name already exists in columns
    if (columns.some((c) => c.name.toLowerCase() === trimmedName.toLowerCase())) {
      setError('此欄位名稱已存在於資料表中，請更換名稱');
      return;
    }

    // ---- Advanced free-form formula mode ----
    if (mode === 'advanced') {
      const result = compileFormula(expr);
      if (!result.ok) {
        setError('公式錯誤：' + (result.error || '語法不正確'));
        return;
      }
      const unknown = result.columns.filter(
        (c) => !columns.some((col) => col.name === c)
      );
      if (unknown.length > 0) {
        setError('公式參照了不存在的欄位：' + unknown.join('、'));
        return;
      }
      onAddCalculatedColumn({ name: trimmedName, expr: expr.trim() });
      setName('');
      setExpr('');
      setError(null);
      return;
    }

    if (!colA) {
      setError('請選擇第一個數值欄位');
      return;
    }

    if (operandBType === 'column' && !colB) {
      setError('請選擇第二個數值欄位');
      return;
    }

    if (operandBType === 'constant' && isNaN(constantB)) {
      setError('請輸入常數數值');
      return;
    }

    if (operator === '/' && operandBType === 'constant' && constantB === 0) {
      setError('除數不能為 0');
      return;
    }

    const newCalculatedColumn: CalculatedColumn = {
      name: trimmedName,
      colA,
      operator,
      operandBType,
      colB: operandBType === 'column' ? colB : undefined,
      constantB: operandBType === 'constant' ? constantB : undefined,
    };

    onAddCalculatedColumn(newCalculatedColumn);

    // Reset Form
    setName('');
    setError(null);
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm transition-colors">
      <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-1.5 font-display">
        <Calculator className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
        自訂數值計算欄位 (Custom Formulas)
      </h3>
      <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">
        透過基本的四則運算，在原始資料中動態建立新的計算欄位。可用於計算毛利、單價、折扣或成長率等指標。
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Creation Form */}
        <form onSubmit={handleSubmit} className="lg:col-span-5 space-y-3.5 bg-slate-50/50 dark:bg-slate-800/40 p-4 border border-slate-100 dark:border-slate-800 rounded-2xl">
          <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 border-b border-slate-200 dark:border-slate-700 pb-1 flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
            新增計算公式
          </div>

          {/* Mode tabs */}
          <div className="flex gap-1 p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-[11px] font-semibold">
            <button
              type="button"
              onClick={() => { setMode('simple'); setError(null); }}
              className={`flex-1 py-1 rounded-md transition-colors ${mode === 'simple' ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}
            >
              簡易 (兩欄)
            </button>
            <button
              type="button"
              onClick={() => { setMode('advanced'); setError(null); }}
              className={`flex-1 py-1 rounded-md transition-colors ${mode === 'advanced' ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}
            >
              進階公式
            </button>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">新欄位名稱</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：總價、單價、九折價"
              className="w-full text-xs px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-indigo-500 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />
          </div>

          {mode === 'simple' && (<>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">數值欄位 A</label>
              <select
                value={colA}
                onChange={(e) => setColA(e.target.value)}
                className="w-full text-xs px-2.5 py-2 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-indigo-500 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
              >
                {numericColumns.length === 0 ? (
                  <option value="">(無數值欄位)</option>
                ) : (
                  numericColumns.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">運算子</label>
              <select
                value={operator}
                onChange={(e) => setOperator(e.target.value as any)}
                className="w-full text-xs px-2.5 py-2 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-indigo-500 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-mono font-semibold"
              >
                <option value="*">× (乘)</option>
                <option value="/">÷ (除)</option>
                <option value="+">+ (加)</option>
                <option value="-">- (減)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">運算對象 B</label>
            <div className="flex gap-4 mb-2">
              <label className="flex items-center gap-1 text-[11px] text-slate-600 dark:text-slate-300 cursor-pointer">
                <input
                  type="radio"
                  name="operandBType"
                  checked={operandBType === 'column'}
                  onChange={() => setOperandBType('column')}
                  className="text-indigo-600 focus:ring-indigo-500 w-3 h-3"
                />
                其他欄位
              </label>
              <label className="flex items-center gap-1 text-[11px] text-slate-600 dark:text-slate-300 cursor-pointer">
                <input
                  type="radio"
                  name="operandBType"
                  checked={operandBType === 'constant'}
                  onChange={() => setOperandBType('constant')}
                  className="text-indigo-600 focus:ring-indigo-500 w-3 h-3"
                />
                固定數值 (常數)
              </label>
            </div>

            {operandBType === 'column' ? (
              <select
                value={colB}
                onChange={(e) => setColB(e.target.value)}
                className="w-full text-xs px-2.5 py-2 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-indigo-500 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
              >
                {numericColumns.length === 0 ? (
                  <option value="">(無數值欄位)</option>
                ) : (
                  numericColumns.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name}
                    </option>
                  ))
                )}
              </select>
            ) : (
              <input
                type="number"
                step="any"
                value={constantB}
                onChange={(e) => setConstantB(parseFloat(e.target.value) || 0)}
                placeholder="請輸入常數，例如 0.9"
                className="w-full text-xs px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-indigo-500 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 font-mono"
              />
            )}
          </div>
          </>)}

          {/* Advanced free-form formula */}
          {mode === 'advanced' && (
            <div className="space-y-1.5">
              <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400">公式 (可用多個欄位與括號)</label>
              <textarea
                value={expr}
                onChange={(e) => setExpr(e.target.value)}
                rows={2}
                placeholder="例如：[銷售額] * [數量] - [成本] * 0.05"
                className="w-full text-xs px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-indigo-500 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 font-mono resize-none"
              />
              <div className="flex flex-wrap gap-1">
                <span className="text-[10px] text-slate-400 dark:text-slate-500 self-center mr-0.5">插入欄位：</span>
                {columns.map((c) => (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() => setExpr((prev) => prev + '[' + c.name + ']')}
                    className="text-[10px] px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors"
                  >
                    {c.name}
                  </button>
                ))}
              </div>
              {expr.trim() && (
                compiled && compiled.ok ? (
                  <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                    ✓ 公式有效{compiled.columns.length ? `（參照 ${compiled.columns.length} 個欄位）` : ''}
                  </div>
                ) : (
                  <div className="text-[10px] text-rose-600 dark:text-rose-400 font-medium flex items-start gap-1">
                    <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
                    <span>{compiled?.error || '公式語法錯誤'}</span>
                  </div>
                )
              )}
              <p className="text-[9px] text-slate-400 dark:text-slate-500">支援 + - × ÷ 與括號 ( )，遵循先乘除後加減；欄位請用 [欄位名] 表示。</p>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-1.5 text-[10px] text-rose-600 dark:text-rose-400 font-medium">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={mode === 'simple' && numericColumns.length === 0}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl text-xs transition-colors shadow-sm disabled:opacity-40"
          >
            建立計算欄位
          </button>
        </form>

        {/* List of existing calculated columns */}
        <div className="lg:col-span-7 flex flex-col justify-between">
          <div className="border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden h-full flex flex-col">
            <div className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span>已建立的計算欄位</span>
              <span className="text-[10px] bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-100 dark:border-indigo-900">
                {calculatedColumns.length} 個欄位
              </span>
            </div>

            <div className="p-4 flex-1 overflow-y-auto max-h-56 custom-scrollbar space-y-2">
              {calculatedColumns.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-slate-400 dark:text-slate-500 text-xs h-full">
                  <Info className="w-5 h-5 text-slate-300 dark:text-slate-600 mb-1" />
                  <p>尚未建立任何自訂計算欄位</p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">可以在左側面板中輸入公式建立。</p>
                </div>
              ) : (
                calculatedColumns.map((cc) => (
                  <div
                    key={cc.name}
                    className="flex items-center justify-between p-3 border border-slate-150 dark:border-slate-700 rounded-xl bg-slate-50/20 dark:bg-slate-800/30 hover:border-slate-300 dark:hover:border-slate-600 transition-colors"
                  >
                    <div>
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-100">{cc.name}</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-700 px-2 py-0.5 rounded w-fit max-w-full truncate" title={cc.expr || ''}>
                        {cc.expr
                          ? cc.expr
                          : `${cc.colA} ${cc.operator} ${cc.operandBType === 'column' ? cc.colB : cc.constantB}`}
                      </div>
                    </div>
                    <button
                      onClick={() => onRemoveCalculatedColumn(cc.name)}
                      className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors"
                      title="刪除欄位"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
