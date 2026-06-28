/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type ThemeId = 'indigo' | 'emerald' | 'rose' | 'amber' | 'slate' | 'violet' | 'custom';

export interface DashboardTheme {
  id: ThemeId;
  name: string;
  primary: string;       // e.g., 'bg-indigo-600'
  hover: string;         // e.g., 'hover:bg-indigo-700'
  lightBg: string;       // e.g., 'bg-indigo-50'
  lightBorder: string;   // e.g., 'border-indigo-100'
  textClass: string;     // e.g., 'text-indigo-700'
  badgeClass: string;    // e.g., 'bg-indigo-50 text-indigo-700 border-indigo-100'
  accentText: string;    // e.g., 'text-indigo-600'
  chartColor: string;    // hex
  pieColors: string[];   // hex array
  // Hex mappings for HTML exported custom tailwind theme injection
  hex50: string;
  hex100: string;
  hex600: string;
  hex700: string;
}

export const THEME_PRESETS: DashboardTheme[] = [
  {
    id: 'indigo',
    name: '經典靛藍 (Indigo)',
    primary: 'bg-indigo-600',
    hover: 'hover:bg-indigo-700',
    lightBg: 'bg-indigo-50',
    lightBorder: 'border-indigo-100',
    textClass: 'text-indigo-700',
    badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-100',
    accentText: 'text-indigo-600',
    chartColor: '#6366f1',
    pieColors: ['#4f46e5', '#6366f1', '#818cf8', '#a5b4fc', '#c7d2fe'],
    hex50: '#f5f3ff',
    hex100: '#e0e7ff',
    hex600: '#6366f1',
    hex700: '#4338ca'
  },
  {
    id: 'emerald',
    name: '翡翠綠 (Emerald)',
    primary: 'bg-emerald-600',
    hover: 'hover:bg-emerald-700',
    lightBg: 'bg-emerald-50',
    lightBorder: 'border-emerald-100',
    textClass: 'text-emerald-700',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    accentText: 'text-emerald-600',
    chartColor: '#10b981',
    pieColors: ['#059669', '#10b981', '#34d399', '#6ee7b7', '#a7f3d0'],
    hex50: '#ecfdf5',
    hex100: '#d1fae5',
    hex600: '#10b981',
    hex700: '#047857'
  },
  {
    id: 'rose',
    name: '玫瑰紅 (Rose)',
    primary: 'bg-rose-600',
    hover: 'hover:bg-rose-700',
    lightBg: 'bg-rose-50',
    lightBorder: 'border-rose-100',
    textClass: 'text-rose-700',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-100',
    accentText: 'text-rose-600',
    chartColor: '#f43f5e',
    pieColors: ['#e11d48', '#f43f5e', '#fb7185', '#fda4af', '#fecdd3'],
    hex50: '#fff1f2',
    hex100: '#ffe4e6',
    hex600: '#f43f5e',
    hex700: '#be123c'
  },
  {
    id: 'amber',
    name: '暖金橘 (Amber)',
    primary: 'bg-amber-600',
    hover: 'hover:bg-amber-700',
    lightBg: 'bg-amber-50',
    lightBorder: 'border-amber-100',
    textClass: 'text-amber-800',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-100',
    accentText: 'text-amber-600',
    chartColor: '#f59e0b',
    pieColors: ['#d97706', '#f59e0b', '#fbbf24', '#fcd34d', '#fef3c7'],
    hex50: '#fffbeb',
    hex100: '#fef3c7',
    hex600: '#f59e0b',
    hex700: '#b45309'
  },
  {
    id: 'slate',
    name: '冷冽灰 (Slate)',
    primary: 'bg-slate-700',
    hover: 'hover:bg-slate-800',
    lightBg: 'bg-slate-100',
    lightBorder: 'border-slate-200',
    textClass: 'text-slate-800',
    badgeClass: 'bg-slate-100 text-slate-800 border-slate-200',
    accentText: 'text-slate-700',
    chartColor: '#475569',
    pieColors: ['#334155', '#475569', '#64748b', '#94a3b8', '#cbd5e1'],
    hex50: '#f8fafc',
    hex100: '#f1f5f9',
    hex600: '#475569',
    hex700: '#334155'
  },
  {
    id: 'violet',
    name: '紫羅蘭 (Violet)',
    primary: 'bg-violet-600',
    hover: 'hover:bg-violet-700',
    lightBg: 'bg-violet-50',
    lightBorder: 'border-violet-100',
    textClass: 'text-violet-700',
    badgeClass: 'bg-violet-50 text-violet-700 border-violet-100',
    accentText: 'text-violet-600',
    chartColor: '#8b5cf6',
    pieColors: ['#7c3aed', '#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe'],
    hex50: '#f5f3ff',
    hex100: '#ede9fe',
    hex600: '#8b5cf6',
    hex700: '#6d28d9'
  }
];

export function adjustBrightness(hex: string, percent: number): string {
  const cleanHex = hex.replace(/^\s*#|\s*$/g, '');
  if (cleanHex.length !== 6) return hex;

  let R = parseInt(cleanHex.substring(0, 2), 16);
  let G = parseInt(cleanHex.substring(2, 4), 16);
  let B = parseInt(cleanHex.substring(4, 6), 16);

  R = Math.max(0, Math.min(255, Math.round(R * (1 + percent))));
  G = Math.max(0, Math.min(255, Math.round(G * (1 + percent))));
  B = Math.max(0, Math.min(255, Math.round(B * (1 + percent))));

  const rHex = R.toString(16).padStart(2, '0');
  const gHex = G.toString(16).padStart(2, '0');
  const bHex = B.toString(16).padStart(2, '0');

  return `#${rHex}${gHex}${bHex}`;
}

/**
 * Linearly blend `hex` toward `target` by `amount` (0..1). Used to build proper
 * light tints (mix toward white) and dark shades (mix toward black) from any
 * primary color — unlike adjustBrightness, this works correctly for very dark
 * or very light inputs.
 */
export function mix(hex: string, target: string, amount: number): string {
  const c = hex.replace(/[^0-9a-fA-F]/g, '');
  const t = target.replace(/[^0-9a-fA-F]/g, '');
  if (c.length !== 6 || t.length !== 6) return hex;
  const ch = (s: string, i: number) => parseInt(s.substring(i, i + 2), 16);
  const blend = (a: number, b: number) => Math.round(a + (b - a) * amount);
  const h = (n: number) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0');
  return `#${h(blend(ch(c, 0), ch(t, 0)))}${h(blend(ch(c, 2), ch(t, 2)))}${h(blend(ch(c, 4), ch(t, 4)))}`;
}

const WHITE = '#ffffff';
const BLACK = '#000000';

export function getTheme(id: ThemeId, customPrimaryHex?: string): DashboardTheme {
  if (id === 'custom') {
    const primaryHex = customPrimaryHex || '#3b82f6';
    const hex50 = mix(primaryHex, WHITE, 0.92);
    const hex100 = mix(primaryHex, WHITE, 0.84);
    const hex600 = primaryHex;
    const hex700 = mix(primaryHex, BLACK, 0.18);

    // Pie slices: primary then progressively lighter tints toward white.
    const pieColors = [
      primaryHex,
      mix(primaryHex, WHITE, 0.18),
      mix(primaryHex, WHITE, 0.36),
      mix(primaryHex, WHITE, 0.54),
      mix(primaryHex, WHITE, 0.7),
    ];

    return {
      id: 'custom',
      name: '自訂配色 (Custom)',
      primary: 'bg-indigo-600', // fallback name
      hover: 'hover:opacity-90',
      lightBg: 'bg-indigo-50/20',
      lightBorder: 'border-indigo-100/30',
      textClass: 'text-indigo-600 dark:text-indigo-400',
      badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-100',
      accentText: 'text-indigo-600 dark:text-indigo-400',
      chartColor: primaryHex,
      pieColors,
      hex50,
      hex100,
      hex600,
      hex700,
    };
  }

  return THEME_PRESETS.find(t => t.id === id) || THEME_PRESETS[0];
}
