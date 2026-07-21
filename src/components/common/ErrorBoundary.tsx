import React, { Component, type ReactNode } from 'react';
import { AlertOctagon, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 rounded-2xl bg-red-950/20 border border-red-500/30 text-red-200 flex flex-col items-center justify-center text-center gap-3 my-4">
          <AlertOctagon className="w-8 h-8 text-red-400 animate-pulse" />
          <h3 className="text-sm font-extrabold uppercase tracking-wide">
            {this.props.fallbackTitle || 'Component Error Encountered'}
          </h3>
          <p className="text-xs text-slate-400 max-w-md">
            {this.state.error?.message || 'An unexpected rendering error occurred.'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold flex items-center gap-2 transition-all shadow-lg shadow-red-600/20"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Reload Component
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
