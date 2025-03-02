import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, Check, X, MessageSquare, Code, Info, Edit, ArrowRight, AlertTriangle, ExternalLink } from 'lucide-react';
import { AlternativeImplementations } from '../AlternativeImplementations';
import { ConflictResolution } from '../ConflictResolution';
import { CollaborativeAnnotations } from '../CollaborativeAnnotations';
import './styles.css';
import { getVsCodeApi } from '../../../../vscode';

// Initialize VS Code API
const vscode = getVsCodeApi();

interface FileChange {
    path: string;
    content: string;
    originalContent?: string;
    explanation?: string;
    hunks?: Array<{
        startLine: number;
        endLine: number;
        content: string;
        originalContent?: string;
    }>;
}

interface ChangeGroup {
    id: string;
    title: string;
    description: string;
    agentId: string;
    agentName: string;
    timestamp: string;
    files: {
        modify: FileChange[];
        create: FileChange[];
        delete: string[];
    };
}

interface Implementation {
    id: string;
    title: string;
    description: string;
    tradeoffs: {
        pros: string[];
        cons: string[];
    };
    files: {
        modify: Array<{ path: string; content: string; originalContent?: string }>;
        create: Array<{ path: string; content: string }>;
        delete: string[];
    };
}

interface Conflict {
    id: string;
    type: 'merge' | 'dependency' | 'logic' | 'other';
    description: string;
    status: 'pending' | 'resolving' | 'resolved' | 'failed';
    files: string[];
    agentId?: string;
    agentName?: string;
}

interface Annotation {
    id: string;
    content: string;
    author: {
        id: string;
        name: string;
        type: 'human' | 'agent';
    };
    timestamp: string;
    filePath?: string;
    lineStart?: number;
    lineEnd?: number;
    codeSnippet?: string;
    replies: Annotation[];
}

interface DiffNavigationPortalProps {
    changeGroups: ChangeGroup[];
    alternativeImplementations?: Implementation[];
    conflicts?: Conflict[];
    annotations?: Annotation[];
    currentUser?: {
        id: string;
        name: string;
    };
    agents?: Array<{
        id: string;
        name: string;
    }>;
    isResolvingConflicts?: boolean;
    onAcceptGroup: (groupId: string) => void;
    onRejectGroup: (groupId: string) => void;
    onAcceptFile: (groupId: string, filePath: string, type: 'modify' | 'create' | 'delete') => void;
    onRejectFile: (groupId: string, filePath: string, type: 'modify' | 'create' | 'delete') => void;
    onModifyChange: (groupId: string, filePath: string, newContent: string) => void;
    onRequestExplanation: (groupId: string, filePath: string) => void;
    onSelectImplementation?: (implementationId: string) => void;
    onDismissImplementations?: () => void;
    onAddAnnotation?: (annotation: Omit<Annotation, 'id' | 'timestamp' | 'replies'>) => void;
    onEditAnnotation?: (id: string, content: string) => void;
    onDeleteAnnotation?: (id: string) => void;
    onReplyToAnnotation?: (parentId: string, reply: Omit<Annotation, 'id' | 'timestamp' | 'replies'>) => void;
    onViewInEditor?: (filePath: string, lineNumber?: number) => void;
}

export const DiffNavigationPortal: React.FC<DiffNavigationPortalProps> = ({
    changeGroups,
    alternativeImplementations = [],
    conflicts = [],
    annotations = [],
    currentUser,
    agents = [],
    isResolvingConflicts = false,
    onAcceptGroup,
    onRejectGroup,
    onAcceptFile,
    onRejectFile,
    onModifyChange,
    onRequestExplanation,
    onSelectImplementation,
    onDismissImplementations,
    onAddAnnotation,
    onEditAnnotation,
    onDeleteAnnotation,
    onReplyToAnnotation,
    onViewInEditor,
}) => {
    const [activeGroupIndex, setActiveGroupIndex] = useState(0);
    const [activeFileIndex, setActiveFileIndex] = useState(0);
    const [activeFileType, setActiveFileType] = useState<'modify' | 'create' | 'delete'>('modify');
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
    const [editMode, setEditMode] = useState(false);
    const [editContent, setEditContent] = useState('');
    const [showExplanation, setShowExplanation] = useState(false);
    const [activeTab, setActiveTab] = useState<'changes' | 'alternatives' | 'annotations'>('changes');
    
    const hasAlternatives = alternativeImplementations.length > 0;
    const hasConflicts = isResolvingConflicts || conflicts.length > 0;
    const hasAnnotations = annotations.length > 0 || (currentUser && agents.length > 0);

    const activeGroup = changeGroups[activeGroupIndex] || null;
    
    // Calculate all files across all types for the active group
    const allFiles = activeGroup ? [
        ...activeGroup.files.modify.map(f => ({ ...f, type: 'modify' as const })),
        ...activeGroup.files.create.map(f => ({ ...f, type: 'create' as const })),
        ...activeGroup.files.delete.map(path => ({ path, type: 'delete' as const }))
    ] : [];
    
    const activeFile = allFiles[activeFileIndex] || null;

    useEffect(() => {
        // Reset active file index when changing groups
        setActiveFileIndex(0);
        // Default to the first available file type
        if (activeGroup) {
            if (activeGroup.files.modify.length > 0) {
                setActiveFileType('modify');
            } else if (activeGroup.files.create.length > 0) {
                setActiveFileType('create');
            } else if (activeGroup.files.delete.length > 0) {
                setActiveFileType('delete');
            }
        }
    }, [activeGroupIndex, activeGroup]);

    useEffect(() => {
        // Initialize edit content when entering edit mode
        if (editMode && activeFile && (activeFile.type === 'modify' || activeFile.type === 'create')) {
            setEditContent(activeFile.content);
        }
    }, [editMode, activeFile]);

    const toggleGroupExpanded = (groupId: string) => {
        const newExpanded = new Set(expandedGroups);
        if (newExpanded.has(groupId)) {
            newExpanded.delete(groupId);
        } else {
            newExpanded.add(groupId);
        }
        setExpandedGroups(newExpanded);
    };

    const navigateToPreviousGroup = () => {
        if (activeGroupIndex > 0) {
            setActiveGroupIndex(activeGroupIndex - 1);
        }
    };

    const navigateToNextGroup = () => {
        if (activeGroupIndex < changeGroups.length - 1) {
            setActiveGroupIndex(activeGroupIndex + 1);
        }
    };

    const navigateToPreviousFile = () => {
        if (activeFileIndex > 0) {
            setActiveFileIndex(activeFileIndex - 1);
        }
    };

    const navigateToNextFile = () => {
        if (activeFileIndex < allFiles.length - 1) {
            setActiveFileIndex(activeFileIndex + 1);
        }
    };

    const handleSaveEdit = () => {
        if (activeGroup && activeFile && (activeFile.type === 'modify' || activeFile.type === 'create')) {
            onModifyChange(activeGroup.id, activeFile.path, editContent);
            setEditMode(false);
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

    const renderDiffContent = () => {
        if (!activeFile) return <div className="empty-state">No file selected</div>;

        if (activeFile.type === 'delete') {
            return (
                <div className="diff-content delete-file">
                    <div className="file-path">
                        {activeFile.path}
                        <button 
                            className="view-in-editor-button"
                            onClick={() => handleViewInEditor(activeFile.path)}
                            title="Open in editor"
                        >
                            <ExternalLink size={14} />
                        </button>
                    </div>
                    <div className="delete-message">This file will be deleted</div>
                </div>
            );
        }

        const fileChange = activeFile as FileChange & { type: 'modify' | 'create' };
        
        if (editMode) {
            return (
                <div className="diff-content edit-mode">
                    <div className="file-path">{fileChange.path}</div>
                    <textarea 
                        className="edit-textarea"
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                    />
                    <div className="edit-actions">
                        <button onClick={handleSaveEdit} className="save-button">
                            <Check size={16} />
                            Save Changes
                        </button>
                        <button onClick={() => setEditMode(false)} className="cancel-button">
                            <X size={16} />
                            Cancel
                        </button>
                    </div>
                </div>
            );
        }

        if (showExplanation && fileChange.explanation) {
            return (
                <div className="diff-content explanation-mode">
                    <div className="file-path">{fileChange.path}</div>
                    <div className="explanation-content">
                        <h4>Explanation</h4>
                        <p>{fileChange.explanation || "No explanation provided for this change."}</p>
                    </div>
                    <button onClick={() => setShowExplanation(false)} className="back-button">
                        <ArrowRight size={16} />
                        Back to Code
                    </button>
                </div>
            );
        }

        // If we have hunks, show them with original content
        if (fileChange.hunks && fileChange.hunks.length > 0) {
            return (
                <div className="diff-content">
                    <div className="file-path">{fileChange.path}</div>
                    <div className="diff-hunks">
                        {fileChange.hunks.map((hunk, index) => (
                            <div key={index} className="diff-hunk">
                                <div className="hunk-header">
                                    Lines {hunk.startLine}-{hunk.endLine}
                                </div>
                                <div className="hunk-content">
                                    {hunk.originalContent && (
                                        <div className="original-content">
                                            <pre>{hunk.originalContent}</pre>
                                        </div>
                                    )}
                                    <div className="new-content">
                                        <pre>{hunk.content}</pre>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            );
        }

        // Otherwise show the full file content
        return (
            <div className="diff-content">
                <div className="file-path">
                    {fileChange.path}
                    <button 
                        className="view-in-editor-button"
                        onClick={() => handleViewInEditor(fileChange.path)}
                        title="Open in editor"
                    >
                        <ExternalLink size={14} />
                    </button>
                </div>
                {fileChange.originalContent && fileChange.type === 'modify' ? (
                    <div className="side-by-side">
                        <div className="original-content">
                            <h5>Original</h5>
                            <pre>{fileChange.originalContent}</pre>
                        </div>
                        <div className="new-content">
                            <h5>Modified</h5>
                            <pre>{fileChange.content}</pre>
                        </div>
                    </div>
                ) : (
                    <div className="new-content">
                        <pre>{fileChange.content}</pre>
                    </div>
                )}
            </div>
        );
    };

    const renderSidebar = () => {
        return (
            <div className="diff-sidebar">
                {hasConflicts && (
                    <div className="conflict-indicator">
                        <AlertTriangle size={16} />
                        <span>Resolving conflicts...</span>
                    </div>
                )}
                
                {(hasAlternatives || hasAnnotations) && (
                    <div className="sidebar-tabs">
                        <button 
                            className={`sidebar-tab ${activeTab === 'changes' ? 'active' : ''}`}
                            onClick={() => setActiveTab('changes')}
                        >
                            Changes
                        </button>
                        {hasAlternatives && (
                            <button 
                                className={`sidebar-tab ${activeTab === 'alternatives' ? 'active' : ''}`}
                                onClick={() => setActiveTab('alternatives')}
                            >
                                Alternatives
                            </button>
                        )}
                        {hasAnnotations && (
                            <button 
                                className={`sidebar-tab ${activeTab === 'annotations' ? 'active' : ''}`}
                                onClick={() => setActiveTab('annotations')}
                            >
                                Annotations
                            </button>
                        )}
                    </div>
                )}
                
                {activeTab === 'changes' && (
                    <div className="groups-list">
                        <h3>Change Groups</h3>
                        {changeGroups.map((group, index) => (
                            <div 
                                key={group.id} 
                                className={`group-item ${index === activeGroupIndex ? 'active' : ''}`}
                                onClick={() => setActiveGroupIndex(index)}
                            >
                                <div 
                                    className="group-header"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        toggleGroupExpanded(group.id);
                                    }}
                                >
                                    {expandedGroups.has(group.id) ? 
                                        <ChevronDown size={16} /> : 
                                        <ChevronRight size={16} />
                                    }
                                    <span className="group-title">{group.title}</span>
                                    <span className="file-count">
                                        {group.files.modify.length + group.files.create.length + group.files.delete.length} files
                                    </span>
                                </div>
                                
                                {expandedGroups.has(group.id) && (
                                    <div className="group-files">
                                        {group.files.modify.length > 0 && (
                                            <div className="file-type-group">
                                                <div className="file-type-header">Modified</div>
                                                {group.files.modify.map((file, fileIndex) => (
                                                    <div 
                                                        key={file.path}
                                                        className={`file-item ${
                                                            index === activeGroupIndex && 
                                                            activeFileType === 'modify' && 
                                                            fileIndex === activeFileIndex ? 'active' : ''
                                                        }`}
                                                        onClick={() => {
                                                            setActiveGroupIndex(index);
                                                            setActiveFileType('modify');
                                                            setActiveFileIndex(fileIndex);
                                                        }}
                                                    >
                                                        {file.path.split('/').pop()}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        
                                        {group.files.create.length > 0 && (
                                            <div className="file-type-group">
                                                <div className="file-type-header">Created</div>
                                                {group.files.create.map((file, fileIndex) => (
                                                    <div 
                                                        key={file.path}
                                                        className={`file-item ${
                                                            index === activeGroupIndex && 
                                                            activeFileType === 'create' && 
                                                            fileIndex === activeFileIndex ? 'active' : ''
                                                        }`}
                                                        onClick={() => {
                                                            setActiveGroupIndex(index);
                                                            setActiveFileType('create');
                                                            setActiveFileIndex(fileIndex);
                                                        }}
                                                    >
                                                        {file.path.split('/').pop()}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        
                                        {group.files.delete.length > 0 && (
                                            <div className="file-type-group">
                                                <div className="file-type-header">Deleted</div>
                                                {group.files.delete.map((path, fileIndex) => (
                                                    <div 
                                                        key={path}
                                                        className={`file-item ${
                                                            index === activeGroupIndex && 
                                                            activeFileType === 'delete' && 
                                                            fileIndex === activeFileIndex ? 'active' : ''
                                                        }`}
                                                        onClick={() => {
                                                            setActiveGroupIndex(index);
                                                            setActiveFileType('delete');
                                                            setActiveFileIndex(fileIndex);
                                                        }}
                                                    >
                                                        {path.split('/').pop()}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    if (changeGroups.length === 0 && !hasAlternatives && !hasConflicts && !hasAnnotations) {
        return (
            <div className="diff-navigation-portal empty">
                <div className="empty-state">
                    <h3>No Changes Pending</h3>
                    <p>There are currently no proposed changes to review.</p>
                </div>
            </div>
        );
    }

    // If we have conflicts, show the conflict resolution UI
    if (hasConflicts && activeTab === 'changes') {
        return (
            <div className="diff-navigation-portal">
                {renderSidebar()}
                <div className="diff-main-content">
                    <ConflictResolution 
                        isResolving={isResolvingConflicts}
                        conflicts={conflicts}
                    />
                </div>
            </div>
        );
    }

    // If we have alternative implementations and that tab is active, show them
    if (hasAlternatives && activeTab === 'alternatives' && onSelectImplementation && onDismissImplementations) {
        return (
            <div className="diff-navigation-portal">
                {renderSidebar()}
                <div className="diff-main-content">
                    <AlternativeImplementations 
                        implementations={alternativeImplementations}
                        onSelect={onSelectImplementation}
                        onDismiss={onDismissImplementations}
                    />
                </div>
            </div>
        );
    }

    // If we have annotations and that tab is active, show them
    if (hasAnnotations && activeTab === 'annotations' && currentUser && 
        onAddAnnotation && onEditAnnotation && onDeleteAnnotation && onReplyToAnnotation) {
        return (
            <div className="diff-navigation-portal">
                {renderSidebar()}
                <div className="diff-main-content">
                    <CollaborativeAnnotations 
                        annotations={annotations}
                        currentUser={currentUser}
                        agents={agents}
                        onAddAnnotation={onAddAnnotation}
                        onEditAnnotation={onEditAnnotation}
                        onDeleteAnnotation={onDeleteAnnotation}
                        onReplyToAnnotation={onReplyToAnnotation}
                    />
                </div>
            </div>
        );
    }

    // Default view - show changes
    return (
        <div className="diff-navigation-portal">
            {renderSidebar()}
            
            <div className="diff-main-content">
                {activeGroup && (
                    <div className="diff-header">
                        <div className="group-info">
                            <h3>{activeGroup.title}</h3>
                            <div className="group-meta">
                                <span className="agent-name">Proposed by: {activeGroup.agentName}</span>
                                <span className="timestamp">at {new Date(activeGroup.timestamp).toLocaleString()}</span>
                            </div>
                            <p className="group-description">{activeGroup.description}</p>
                        </div>
                        
                        <div className="group-actions">
                            <button 
                                className="accept-group-button"
                                onClick={() => onAcceptGroup(activeGroup.id)}
                            >
                                <Check size={16} />
                                Accept All
                            </button>
                            <button 
                                className="reject-group-button"
                                onClick={() => onRejectGroup(activeGroup.id)}
                            >
                                <X size={16} />
                                Reject All
                            </button>
                        </div>
                    </div>
                )}
                
                {activeFile && (
                    <div className="file-navigation">
                        <div className="navigation-controls">
                            <button 
                                onClick={navigateToPreviousFile}
                                disabled={activeFileIndex === 0}
                                className="nav-button"
                            >
                                <ChevronLeft size={16} />
                                Previous File
                            </button>
                            <span className="file-counter">
                                File {activeFileIndex + 1} of {allFiles.length}
                            </span>
                            <button 
                                onClick={navigateToNextFile}
                                disabled={activeFileIndex === allFiles.length - 1}
                                className="nav-button"
                            >
                                Next File
                                <ChevronRight size={16} />
                            </button>
                        </div>
                        
                        <div className="file-actions">
                            {(activeFile.type === 'modify' || activeFile.type === 'create') && (
                                <>
                                    <button 
                                        onClick={() => setEditMode(true)}
                                        className="edit-button"
                                        disabled={editMode}
                                    >
                                        <Edit size={16} />
                                        Edit
                                    </button>
                                    <button 
                                        onClick={() => {
                                            setShowExplanation(true);
                                            if (!activeFile.explanation) {
                                                onRequestExplanation(activeGroup!.id, activeFile.path);
                                            }
                                        }}
                                        className="explanation-button"
                                        disabled={showExplanation}
                                    >
                                        <Info size={16} />
                                        Explanation
                                    </button>
                                    {hasAnnotations && (
                                        <button 
                                            onClick={() => setActiveTab('annotations')}
                                            className="annotations-button"
                                        >
                                            <MessageSquare size={16} />
                                            Annotations
                                        </button>
                                    )}
                                </>
                            )}
                            <button 
                                onClick={() => onAcceptFile(
                                    activeGroup!.id, 
                                    activeFile.path, 
                                    activeFile.type
                                )}
                                className="accept-file-button"
                            >
                                <Check size={16} />
                                Accept
                            </button>
                            <button 
                                onClick={() => onRejectFile(
                                    activeGroup!.id, 
                                    activeFile.path, 
                                    activeFile.type
                                )}
                                className="reject-file-button"
                            >
                                <X size={16} />
                                Reject
                            </button>
                        </div>
                    </div>
                )}
                
                {renderDiffContent()}
                
                {activeGroup && (
                    <div className="group-navigation">
                        <button 
                            onClick={navigateToPreviousGroup}
                            disabled={activeGroupIndex === 0}
                            className="nav-button"
                        >
                            <ChevronLeft size={16} />
                            Previous Change Group
                        </button>
                        <span className="group-counter">
                            Group {activeGroupIndex + 1} of {changeGroups.length}
                        </span>
                        <button 
                            onClick={navigateToNextGroup}
                            disabled={activeGroupIndex === changeGroups.length - 1}
                            className="nav-button"
                        >
                            Next Change Group
                            <ChevronRight size={16} />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};