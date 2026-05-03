import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';
import React, { type ReactNode } from 'react';

interface ErrorBoundaryProps {
    children: ReactNode;
    fallback?: (error: Error, retry: () => void) => ReactNode;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('Error caught by boundary:', error, errorInfo);
    }

    retry = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError && this.state.error) {
            if (this.props.fallback) {
                return this.props.fallback(this.state.error, this.retry);
            }

            return (
                <div className="flex h-screen bg-gradient-to-br from-slate-900 via-red-900 to-slate-900 justify-center items-center p-4">
                    <Card className="w-full max-w-md p-8 shadow-2xl border-2 border-red-300 bg-gradient-to-b from-white to-slate-50">
                        <div className="text-center mb-6">
                            <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-orange-500 rounded-full mx-auto mb-4 flex items-center justify-center shadow-lg">
                                <AlertTriangle className="h-8 w-8 text-white" />
                            </div>
                            <h1 className="text-2xl font-bold text-red-600 mb-2">Oops!</h1>
                            <p className="text-slate-600 text-sm">Something went wrong</p>
                        </div>

                        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                            <p className="text-xs text-red-800 font-mono break-words">
                                {this.state.error.message || 'Unknown error'}
                            </p>
                        </div>

                        <Button
                            onClick={this.retry}
                            className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-semibold py-3 rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl"
                        >
                            Try Again
                        </Button>

                        <p className="text-xs text-slate-500 text-center mt-4">
                            If the problem persists, please refresh the page or contact support.
                        </p>
                    </Card>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
