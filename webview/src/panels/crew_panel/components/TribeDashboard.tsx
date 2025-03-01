import React, { useState, useEffect } from 'react';
import { Users, GitMerge, MessageSquare, GitBranch, FileCode, Settings, RefreshCw } from 'lucide-react';
import { DiffNavigationPortal } from './DiffNavigationPortal';
import { ConflictResolution } from './ConflictResolution';
import { CollaborativeAnnotations } from './CollaborativeAnnotations';
import { getVsCodeApi } from '../../../vscode';
import './TribeDashboard.css';

// Initialize VS Code API
const vscode = getVsCodeApi();

interface TribeDashboardProps {
    initialTab?: 'changes' | 'conflicts' | 'annotations' | 'settings';
}

export const TribeDashboard: React.FC<TribeDashboardProps> = ({ initialTab = 'changes' }) => {
    const [activeTab, setActiveTab] = useState<string>(initialTab);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [data, setData] = useState<{
        changes: any[];
        conflicts: any[];
        annotations: any[];
        settings: any;
    }>({
        changes: [],
        conflicts: [],
        annotations: [],
        settings: {
            theme: 'vs-dark',
            autoResolve: false,
            showLineNumbers: true,
            diffViewMode: 'inline'
        }
    });

    // Simulate data loading
    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            
            // In a real implementation, this would fetch data from the extension
            // For now, we'll use a timeout to simulate loading
            setTimeout(() => {
                // This would be replaced with actual data from the extension
                setData({
                    changes: [],
                    conflicts: [
                        {
                            id: 'conflict-1',
                            type: 'merge',
                            description: 'Merge conflict in src/components/App.tsx',
                            status: 'pending',
                            files: ['src/components/App.tsx'],
                            conflictDetails: {
                                ours: 'function App() {\n  return <div>Our version</div>;\n}',
                                theirs: 'function App() {\n  return <div>Their version</div>;\n}',
                                base: 'function App() {\n  return <div>Base version</div>;\n}',
                                filePath: 'src/components/App.tsx',
                                startLine: 10,
                                endLine: 12
                            }
                        }
                    ],
                    annotations: [
                        {
                            id: 'annotation-1',
                            content: 'This component needs to be refactored for better performance.',
                            author: {
                                id: 'user-1',
                                name: 'Current User',
                                type: 'human'
                            },
                            timestamp: new Date().toISOString(),
                            filePath: 'src/components/App.tsx',
                            lineStart: 5,
                            lineEnd: 15,
                            codeSnippet: 'function App() {\n  return <div>Hello World</div>;\n}',
                            replies: []
                        }
                    ],
                    settings: {
                        theme: 'vs-dark',
                        autoResolve: false,
                        showLineNumbers: true,
                        diffViewMode: 'inline'
                    }
                });
                setIsLoading(false);
            }, 1000);
        };

        loadData();

        // Listen for messages from the extension
        const messageListener = (event: MessageEvent) => {
            const message = event.data;
            
            switch (message.type) {
                case 'updateChanges':
                    setData(prev => ({ ...prev, changes: message.payload }));
                    break;
                case 'updateConflicts':
                    setData(prev => ({ ...prev, conflicts: message.payload }));
                    break;
                case 'updateAnnotations':
                    setData(prev => ({ ...prev, annotations: message.payload }));
                    break;
                case 'updateSettings':
                    setData(prev => ({ ...prev, settings: message.payload }));
                    break;
                case 'setActiveTab':
                    setActiveTab(message.payload);
                    break;
                default:
                    break;
            }
        };

        window.addEventListener('message', messageListener);
        
        // Notify the extension that the webview is ready
        vscode.postMessage({ type: 'webviewReady' });

        return () => {
            window.removeEventListener('message', messageListener);
        };
    }, []);

    const handleTabChange = (tab: string) => {
        setActiveTab(tab);
        // Notify the extension about tab change
        vscode.postMessage({ 
            type: 'tabChanged', 
            payload: tab 
        });
    };

    const handleViewInEditor = (filePath: string, lineNumber?: number) => {
        vscode.postMessage({
            type: 'viewFile',
            payload: { filePath, lineNumber }
        });
    };

    const handleResolveConflict = (conflictId: string, resolution: string) => {
        vscode.postMessage({
            type: 'resolveConflict',
            payload: { conflictId, resolution }
        });
        
        // Optimistically update UI
        setData(prev => ({
            ...prev,
            conflicts: prev.conflicts.map(conflict => 
                conflict.id === conflictId 
                    ? { ...conflict, status: 'resolving' } 
                    : conflict
            )
        }));
    };

    const handleRequestAIResolution = (conflictId: string) => {
        vscode.postMessage({
            type: 'requestAIResolution',
            payload: { conflictId }
        });
        
        // Optimistically update UI
        setData(prev => ({
            ...prev,
            conflicts: prev.conflicts.map(conflict => 
                conflict.id === conflictId 
                    ? { ...conflict, status: 'resolving' } 
                    : conflict
            )
        }));
    };

    const handleAddAnnotation = (annotation: any) => {
        vscode.postMessage({
            type: 'addAnnotation',
            payload: annotation
        });
        
        // Optimistically update UI with a temporary ID
        const tempId = `temp-${Date.now()}`;
        const newAnnotation = {
            ...annotation,
            id: tempId,
            timestamp: new Date().toISOString(),
            replies: []
        };
        
        setData(prev => ({
            ...prev,
            annotations: [...prev.annotations, newAnnotation]
        }));
    };

    const handleEditAnnotation = (id: string, content: string) => {
        vscode.postMessage({
            type: 'editAnnotation',
            payload: { id, content }
        });
        
        // Optimistically update UI
        setData(prev => ({
            ...prev,
            annotations: prev.annotations.map(annotation => 
                annotation.id === id 
                    ? { ...annotation, content } 
                    : annotation
            )
        }));
    };

    const handleDeleteAnnotation = (id: string) => {
        vscode.postMessage({
            type: 'deleteAnnotation',
            payload: { id }
        });
        
        // Optimistically update UI
        setData(prev => ({
            ...prev,
            annotations: prev.annotations.filter(annotation => annotation.id !== id)
        }));
    };

    const handleReplyToAnnotation = (parentId: string, reply: any) => {
        vscode.postMessage({
            type: 'replyToAnnotation',
            payload: { parentId, reply }
        });
        
        // Optimistically update UI with a temporary ID
        const tempId = `temp-reply-${Date.now()}`;
        const newReply = {
            ...reply,
            id: tempId,
            timestamp: new Date().toISOString(),
            replies: []
        };
        
        setData(prev => ({
            ...prev,
            annotations: prev.annotations.map(annotation => 
                annotation.id === parentId 
                    ? { 
                        ...annotation, 
                        replies: [...annotation.replies, newReply] 
                      } 
                    : annotation
            )
        }));
    };

    const renderContent = () => {
        if (isLoading) {
            return (
                <div className="loading-container">
                    <RefreshCw size={32} className="spin" />
                    <p>Loading Tribe Dashboard...</p>
                </div>
            );
        }

        switch (activeTab) {
            case 'changes':
                return (
                    <DiffNavigationPortal 
                        changeGroups={data.changes}
                        onViewInEditor={handleViewInEditor}
                        onAcceptGroup={(groupId) => {
                            vscode.postMessage({
                                type: 'ACCEPT_GROUP',
                                payload: { groupId }
                            });
                        }}
                        onRejectGroup={(groupId) => {
                            vscode.postMessage({
                                type: 'REJECT_GROUP',
                                payload: { groupId }
                            });
                        }}
                        onAcceptFile={(groupId, filePath, fileType) => {
                            vscode.postMessage({
                                type: 'ACCEPT_FILE',
                                payload: { groupId, filePath, fileType }
                            });
                        }}
                        onRejectFile={(groupId, filePath, fileType) => {
                            vscode.postMessage({
                                type: 'REJECT_FILE',
                                payload: { groupId, filePath, fileType }
                            });
                        }}
                        onModifyChange={(groupId, filePath, newContent) => {
                            vscode.postMessage({
                                type: 'MODIFY_CHANGE',
                                payload: { groupId, filePath, newContent }
                            });
                        }}
                        onRequestExplanation={(groupId, filePath) => {
                            vscode.postMessage({
                                type: 'REQUEST_EXPLANATION',
                                payload: { groupId, filePath }
                            });
                        }}
                    />
                );
            case 'conflicts':
                return (
                    <ConflictResolution 
                        isResolving={false}
                        conflicts={data.conflicts}
                        onResolveConflict={handleResolveConflict}
                        onRequestAIResolution={handleRequestAIResolution}
                        onViewInEditor={handleViewInEditor}
                    />
                );
            case 'annotations':
                return (
                    <CollaborativeAnnotations 
                        annotations={data.annotations}
                        currentUser={{ id: 'user-1', name: 'Current User' }}
                        agents={[{ id: 'agent-1', name: 'AI Assistant' }]}
                        onAddAnnotation={handleAddAnnotation}
                        onEditAnnotation={handleEditAnnotation}
                        onDeleteAnnotation={handleDeleteAnnotation}
                        onReplyToAnnotation={handleReplyToAnnotation}
                        onViewInEditor={handleViewInEditor}
                    />
                );
            case 'settings':
                return (
                    <div className="settings-container">
                        <h3>Tribe Settings</h3>
                        <div className="settings-group">
                            <label>
                                Theme
                                <select 
                                    value={data.settings.theme}
                                    onChange={(e) => {
                                        const newSettings = { 
                                            ...data.settings, 
                                            theme: e.target.value 
                                        };
                                        setData(prev => ({ ...prev, settings: newSettings }));
                                        vscode.postMessage({
                                            type: 'updateSettings',
                                            payload: newSettings
                                        });
                                    }}
                                >
                                    <option value="vs">Light</option>
                                    <option value="vs-dark">Dark</option>
                                    <option value="hc-black">High Contrast</option>
                                </select>
                            </label>
                        </div>
                        <div className="settings-group">
                            <label className="checkbox-label">
                                <input 
                                    type="checkbox" 
                                    checked={data.settings.autoResolve}
                                    onChange={(e) => {
                                        const newSettings = { 
                                            ...data.settings, 
                                            autoResolve: e.target.checked 
                                        };
                                        setData(prev => ({ ...prev, settings: newSettings }));
                                        vscode.postMessage({
                                            type: 'updateSettings',
                                            payload: newSettings
                                        });
                                    }}
                                />
                                Auto-resolve simple conflicts
                            </label>
                        </div>
                        <div className="settings-group">
                            <label className="checkbox-label">
                                <input 
                                    type="checkbox" 
                                    checked={data.settings.showLineNumbers}
                                    onChange={(e) => {
                                        const newSettings = { 
                                            ...data.settings, 
                                            showLineNumbers: e.target.checked 
                                        };
                                        setData(prev => ({ ...prev, settings: newSettings }));
                                        vscode.postMessage({
                                            type: 'updateSettings',
                                            payload: newSettings
                                        });
                                    }}
                                />
                                Show line numbers in diffs
                            </label>
                        </div>
                        <div className="settings-group">
                            <label>
                                Diff View Mode
                                <select 
                                    value={data.settings.diffViewMode}
                                    onChange={(e) => {
                                        const newSettings = { 
                                            ...data.settings, 
                                            diffViewMode: e.target.value 
                                        };
                                        setData(prev => ({ ...prev, settings: newSettings }));
                                        vscode.postMessage({
                                            type: 'updateSettings',
                                            payload: newSettings
                                        });
                                    }}
                                >
                                    <option value="inline">Inline</option>
                                    <option value="split">Split</option>
                                </select>
                            </label>
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="tribe-dashboard">
            <div className="dashboard-tabs">
                <button 
                    className={`tab-button ${activeTab === 'changes' ? 'active' : ''}`}
                    onClick={() => handleTabChange('changes')}
                >
                    <GitBranch size={16} />
                    Changes
                </button>
                <button 
                    className={`tab-button ${activeTab === 'conflicts' ? 'active' : ''}`}
                    onClick={() => handleTabChange('conflicts')}
                >
                    <GitMerge size={16} />
                    Conflicts
                    {data.conflicts.length > 0 && (
                        <span className="badge">{data.conflicts.length}</span>
                    )}
                </button>
                <button 
                    className={`tab-button ${activeTab === 'annotations' ? 'active' : ''}`}
                    onClick={() => handleTabChange('annotations')}
                >
                    <MessageSquare size={16} />
                    Annotations
                    {data.annotations.length > 0 && (
                        <span className="badge">{data.annotations.length}</span>
                    )}
                </button>
                <button 
                    className={`tab-button ${activeTab === 'settings' ? 'active' : ''}`}
                    onClick={() => handleTabChange('settings')}
                >
                    <Settings size={16} />
                    Settings
                </button>
            </div>
            <div className="dashboard-content">
                {renderContent()}
            </div>
        </div>
    );
}; 