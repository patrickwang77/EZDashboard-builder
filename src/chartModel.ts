/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Single source of truth for chart rendering, shared by the live preview
 * (React + Chart.js on a canvas) and the exported standalone HTML (vanilla
 * Chart.js). The export embeds this function's source via `buildChartModel.toString()`,
 * so both run byte-for-byte identical logic — what you preview is what you export.
 *
 * IMPORTANT: this function MUST stay fully self-contained (no imports, no module
 * scope references, helpers nested inside) or `.toString()` embedding will break.
 */

export interface ChartPalette {
  chartColor: string;
  hex100: string;
  pieColors: string[];
}

export interface ChartModelConfig {
  type: string; // 'bar' | 'line' | 'area' | 'pie' | 'donut' | 'overlaid-bar'
  xAxisColumn: string;
  yAxisColumn: string;
  yAxisColumn2?: string;
  donutRange?: string; // 'full' | 'half'
  aggregate: string; // 'SUM' | 'AVG' | 'RAW'
}

export interface ChartModel {
  type: string;
  data: any;
  options: any;
  donut: { isProgress: boolean; percent: number; range: string } | null;
}

export function buildChartModel(
  config: ChartModelConfig,
  rows: any[],
  palette: ChartPalette,
  isDark: boolean,
  maxCategories: number
): ChartModel {
  const MAX_CATS = maxCategories || 30;
  const textColor = isDark ? '#94a3b8' : '#475569';
  const gridColor = isDark ? '#334155' : '#e2e8f0';

  const xCol = config.xAxisColumn;
  const yCol = config.yAxisColumn;
  const yCol2 = config.yAxisColumn2 || yCol;
  const method = config.aggregate;
  const bgColors = palette.pieColors;

  // Fold a long tail of categories into a single "其他" bucket. items: {name,sum,count}
  function capCategories(items: any[], m: string, sortByValue: boolean) {
    let pts = items.map(function (it: any) {
      return {
        name: it.name,
        value: m === 'SUM' ? it.sum : (it.count ? it.sum / it.count : 0),
        sum: it.sum,
        count: it.count,
      };
    });
    // Preserve natural order (chronological dates, original categories) when the
    // whole set fits. Only when we must truncate do we sort bar/pie by value to
    // keep the largest slices; line/area keep their order so the trend stays read-able.
    if (pts.length > MAX_CATS) {
      if (sortByValue) pts.sort(function (a: any, b: any) { return b.value - a.value; });
      const head = pts.slice(0, MAX_CATS - 1);
      const tail = pts.slice(MAX_CATS - 1);
      const ts = tail.reduce(function (a: number, p: any) { return a + p.sum; }, 0);
      const tc = tail.reduce(function (a: number, p: any) { return a + p.count; }, 0);
      head.push({ name: '其他 (' + tail.length + ' 項)', value: m === 'SUM' ? ts : (tc ? ts / tc : 0), sum: ts, count: tc });
      pts = head;
    }
    return pts;
  }

  let labels: any[] = [];
  let dataPoints: number[] = [];
  let planDataPoints: number[] = [];
  let donut: { isProgress: boolean; percent: number; range: string } | null = null;

  if (config.type === 'donut' && config.yAxisColumn2) {
    // Progress donut: actual vs plan target.
    const actualValues = rows.map(function (r) { return Number(r[yCol]); }).filter(function (v) { return !isNaN(v); });
    const planValues = rows.map(function (r) { return Number(r[yCol2]); }).filter(function (v) { return !isNaN(v); });
    let actualSum = 0;
    let planSum = 0;
    if (method === 'AVG') {
      actualSum = actualValues.length ? actualValues.reduce(function (a, b) { return a + b; }, 0) / actualValues.length : 0;
      planSum = planValues.length ? planValues.reduce(function (a, b) { return a + b; }, 0) / planValues.length : 0;
    } else {
      actualSum = actualValues.reduce(function (a, b) { return a + b; }, 0);
      planSum = planValues.reduce(function (a, b) { return a + b; }, 0);
    }
    const percent = planSum > 0 ? Math.round((actualSum / planSum) * 100) : 0;
    labels = ['實際值: ' + yCol, '剩餘目標'];
    dataPoints = [actualSum, Math.max(0, planSum - actualSum)];
    donut = { isProgress: true, percent: percent, range: config.donutRange === 'half' ? 'half' : 'full' };
  } else if (config.type === 'overlaid-bar') {
    if (method === 'RAW') {
      const sliced = rows.slice(0, 100);
      labels = sliced.map(function (r, i) { return String(r[xCol] || ('Row ' + (i + 1))); });
      dataPoints = sliced.map(function (r) { return isNaN(Number(r[yCol])) ? 0 : Number(r[yCol]); });
      planDataPoints = sliced.map(function (r) { return isNaN(Number(r[yCol2])) ? 0 : Number(r[yCol2]); });
    } else {
      const groups1: any = {};
      const groups2: any = {};
      const order: string[] = [];
      rows.forEach(function (row) {
        const xVal = String(row[xCol] == null ? 'Blank' : row[xCol]);
        const yVal1 = isNaN(Number(row[yCol])) ? 0 : Number(row[yCol]);
        const yVal2 = isNaN(Number(row[yCol2])) ? 0 : Number(row[yCol2]);
        if (!groups1[xVal]) { groups1[xVal] = []; groups2[xVal] = []; order.push(xVal); }
        groups1[xVal].push(yVal1);
        groups2[xVal].push(yVal2);
      });
      order.forEach(function (key) {
        labels.push(key);
        const l1 = groups1[key];
        const l2 = groups2[key];
        if (method === 'AVG') {
          dataPoints.push(l1.reduce(function (a: number, b: number) { return a + b; }, 0) / l1.length);
          planDataPoints.push(l2.reduce(function (a: number, b: number) { return a + b; }, 0) / l2.length);
        } else {
          dataPoints.push(l1.reduce(function (a: number, b: number) { return a + b; }, 0));
          planDataPoints.push(l2.reduce(function (a: number, b: number) { return a + b; }, 0));
        }
      });
    }
  } else {
    // Standard single-metric aggregation (bar/line/area/pie/plain-donut).
    if (method === 'RAW') {
      const sliced = rows.slice(0, 100);
      labels = sliced.map(function (r, i) { return String(r[xCol] || ('Row ' + (i + 1))); });
      dataPoints = sliced.map(function (r) { return isNaN(Number(r[yCol])) ? 0 : Number(r[yCol]); });
    } else {
      const groups: any = {};
      const order: string[] = [];
      rows.forEach(function (row) {
        const xVal = String(row[xCol] == null ? 'Blank' : row[xCol]);
        const yVal = isNaN(Number(row[yCol])) ? 0 : Number(row[yCol]);
        if (!groups[xVal]) { groups[xVal] = { name: xVal, sum: 0, count: 0 }; order.push(xVal); }
        groups[xVal].sum += yVal;
        groups[xVal].count += 1;
      });
      const sortByValue = config.type === 'bar' || config.type === 'pie';
      const capped = capCategories(order.map(function (k) { return groups[k]; }), method, sortByValue);
      labels = capped.map(function (p: any) { return p.name; });
      dataPoints = capped.map(function (p: any) { return p.value; });
    }
  }

  let chartType = config.type;
  let datasets: any[] = [];
  let extraOptions: any = {};

  if (config.type === 'overlaid-bar') {
    chartType = 'bar';
    datasets = [
      {
        label: '計劃值: ' + yCol2 + ' (' + method + ')',
        data: planDataPoints,
        backgroundColor: palette.hex100,
        borderColor: palette.chartColor,
        borderWidth: 1.5,
        barPercentage: 0.9,
        categoryPercentage: 0.8,
        grouped: false,
        order: 2,
      },
      {
        label: '實際值: ' + yCol + ' (' + method + ')',
        data: dataPoints,
        backgroundColor: palette.chartColor,
        borderColor: palette.chartColor,
        borderWidth: 1.5,
        barPercentage: 0.55,
        categoryPercentage: 0.8,
        grouped: false,
        order: 1,
      },
    ];
  } else if (config.type === 'donut') {
    chartType = 'doughnut';
    let customBg: any = bgColors;
    let customBorder: any = bgColors;
    if (donut && donut.isProgress) {
      customBg = [palette.chartColor, isDark ? '#1e293b' : '#f1f5f9'];
      customBorder = [palette.chartColor, isDark ? '#334155' : '#e2e8f0'];
    }
    datasets = [{
      label: yCol + ' (' + method + ')',
      data: dataPoints,
      backgroundColor: customBg,
      borderColor: customBorder,
      borderWidth: 1.5,
    }];
    if (config.donutRange === 'half') {
      extraOptions = { circumference: 180, rotation: -90 };
    }
  } else {
    if (chartType === 'area') chartType = 'line';
    datasets = [{
      label: yCol + ' (' + method + ')',
      data: dataPoints,
      backgroundColor: config.type === 'pie' ? bgColors : (config.type === 'area' ? palette.hex100 : bgColors[0]),
      borderColor: config.type === 'pie' ? bgColors : bgColors[0],
      borderWidth: 1.5,
      fill: config.type === 'area',
      tension: 0.35,
      pointRadius: 3,
      pointHoverRadius: 6,
    }];
  }

  const isPieOrDonut = config.type === 'pie' || config.type === 'donut';

  const options: any = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 300 },
    plugins: {
      legend: {
        display: isPieOrDonut || config.type === 'overlaid-bar',
        position: 'bottom',
        labels: { boxWidth: 12, color: textColor, font: { size: 10 } },
      },
      tooltip: {
        callbacks: {
          label: function (context: any) {
            let label = context.dataset.label || '';
            if (label) label += ': ';
            if (context.parsed && context.parsed.y !== undefined && context.parsed.y !== null) {
              label += context.parsed.y.toLocaleString();
            } else if (context.parsed !== undefined && context.parsed !== null) {
              label += Number(context.parsed).toLocaleString();
            }
            return label;
          },
        },
      },
    },
    scales: isPieOrDonut ? {} : {
      y: {
        beginAtZero: true,
        grid: { color: gridColor },
        ticks: {
          color: textColor,
          font: { size: 10 },
          callback: function (value: any) { return Number(value).toLocaleString(); },
        },
      },
      x: {
        grid: { display: false },
        ticks: { color: textColor, font: { size: 10 }, maxRotation: 0, autoSkip: true, autoSkipPadding: 12 },
      },
    },
  };

  Object.keys(extraOptions).forEach(function (k) { options[k] = extraOptions[k]; });

  return {
    type: chartType,
    data: { labels: labels, datasets: datasets },
    options: options,
    donut: donut,
  };
}
