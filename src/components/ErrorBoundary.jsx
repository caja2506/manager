import React from 'react';
import { AlertTriangle, RefreshCw, Home, ChevronDown, ChevronUp } from 'lucide-react';

/**
 * ErrorBoundary — Global error catcher
 * ========================================
 * Prevents white screens by catching render errors
 * and showing a user-friendly fallback UI.
 *
 * Usage:
 *   <ErrorBoundary module="Tasks">
 *     <TaskManager />
 *   </ErrorBoundary>
 */
export default class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
            showDetails: false,
        };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        this.setState({ errorInfo });
        console.error(
            `[ErrorBoundary:${this.props.module || 'App'}]`,
            error,
            errorInfo?.componentStack
        );
    }

    handleRetry = () => {
        this.setState({ hasError: false, error: null, errorInfo: null });
    };

    handleGoHome = () => {
        window.location.href = '/';
    };

    render() {
        if (this.state.hasError) {
            const module = this.props.module || 'la aplicación';
            const { error, errorInfo, showDetails } = this.state;

            return (
                <div className="flex items-center justify-center p-8 min-h-[300px]">
                    <div className="max-w-lg w-full bg-slate-800/70 border border-red-500/20 rounded-2xl p-8 text-center shadow-xl shadow-red-900/10">
                        {/* Icon */}
                        <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto mb-4">
                            <AlertTriangle className="w-8 h-8 text-red-400" />
                        </div>

                        {/* Title */}
                        <h3 className="text-lg font-bold text-white mb-2">
                            Error en {module}
                        </h3>
                        <p className="text-sm text-slate-400 mb-6">
                            Algo salió mal al cargar este módulo. El resto de la aplicación sigue funcionando.
                        </p>

                        {/* Actions */}
                        <div className="flex items-center justify-center gap-3 mb-4">
                            <button
                                onClick={this.handleRetry}
                                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-bold transition-colors shadow-md shadow-indigo-900/30"
                            >
                                <RefreshCw className="w-4 h-4" />
                                Reintentar
                            </button>
                            <button
                                onClick={this.handleGoHome}
                                className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm font-medium transition-colors"
                            >
                                <Home className="w-4 h-4" />
                                Ir al Inicio
                            </button>
                        </div>

                        {/* Error details (expandable) */}
                        {error && (
                            <div className="mt-4 border-t border-slate-700/50 pt-4">
                                <button
                                    onClick={() => this.setState({ showDetails: !showDetails })}
                                    className="flex items-center gap-1 mx-auto text-[10px] text-slate-500 hover:text-slate-400 transition-colors"
                                >
                                    {showDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                    {showDetails ? 'Ocultar detalles' : 'Ver detalles técnicos'}
                                </button>
                                {showDetails && (
                                    <div className="mt-3 bg-slate-900/60 rounded-lg p-3 text-left">
                                        <p className="text-[10px] font-mono text-red-400 break-all">
                                            {error.toString()}
                                        </p>
                                        {errorInfo?.componentStack && (
                                            <pre className="mt-2 text-[9px] font-mono text-slate-500 overflow-x-auto max-h-32 scrollbar-thin">
                                                {errorInfo.componentStack.slice(0, 500)}
                                            </pre>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
