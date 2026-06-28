/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** Bumping this key (e.g. via card/template signature) resets the boundary after a config change. */
  resetKey?: string | number;
  fallbackTitle?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

/**
 * Catches render errors from its subtree (e.g. a malformed card configuration)
 * and shows a recoverable message instead of crashing the whole page.
 *
 * NOTE: this project ships without @types/react, so `React` is untyped (`any`).
 * The inherited Component members are therefore declared explicitly below so the
 * component still type-checks under the current tsconfig.
 */
export default class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  declare props: ErrorBoundaryProps;
  declare setState: (state: Partial<ErrorBoundaryState>) => void;
  state: ErrorBoundaryState = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, message: error?.message || '未知的錯誤' };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Dashboard render error:', error, info);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    // Auto-recover when the relevant configuration changes.
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, message: '' });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center gap-2 py-12 px-6 text-center bg-white dark:bg-slate-900 rounded-xl border border-rose-200 dark:border-rose-900/50 shadow-sm">
          <AlertTriangle className="w-8 h-8 text-rose-500" />
          <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
            {this.props.fallbackTitle || '此區塊渲染時發生錯誤'}
          </p>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 max-w-md break-words">
            {this.state.message}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, message: '' })}
            className="mt-1 text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            重試
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
