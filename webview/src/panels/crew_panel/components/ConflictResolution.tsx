import React, { useState } from 'react';
import { AlertTriangle, Check, RefreshCw, Code, GitMerge, GitBranch, FileCode, ArrowRight, Zap, X } from 'lucide-react';
import './ConflictResolution.css';
import { getVsCodeApi } from '../../../vscode';

// Initialize VS Code API
const vscode = getVsCodeApi();

interface ConflictResolutionProps {
    isResolving: boolean;
    conflicts: Array<{
        id: string;
        type: 'merge' | 'dependency' | 'logic' | 'other';
        description: string;
        status: 'pending' | 'resolving' | 'resolved' | 'failed';
        files: string[];
        agentId?: string;
        agentName?: string;
        conflictDetails?: {
            ours: string;
            theirs: string;
            base?: string;
            resolution?: string;
            filePath?: string;
            startLine?: number;
            endLine?: number;
        };
    }>;
    onResolveConflict?: (conflictId: string, resolution: string) => void;
    onRequestAIResolution?: (conflictId: string) => void;
    onViewInEditor?: (filePath: string, lineNumber?: number) => void;
}

export const ConflictResolution: React.FC<ConflictResolutionProps> = ({
    isResolving,
    conflicts,
    onResolveConflict,
    onRequestAIResolution,
    onViewInEditor
}) => {
    const [expandedConflict, setExpandedConflict] = useState<string | null>(null);
    const [customResolutions, setCustomResolutions] = useState<Record<string, string>>({});
    const [resolvingConflictId, setResolvingConflictId] = useState<string | null>(null);

    if (!isResolving && conflicts.length === 0) {
        return null;
    }

    const pendingCount = conflicts.filter(c => c.status === 'pending').length;
    const resolvingCount = conflicts.filter(c => c.status === 'resolving').length;
    const resolvedCount = conflicts.filter(c => c.status === 'resolved').length;
    const failedCount = conflicts.filter(c => c.status === 'failed').length;
    
    const totalCount = conflicts.length;
    const progress = totalCount > 0 ? Math.round((resolvedCount / totalCount) * 100) : 0;
    
    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'pending':
                return <AlertTriangle size={16} className="status-icon pending" />;
            case 'resolving':
                return <RefreshCw size={16} className="status-icon resolving" />;
            case 'resolved':
                return <Check size={16} className="status-icon resolved" />;
            case 'failed':
                return <AlertTriangle size={16} className="status-icon failed" />;
            default:
                return null;
        }
    };
    
    const getStatusText = (status: string) => {
        switch (status) {
            case 'pending':
                return 'Pending';
            case 'resolving':
                return 'Resolving';
            case 'resolved':
                return 'Resolved';
            case 'failed':
                return 'Failed';
            default:
                return '';
        }
    };
    
    const getConflictTypeIcon = (type: string) => {
        switch (type) {
            case 'merge':
                return <GitMerge size={16} />;
            case 'dependency':
                return <GitBranch size={16} />;
            case 'logic':
                return <Code size={16} />;
            case 'other':
            default:
                return <AlertTriangle size={16} />;
        }
    };
    
    const getConflictTypeLabel = (type: string) => {
        switch (type) {
            case 'merge':
                return 'Merge Conflict';
            case 'dependency':
                return 'Dependency Conflict';
            case 'logic':
                return 'Logic Conflict';
            case 'other':
            default:
                return 'Other Conflict';
        }
    };

    const toggleExpand = (conflictId: string) => {
        setExpandedConflict(expandedConflict === conflictId ? null : conflictId);
    };

    const handleCustomResolutionChange = (conflictId: string, value: string) => {
        setCustomResolutions({
            ...customResolutions,
            [conflictId]: value
        });
    };

    const handleResolveConflict = (conflictId: string) => {
        if (customResolutions[conflictId]) {
            setResolvingConflictId(conflictId);
            
            if (onResolveConflict) {
                onResolveConflict(conflictId, customResolutions[conflictId]);
            } else {
                // Default implementation using VS Code API
                vscode.postMessage({
                    type: 'resolveConflict',
                    payload: { 
                        conflictId, 
                        resolution: customResolutions[conflictId] 
                    }
                });
            }
        }
    };

    const handleRequestAIResolution = (conflictId: string) => {
        if (onRequestAIResolution) {
            onRequestAIResolution(conflictId);
        } else {
            // Default implementation using VS Code API
            vscode.postMessage({
                type: 'requestAIResolution',
                payload: { conflictId }
            });
        }
    };

    const handleViewInEditor = (filePath: string, lineNumber?: number) => {
        if (onViewInEditor) {
            onViewInEditor(filePath, lineNumber);
        } else {
            // Default implementation using VS Code API
            vscode.postMessage({
                type: 'viewFile',
                payload: { filePath, lineNumber }
            });
        }
    };

    const renderConflictDetails = (conflict: any) => {
        if (!conflict.conflictDetails) return null;
        
        const { ours, theirs, base, resolution, filePath, startLine, endLine } = conflict.conflictDetails;
        
        return (
            <div className="conflict-details">
                <div className="conflict-code-section">
                    <div className="code-header">
                        <span>Current Version</span>
                        {filePath && (
                            <button 
                                className="view-in-editor-button"
                                onClick={() => handleViewInEditor(filePath, startLine)}
                                title="View in editor"
                            >
                                <FileCode size={14} />
                            </button>
                        )}
                    </div>
                    <pre className="code-block">{ours}</pre>
                </div>
                
                <div className="conflict-code-section">
                    <div className="code-header">
                        <span>Incoming Changes</span>
                    </div>
                    <pre className="code-block">{theirs}</pre>
                </div>
                
                {base && (
                    <div className="conflict-code-section">
                        <div className="code-header">
                            <span>Base Version</span>
                        </div>
                        <pre className="code-block">{base}</pre>
                    </div>
                )}
                
                <div className="conflict-resolution-section">
                    <div className="code-header">
                        <span>Resolution</span>
                    </div>
                    <textarea 
                        className="resolution-editor"
                        value={customResolutions[conflict.id] || resolution || ''}
                        onChange={(e) => handleCustomResolutionChange(conflict.id, e.target.value)}
                        placeholder="Enter your resolution here..."
                    />
                    
                    <div className="resolution-actions">
                        <button 
                            className="resolution-button apply"
                            onClick={() => handleResolveConflict(conflict.id)}
                            disabled={!customResolutions[conflict.id] || resolvingConflictId === conflict.id}
                        >
                            {resolvingConflictId === conflict.id ? (
                                <RefreshCw size={14} className="spin" />
                            ) : (
                                <Check size={14} />
                            )}
                            {resolvingConflictId === conflict.id ? 'Applying...' : 'Apply Resolution'}
                        </button>
                        
                        <button 
                            className="resolution-button ai-resolve"
                            onClick={() => handleRequestAIResolution(conflict.id)}
                            disabled={resolvingConflictId === conflict.id}
                        >
                            <Zap size={14} />
                            AI Resolve
                        </button>
                        
                        {filePath && (
                            <button 
                                className="resolution-button view-in-editor"
                                onClick={() => handleViewInEditor(filePath, startLine)}
                            >
                                <FileCode size={14} />
                                View in Editor
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="conflict-resolution">
            <div className="conflict-header">
                <h3>
                    <RefreshCw size={18} className={isResolving ? 'spin' : ''} />
                    Resolving Conflicts
                </h3>
                <div className="conflict-stats">
                    <div className="progress-bar">
                        <div 
                            className="progress-fill" 
                            style={{ width: `${progress}%` }}
                        ></div>
                    </div>
                    <div className="progress-text">
                        {resolvedCount} of {totalCount} conflicts resolved ({progress}%)
                    </div>
                </div>
            </div>
            
            {conflicts.length > 0 && (
                <div className="conflicts-list">
                    {conflicts.map(conflict => (
                        <div 
                            key={conflict.id} 
                            className={`conflict-item ${conflict.status} ${expandedConflict === conflict.id ? 'expanded' : ''}`}
                        >
                            <div 
                                className="conflict-item-header"
                                onClick={() => toggleExpand(conflict.id)}
                            >
                                {getStatusIcon(conflict.status)}
                                <div className="conflict-type">
                                    {getConflictTypeIcon(conflict.type)}
                                    {getConflictTypeLabel(conflict.type)}
                                </div>
                                <div className="conflict-status">
                                    {getStatusText(conflict.status)}
                                </div>
                                <div className="expand-icon">
                                    {expandedConflict === conflict.id ? 
                                        <X size={16} /> : 
                                        <ArrowRight size={16} />
                                    }
                                </div>
                            </div>
                            
                            <div className="conflict-description">
                                {conflict.description}
                            </div>
                            
                            {conflict.files.length > 0 && (
                                <div className="conflict-files">
                                    <span className="files-label">Files:</span>
                                    <div className="files-list">
                                        {conflict.files.map((file: string, index: number) => (
                                            <div key={index} className="file-item">
                                                <span className="file-path">{file}</span>
                                                <button 
                                                    className="view-file-button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleViewInEditor(file);
                                                    }}
                                                >
                                                    <FileCode size={14} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            
                            {conflict.agentName && (
                                <div className="conflict-agent">
                                    <span className="agent-label">Resolving agent:</span>
                                    <span className="agent-name">{conflict.agentName}</span>
                                </div>
                            )}
                            
                            {expandedConflict === conflict.id && renderConflictDetails(conflict)}
                        </div>
                    ))}
                </div>
            )}
            
            {isResolving && conflicts.length === 0 && (
                <div className="resolving-message">
                    <RefreshCw size={24} className="spin" />
                    <p>Agents are analyzing and resolving conflicts...</p>
                </div>
            )}
        </div>
    );
}; 