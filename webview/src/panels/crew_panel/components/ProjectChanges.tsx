import React, { useState } from 'react';
import { Check, X, ChevronDown, ChevronRight, File, Trash, Plus } from 'lucide-react';
import { DiffNavigationPortal } from './DiffNavigationPortal';

interface FileChange {
    path: string;
    content: string;
}

interface ProjectChangesProps {
    changes: {
        filesToModify: FileChange[];
        filesToCreate: FileChange[];
        filesToDelete: string[];
    };
    onAccept: () => void;
    onReject: () => void;
}

export const ProjectChanges: React.FC<ProjectChangesProps> = ({
    changes,
    onAccept,
    onReject
}) => {
    const [useEnhancedView, setUseEnhancedView] = useState(true);
    
    // Convert the changes to the format expected by DiffNavigationPortal
    const changeGroups = [{
        id: 'current-changes',
        title: 'Proposed Changes',
        description: 'Changes proposed by the agent',
        agentId: 'current-agent',
        agentName: 'Agent',
        timestamp: new Date().toISOString(),
        files: {
            modify: changes.filesToModify,
            create: changes.filesToCreate,
            delete: changes.filesToDelete
        }
    }];
    
    // If using the enhanced view, render the DiffNavigationPortal
    if (useEnhancedView) {
        return (
            <div className="project-changes enhanced">
                <div className="view-toggle">
                    <button 
                        className="toggle-button"
                        onClick={() => setUseEnhancedView(false)}
                    >
                        Switch to Simple View
                    </button>
                </div>
                
                <DiffNavigationPortal
                    changeGroups={changeGroups}
                    onAcceptGroup={() => onAccept()}
                    onRejectGroup={() => onReject()}
                    onAcceptFile={() => {}}
                    onRejectFile={() => {}}
                    onModifyChange={() => {}}
                    onRequestExplanation={() => {}}
                />
            </div>
        );
    }
    
    // Otherwise, render the original simple view
    const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());

    const toggleFile = (path: string) => {
        const newExpanded = new Set(expandedFiles);
        if (newExpanded.has(path)) {
            newExpanded.delete(path);
        } else {
            newExpanded.add(path);
        }
        setExpandedFiles(newExpanded);
    };

    const renderFileChange = (file: FileChange, type: 'modify' | 'create') => {
        const isExpanded = expandedFiles.has(file.path);
        return (
            <div key={file.path} className="file-change">
                <div 
                    className="file-header" 
                    onClick={() => toggleFile(file.path)}
                >
                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    {type === 'create' ? <Plus size={16} /> : <File size={16} />}
                    <span className="file-path">{file.path}</span>
                </div>
                {isExpanded && (
                    <div className="file-content">
                        <pre>{file.content}</pre>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="project-changes simple">
            <div className="view-toggle">
                <button 
                    className="toggle-button"
                    onClick={() => setUseEnhancedView(true)}
                >
                    Switch to Enhanced View
                </button>
            </div>
            
            <h3>Proposed Changes</h3>
            
            {changes.filesToModify.length > 0 && (
                <div className="change-section">
                    <h4>Files to Modify</h4>
                    {changes.filesToModify.map(file => renderFileChange(file, 'modify'))}
                </div>
            )}
            
            {changes.filesToCreate.length > 0 && (
                <div className="change-section">
                    <h4>Files to Create</h4>
                    {changes.filesToCreate.map(file => renderFileChange(file, 'create'))}
                </div>
            )}
            
            {changes.filesToDelete.length > 0 && (
                <div className="change-section">
                    <h4>Files to Delete</h4>
                    {changes.filesToDelete.map(path => (
                        <div key={path} className="file-delete">
                            <Trash size={16} />
                            <span className="file-path">{path}</span>
                        </div>
                    ))}
                </div>
            )}

            <div className="action-buttons">
                <button 
                    className="accept-button" 
                    onClick={onAccept}
                >
                    <Check size={16} />
                    Accept Changes
                </button>
                <button 
                    className="reject-button" 
                    onClick={onReject}
                >
                    <X size={16} />
                    Reject Changes
                </button>
            </div>
        </div>
    );
};
