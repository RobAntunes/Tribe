import React, { ReactNode, Suspense, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import './styles.css';

interface TabErrorBoundaryProps {
    children: ReactNode;
    onError: (error: Error) => void;
}

interface TabErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

class TabErrorBoundary extends React.Component<TabErrorBoundaryProps, TabErrorBoundaryState> {
    constructor(props: TabErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error) {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error) {
        this.props.onError(error);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="tab-error">
                    <AlertTriangle className="text-red-500" size={24} />
                    <h3 className="text-red-500">Something went wrong</h3>
                    <p className="text-sm text-gray-400">{this.state.error?.message}</p>
                </div>
            );
        }

        return this.props.children;
    }
}

interface TabContentProps {
    children: ReactNode;
    isActive?: boolean;
    isLoading?: boolean;
    hasError?: boolean;
    error?: Error | null;
    onError?: (error: Error) => void;
    useErrorBoundary?: boolean;
}

export function TabContent({
    children,
    isActive = true,
    isLoading = false,
    hasError = false,
    error = null,
    onError = () => {},
    useErrorBoundary = false
}: TabContentProps) {
    // Only render content when tab is active
    if (!isActive) {
        return null;
    }

    const content = (
        <div
            className="tab-content-container"
            role="tabpanel"
        >
            {isLoading ? (
                <div className="tab-loading">
                    <div className="loading-spinner" />
                    <p>Loading...</p>
                </div>
            ) : hasError ? (
                <div className="tab-error">
                    <AlertTriangle className="text-red-500" size={24} />
                    <h3 className="text-red-500">Error loading content</h3>
                    <p className="text-sm text-gray-400">{error?.message}</p>
                </div>
            ) : (
                <Suspense fallback={<div className="loading-spinner" />}>
                    {children}
                </Suspense>
            )}
        </div>
    );

    if (useErrorBoundary) {
        return (
            <TabErrorBoundary onError={onError}>
                {content}
            </TabErrorBoundary>
        );
    }

    return content;
}