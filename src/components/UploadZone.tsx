/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Upload, FileSpreadsheet, AlertCircle, Sparkles } from 'lucide-react';
import { RowData } from '../types';
import DataPrep from './DataPrep';

interface UploadZoneProps {
  onDataLoaded: (fileName: string, rows: RowData[]) => void;
}

export default function UploadZone({ onDataLoaded }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Raw matrix (xlsx) or raw CSV bytes awaiting the Data Prep step.
  const [prepMatrix, setPrepMatrix] = useState<any[][] | null>(null);
  const [prepBytes, setPrepBytes] = useState<Uint8Array | null>(null);
  const [prepName, setPrepName] = useState('');

  const processFile = (file: File) => {
    const validExtensions = ['.csv', '.xls', '.xlsx'];
    const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

    if (!validExtensions.includes(fileExtension)) {
      setError('不支援此檔案格式。請上傳 .csv, .xls 或 .xlsx 格式的資料表。');
      return;
    }

    setError(null);
    setLoading(true);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);

        // CSV: hand the raw bytes to Data Prep so the user can switch the text
        // encoding (UTF-8 / Big5) live and fix mojibake.
        if (fileExtension === '.csv') {
          if (data.length === 0) throw new Error('檔案是空的。');
          setPrepBytes(data);
          setPrepMatrix(null);
          setPrepName(file.name);
          return;
        }

        // XLSX/XLS: binary format, encoding-safe.
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });

        if (workbook.SheetNames.length === 0) {
          throw new Error('此檔案不包含任何工作表。');
        }

        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        // Read as a raw 2D matrix (no header assumption) so the user can pick
        // the real header row / handle dirty tables in the Data Prep step.
        const matrix = XLSX.utils.sheet_to_json<any[]>(worksheet, {
          header: 1,
          defval: '',
          blankrows: false,
        });

        if (!matrix || matrix.length === 0) {
          throw new Error('工作表中沒有可讀取的資料。');
        }

        setPrepBytes(null);
        setPrepMatrix(matrix);
        setPrepName(file.name);
      } catch (err: any) {
        console.error('Error parsing file:', err);
        setError(`檔案解析失敗: ${err.message || '格式不正確'}`);
      } finally {
        setLoading(false);
      }
    };

    reader.onerror = () => {
      setError('讀取檔案時出錯，請再試一次。');
      setLoading(false);
    };

    reader.readAsArrayBuffer(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  // Demo Excel file loader
  const loadDemoData = () => {
    setLoading(true);
    setTimeout(() => {
      // Create mockup premium sales data in Traditional Chinese for high-quality experience
      const demoRows: RowData[] = [
        { "日期": "2026/01/05", "產品類別": "智慧手機", "產品名稱": "iPhone 17 Pro", "地區": "北部地區", "銷售額": 85000, "售出數量": 2, "顧客滿意度": 4.8 },
        { "日期": "2026/01/06", "產品類別": "筆記型電腦", "產品名稱": "MacBook Air M4", "地區": "北部地區", "銷售額": 42000, "售出數量": 1, "顧客滿意度": 4.6 },
        { "日期": "2026/01/10", "產品類別": "智慧耳機", "產品名稱": "AirPods Pro 3", "地區": "中部地區", "銷售額": 15000, "售出數量": 2, "顧客滿意度": 4.5 },
        { "日期": "2026/01/12", "產品類別": "穿戴裝置", "產品名稱": "Apple Watch S11", "地區": "南部地區", "銷售額": 13500, "售出數量": 1, "顧客滿意度": 4.2 },
        { "日期": "2026/01/15", "產品類別": "智慧手機", "產品名稱": "Galaxy S26", "地區": "南部地區", "銷售額": 68000, "售出數量": 2, "顧客滿意度": 4.7 },
        { "日期": "2026/01/18", "產品類別": "筆記型電腦", "產品名稱": "ThinkPad X1", "地區": "中部地區", "銷售額": 55000, "售出數量": 1, "顧客滿意度": 4.4 },
        { "日期": "2026/01/22", "產品類別": "智慧耳機", "產品名稱": "Sony WH-1000XM6", "地區": "北部地區", "銷售額": 22000, "售出數量": 2, "顧客滿意度": 4.9 },
        { "日期": "2026/01/25", "產品類別": "穿戴裝置", "產品名稱": "Garmin Fenix 8", "地區": "北部地區", "銷售額": 48000, "售出數量": 2, "顧客滿意度": 4.8 },
        { "日期": "2026/02/02", "產品類別": "智慧手機", "產品名稱": "iPhone 17 Pro", "地區": "中部地區", "銷售額": 127500, "售出數量": 3, "顧客滿意度": 4.9 },
        { "日期": "2026/02/05", "產品類別": "筆記型電腦", "產品名稱": "MacBook Pro M4", "地區": "南部地區", "銷售額": 79000, "售出數量": 1, "顧客滿意度": 4.7 },
        { "日期": "2026/02/10", "產品類別": "智慧耳機", "產品名稱": "AirPods Pro 3", "地區": "南部地區", "銷售額": 7500, "售出數量": 1, "顧客滿意度": 4.3 },
        { "日期": "2026/02/15", "產品類別": "穿戴裝置", "產品名稱": "Apple Watch S11", "地區": "北部地區", "銷售額": 27000, "售出數量": 2, "顧客滿意度": 4.4 },
        { "日期": "2026/02/18", "產品類別": "智慧手機", "產品名稱": "Pixel 10 Pro", "地區": "中部地區", "銷售額": 32000, "售出數量": 1, "顧客滿意度": 4.6 },
        { "日期": "2026/02/20", "產品類別": "筆記型電腦", "產品名稱": "ASUS ZenBook", "地區": "北部地區", "銷售額": 35000, "售出數量": 1, "顧客滿意度": 4.1 },
        { "日期": "2026/02/24", "產品類別": "智慧耳機", "產品名稱": "Sony WH-1000XM6", "地區": "中部地區", "銷售額": 11000, "售出數量": 1, "顧客滿意度": 4.7 },
        { "日期": "2026/02/28", "產品類別": "穿戴裝置", "產品名稱": "Garmin Fenix 8", "地區": "南部地區", "銷售額": 24000, "售出數量": 1, "顧客滿意度": 4.5 }
      ];

      onDataLoaded("Demo_3C銷售產品數據表.xlsx", demoRows);
      setLoading(false);
    }, 600);
  };

  return (
    <>
    {(prepMatrix || prepBytes) && (
      <DataPrep
        fileName={prepName}
        matrix={prepMatrix || undefined}
        csvBytes={prepBytes || undefined}
        onConfirm={(rows) => { setPrepMatrix(null); setPrepBytes(null); onDataLoaded(prepName, rows); }}
        onCancel={() => { setPrepMatrix(null); setPrepBytes(null); }}
      />
    )}
    <div className="w-full max-w-2xl mx-auto" id="upload-zone">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-3xl p-10 flex flex-col items-center justify-center text-center transition-all ${
          isDragging
            ? 'border-indigo-500 bg-indigo-50/50 scale-[1.01]'
            : 'border-slate-200 bg-white hover:border-indigo-400 hover:bg-slate-50/20'
        }`}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileInputChange}
          accept=".csv, .xls, .xlsx"
          className="hidden"
        />

        <div className={`p-4 rounded-2xl mb-4 transition-all ${isDragging ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-50 text-slate-400'}`}>
          {loading ? (
            <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <Upload className="w-10 h-10" />
          )}
        </div>

        <h3 className="text-lg font-semibold text-slate-800 font-display">上傳您的資料表檔案</h3>
        <p className="text-xs text-slate-500 mt-1.5 max-w-sm">
          支援 <span className="font-semibold">.xlsx, .xls</span> 或 <span className="font-semibold">.csv</span> 格式
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-3 mt-6">
          <button
            onClick={triggerFileInput}
            disabled={loading}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl text-sm transition-colors shadow-sm disabled:opacity-50"
          >
            瀏覽電腦中的檔案
          </button>
          
          <button
            onClick={loadDemoData}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-medium rounded-xl text-sm transition-colors border border-indigo-100 disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4 text-indigo-500" />
            載入示範銷售資料
          </button>
        </div>

        {error && (
          <div className="mt-6 flex items-center gap-2 p-3.5 bg-rose-50 text-rose-700 text-xs rounded-xl border border-rose-100 max-w-md">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="text-left font-medium">{error}</span>
          </div>
        )}
      </div>

      <div className="mt-8 flex items-center justify-center gap-6 text-slate-400 text-xs">
        <div className="flex items-center gap-1.5">
          <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
          <span>XLSX 檔案支援</span>
        </div>
        <div className="flex items-center gap-1.5">
          <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
          <span>CSV 逗號分隔值</span>
        </div>
      </div>
    </div>
    </>
  );
}
