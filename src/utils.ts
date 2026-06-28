/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ColumnInfo, ColumnType, RowData, OperationType } from './types';

/* -------------------------------------------------------------------------- */
/* Safe formula engine (no eval) for advanced calculated columns.             */
/* Supports: [欄位名] references, numbers, + - * /, parentheses, unary minus.  */
/* -------------------------------------------------------------------------- */

type FormulaToken =
  | { t: 'num'; v: number }
  | { t: 'col'; v: string }
  | { t: 'op'; v: '+' | '-' | '*' | '/' | 'neg' }
  | { t: 'lp' }
  | { t: 'rp' };

function tokenizeFormula(expr: string): FormulaToken[] {
  const tokens: FormulaToken[] = [];
  let i = 0;
  const prevMeaningful = () => tokens[tokens.length - 1];
  while (i < expr.length) {
    const ch = expr[i];
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') { i++; continue; }
    if (ch === '[') {
      const end = expr.indexOf(']', i + 1);
      if (end === -1) throw new Error('欄位括號 [ 未閉合');
      tokens.push({ t: 'col', v: expr.substring(i + 1, end).trim() });
      i = end + 1;
      continue;
    }
    if (ch === '(') { tokens.push({ t: 'lp' }); i++; continue; }
    if (ch === ')') { tokens.push({ t: 'rp' }); i++; continue; }
    if (ch === '+' || ch === '-' || ch === '*' || ch === '/') {
      const prev = prevMeaningful();
      const isUnary = ch === '-' && (!prev || prev.t === 'op' || prev.t === 'lp');
      tokens.push({ t: 'op', v: isUnary ? 'neg' : (ch as '+' | '-' | '*' | '/') });
      i++;
      continue;
    }
    if ((ch >= '0' && ch <= '9') || ch === '.') {
      let j = i + 1;
      while (j < expr.length && ((expr[j] >= '0' && expr[j] <= '9') || expr[j] === '.')) j++;
      const num = Number(expr.substring(i, j));
      if (isNaN(num)) throw new Error('數字格式錯誤: ' + expr.substring(i, j));
      tokens.push({ t: 'num', v: num });
      i = j;
      continue;
    }
    throw new Error('無法辨識的字元: "' + ch + '"');
  }
  return tokens;
}

const PRECEDENCE: Record<string, number> = { '+': 2, '-': 2, '*': 3, '/': 3, neg: 4 };

function toRPN(tokens: FormulaToken[]): FormulaToken[] {
  const output: FormulaToken[] = [];
  const ops: FormulaToken[] = [];
  for (const tok of tokens) {
    if (tok.t === 'num' || tok.t === 'col') {
      output.push(tok);
    } else if (tok.t === 'op') {
      while (ops.length) {
        const top = ops[ops.length - 1];
        if (top.t === 'op' &&
            (PRECEDENCE[top.v] > PRECEDENCE[tok.v] ||
             (PRECEDENCE[top.v] === PRECEDENCE[tok.v] && tok.v !== 'neg'))) {
          output.push(ops.pop()!);
        } else break;
      }
      ops.push(tok);
    } else if (tok.t === 'lp') {
      ops.push(tok);
    } else if (tok.t === 'rp') {
      while (ops.length && ops[ops.length - 1].t !== 'lp') output.push(ops.pop()!);
      if (!ops.length) throw new Error('括號不對稱');
      ops.pop(); // discard lp
    }
  }
  while (ops.length) {
    const op = ops.pop()!;
    if (op.t === 'lp') throw new Error('括號不對稱');
    output.push(op);
  }
  return output;
}

export interface CompiledFormula {
  ok: boolean;
  error?: string;
  /** Referenced column names (for validation/UI). */
  columns: string[];
  evaluate: (row: RowData) => number;
}

/**
 * Compile a formula string ONCE into a fast row evaluator. Returns ok:false with
 * an error message when the formula is malformed (so the UI can show it live).
 */
export function compileFormula(expr: string): CompiledFormula {
  const noop = (): number => 0;
  if (!expr || !expr.trim()) {
    return { ok: false, error: '公式為空', columns: [], evaluate: noop };
  }
  let rpn: FormulaToken[];
  try {
    rpn = toRPN(tokenizeFormula(expr));
  } catch (e: any) {
    return { ok: false, error: e?.message || '公式語法錯誤', columns: [], evaluate: noop };
  }
  const cols = Array.from(new Set(rpn.filter((t): t is { t: 'col'; v: string } => t.t === 'col').map(t => t.v)));

  // Dry-run with empty row to catch structural errors (e.g. dangling operators).
  const evaluate = (row: RowData): number => {
    const stack: number[] = [];
    for (const tok of rpn) {
      if (tok.t === 'num') stack.push(tok.v);
      else if (tok.t === 'col') {
        const n = Number(row[tok.v]);
        stack.push(isNaN(n) ? 0 : n);
      } else if (tok.t === 'op') {
        if (tok.v === 'neg') {
          if (stack.length < 1) throw new Error('運算式不完整');
          stack.push(-stack.pop()!);
        } else {
          if (stack.length < 2) throw new Error('運算式不完整');
          const b = stack.pop()!;
          const a = stack.pop()!;
          if (tok.v === '+') stack.push(a + b);
          else if (tok.v === '-') stack.push(a - b);
          else if (tok.v === '*') stack.push(a * b);
          else stack.push(b === 0 ? 0 : a / b);
        }
      }
    }
    return stack.length === 1 ? stack[0] : 0;
  };

  try {
    evaluate({});
  } catch (e: any) {
    return { ok: false, error: e?.message || '運算式不完整', columns: cols, evaluate: noop };
  }
  return { ok: true, columns: cols, evaluate };
}

/** Hard cap on how many distinct categories a single aggregated chart will draw. */
export const MAX_CHART_CATEGORIES = 30;

/**
 * Treat a value as numeric only when it is a finite number that does NOT look
 * like an identifier. Leading-zero codes (ZIP / phone / order numbers such as
 * "007" or "0912345678") stay as strings so they are not accidentally summed
 * or averaged.
 */
export function looksNumeric(strVal: string): boolean {
  if (strVal === '') return false;
  const n = Number(strVal);
  if (!isFinite(n)) return false; // rejects NaN and Infinity
  if (/^[+-]?0\d/.test(strVal)) return false; // leading-zero identifier-like values
  return true;
}

/**
 * Detect column metadata and types from rows
 */
export function analyzeColumns(rows: RowData[]): ColumnInfo[] {
  if (rows.length === 0) return [];
  const colNames = Object.keys(rows[0]);

  return colNames.map(name => {
    let numericCount = 0;
    let booleanCount = 0;
    let dateCount = 0;
    let nonNullCount = 0;
    const uniqueValsSet = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const val = rows[i][name];
      if (val !== undefined && val !== null && val !== '') {
        nonNullCount++;
        const strVal = String(val).trim();
        uniqueValsSet.add(strVal);

        const numeric = looksNumeric(strVal);
        // Check number
        if (numeric) {
          numericCount++;
        }
        // Check boolean
        if (strVal.toLowerCase() === 'true' || strVal.toLowerCase() === 'false' || val === true || val === false) {
          booleanCount++;
        }
        // Check date (only for non-numeric strings that parse as a date)
        if (!numeric && !isNaN(Date.parse(strVal))) {
          dateCount++;
        }
      }
    }

    let type: ColumnType = 'string';
    if (nonNullCount > 0) {
      if (numericCount / nonNullCount > 0.8) {
        type = 'number';
      } else if (booleanCount / nonNullCount > 0.8) {
        type = 'boolean';
      } else if (dateCount / nonNullCount > 0.8) {
        type = 'date';
      }
    }

    return {
      name,
      type,
      uniqueValues: Array.from(uniqueValsSet).sort(),
      isNumeric: type === 'number',
    };
  });
}

/**
 * Perform numeric calculation on a column.
 * MIN/MAX use a reduce (avoids Math.min(...arr) call-stack overflow on huge
 * datasets); COUNT counts non-empty values of the chosen column.
 */
export function calculateMetric(rows: RowData[], columnName: string, op: OperationType): number {
  if (op === 'COUNT') {
    return rows.reduce((count, r) => {
      const v = r[columnName];
      return count + (v !== undefined && v !== null && String(v).trim() !== '' ? 1 : 0);
    }, 0);
  }

  const values = rows
    .map(r => Number(r[columnName]))
    .filter(val => !isNaN(val));

  if (values.length === 0) return 0;

  switch (op) {
    case 'SUM':
      return values.reduce((sum, val) => sum + val, 0);
    case 'AVG':
      return values.reduce((sum, val) => sum + val, 0) / values.length;
    case 'MIN':
      return values.reduce((m, v) => (v < m ? v : m), values[0]);
    case 'MAX':
      return values.reduce((m, v) => (v > m ? v : m), values[0]);
    case 'MEDIAN': {
      const sorted = [...values].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    }
    default:
      return 0;
  }
}

/**
 * Helper to aggregate data for charting
 */
export interface AggregatedPoint {
  name: string;
  value: number;
}

export interface AggregateOptions {
  /** Sort categories by value (good for bar/pie); keep insertion order otherwise (good for line/area time-series). */
  sortByValue?: boolean;
  /** Maximum number of categories before the remainder is folded into an "其他" bucket. */
  maxCategories?: number;
}

export function aggregateChartData(
  rows: RowData[],
  xAxisCol: string,
  yAxisCol: string,
  method: 'SUM' | 'AVG' | 'RAW',
  options: AggregateOptions = {}
): AggregatedPoint[] {
  if (method === 'RAW') {
    return rows.map((r, idx) => ({
      name: String(r[xAxisCol] ?? `Row ${idx + 1}`),
      value: isNaN(Number(r[yAxisCol])) ? 0 : Number(r[yAxisCol]),
    })).slice(0, 100); // Limit to first 100 items for layout safety
  }

  const { sortByValue = false, maxCategories = MAX_CHART_CATEGORIES } = options;

  const grouping: { [key: string]: number[] } = {};
  const order: string[] = [];
  for (const row of rows) {
    const key = String(row[xAxisCol] ?? 'Blank');
    const val = isNaN(Number(row[yAxisCol])) ? 0 : Number(row[yAxisCol]);
    if (!grouping[key]) {
      grouping[key] = [];
      order.push(key);
    }
    grouping[key].push(val);
  }

  interface InternalPoint extends AggregatedPoint { _sum: number; _count: number; }
  let points: InternalPoint[] = order.map(key => {
    const list = grouping[key];
    const sum = list.reduce((a, b) => a + b, 0);
    return {
      name: key,
      value: method === 'SUM' ? sum : sum / list.length,
      _sum: sum,
      _count: list.length,
    };
  });

  if (sortByValue) {
    points.sort((a, b) => b.value - a.value);
  }

  // Fold the long tail into a single "其他" bucket to keep charts readable.
  if (points.length > maxCategories) {
    const head = points.slice(0, maxCategories - 1);
    const tail = points.slice(maxCategories - 1);
    const tailSum = tail.reduce((a, p) => a + p._sum, 0);
    const tailCount = tail.reduce((a, p) => a + p._count, 0);
    head.push({
      name: `其他 (${tail.length} 項)`,
      value: method === 'SUM' ? tailSum : (tailCount ? tailSum / tailCount : 0),
      _sum: tailSum,
      _count: tailCount,
    });
    points = head;
  }

  return points.map(p => ({ name: p.name, value: p.value }));
}

/* -------------------------------------------------------------------------- */
/* Dirty-table / data-prep helpers: pick header row, clean dates, unpivot.    */
/* -------------------------------------------------------------------------- */

/** Normalize a single cell: convert Date (or date-like string) to YYYY-MM-DD. */
export function cleanCell(val: any): any {
  const formatDate = (date: Date): string => {
    if (isNaN(date.getTime())) return '';
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };
  if (val instanceof Date) return formatDate(val);
  if (typeof val === 'string') {
    const isLongDate = val.includes('00:00:00') || /^[A-Za-z]{3} [A-Za-z]{3} \d{2} \d{4}/.test(val);
    if (isLongDate && !isNaN(Date.parse(val))) return formatDate(new Date(val));
  }
  return val;
}

/**
 * Heuristically guess which row of a raw matrix is the real header row:
 * the first row (within the first several) that is mostly non-empty text and
 * is followed by a row containing more numbers (i.e. data begins below it).
 */
export function detectHeaderRow(matrix: any[][]): number {
  const limit = Math.min(matrix.length, 8);
  const isEmpty = (v: any) => v === undefined || v === null || String(v).trim() === '';
  const isNum = (v: any) => !isEmpty(v) && looksNumeric(String(v).trim());

  let best = 0;
  let bestScore = -Infinity;
  for (let r = 0; r < limit; r++) {
    const row = matrix[r] || [];
    const cells = row.filter((c) => !isEmpty(c));
    if (cells.length === 0) continue;
    const textCount = cells.filter((c) => !isNum(c)).length;
    const next = matrix[r + 1] || [];
    const nextNonEmpty = next.filter((c) => !isEmpty(c));
    const nextNumRatio = nextNonEmpty.length ? next.filter(isNum).length / nextNonEmpty.length : 0;
    // Prefer wide, mostly-text rows that have data below them.
    const score = cells.length + textCount * 0.5 + nextNumRatio * 2 + (matrix[r + 1] ? 1 : 0);
    if (score > bestScore) { bestScore = score; best = r; }
  }
  return best;
}

/** Make header names unique and non-empty (blank → 欄N, dup → name_2). */
function normalizeHeaders(rawHeader: any[]): string[] {
  const seen: Record<string, number> = {};
  return rawHeader.map((h, i) => {
    let name = h === undefined || h === null ? '' : String(h).trim();
    if (name === '') name = `欄${i + 1}`;
    if (seen[name]) {
      seen[name]++;
      name = `${name}_${seen[name]}`;
    } else {
      seen[name] = 1;
    }
    return name;
  });
}

export interface PrepConfig {
  headerRow: number;
  unpivot: boolean;
  idColumns: string[];
  categoryName: string;
  valueName: string;
  forwardFill: boolean;
}

/**
 * Build clean tidy rows from a raw 2D matrix according to the prep config.
 * Supports skipping junk rows above the header, forward-filling merged cells,
 * and unpivoting a crosstab (wide) layout into long/tidy rows.
 */
export function buildRowsFromMatrix(matrix: any[][], config: PrepConfig): { columns: string[]; rows: RowData[] } {
  if (!matrix || matrix.length === 0) return { columns: [], rows: [] };
  const headerRow = Math.max(0, Math.min(config.headerRow, matrix.length - 1));
  const headers = normalizeHeaders(matrix[headerRow] || []);
  const bodyMatrix = matrix.slice(headerRow + 1);

  // Map matrix rows to objects, cleaning date cells.
  const objects: RowData[] = bodyMatrix
    .filter((row) => row.some((c) => c !== undefined && c !== null && String(c).trim() !== ''))
    .map((row) => {
      const obj: RowData = {};
      headers.forEach((h, i) => { obj[h] = cleanCell(row[i]); });
      return obj;
    });

  // Forward-fill blanks (for merged cells) — across all columns, top to bottom.
  if (config.forwardFill) {
    const last: RowData = {};
    for (const obj of objects) {
      for (const h of headers) {
        const v = obj[h];
        if (v === undefined || v === null || String(v).trim() === '') {
          if (last[h] !== undefined) obj[h] = last[h];
        } else {
          last[h] = v;
        }
      }
    }
  }

  if (!config.unpivot) {
    return { columns: headers, rows: objects };
  }

  // Unpivot: keep idColumns, melt the rest into category/value pairs.
  const ids = config.idColumns.filter((c) => headers.includes(c));
  const measures = headers.filter((h) => !ids.includes(h));
  const catName = config.categoryName.trim() || '類別';
  const valName = config.valueName.trim() || '數值';
  const outCols = [...ids, catName, valName];
  const outRows: RowData[] = [];
  for (const obj of objects) {
    for (const m of measures) {
      const cell = obj[m];
      if (cell === undefined || cell === null || String(cell).trim() === '') continue;
      const rec: RowData = {};
      ids.forEach((id) => { rec[id] = obj[id]; });
      rec[catName] = m;
      const num = Number(cell);
      rec[valName] = isNaN(num) ? cell : num;
      outRows.push(rec);
    }
  }
  return { columns: outCols, rows: outRows };
}

/* -------------------------------------------------------------------------- */
/* CSV text encoding: detect BOM / UTF-8 vs Big5 and decode to a string.       */
/* -------------------------------------------------------------------------- */

export type CsvEncoding = 'utf-8' | 'big5';

/**
 * Guess a CSV file's encoding: UTF-8 BOM wins; otherwise try strict UTF-8 and
 * fall back to Big5 (the common Traditional-Chinese Excel CSV codepage).
 */
export function detectCsvEncoding(bytes: Uint8Array): CsvEncoding {
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return 'utf-8';
  }
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return 'utf-8';
  } catch {
    return 'big5';
  }
}

/** Decode CSV bytes with the given encoding, stripping a UTF-8 BOM if present. */
export function decodeCsvBytes(bytes: Uint8Array, encoding: CsvEncoding): string {
  let b = bytes;
  if (b.length >= 3 && b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf) {
    b = b.subarray(3);
  }
  try {
    return new TextDecoder(encoding).decode(b);
  } catch {
    return new TextDecoder('utf-8').decode(b);
  }
}
