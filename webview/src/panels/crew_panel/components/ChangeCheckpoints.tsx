import React, { useState } from 'react';
import { History, RotateCcw, Clock, Calendar, FileText, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import './ChangeCheckpoints.css';

interface Checkpoint {
    id: string;
    timestamp: string;
    description: string;
    changes: {
        filesModified: number;
        filesCreated: number;
        filesDeleted: number;
    };
    metadata: {
        agentId?: string;
        agentName?: string;
        taskId?: string;
        taskName?: string;
        tags?: string[];
    };
}

interface ChangeCheckpointsProps {
    checkpoints: Checkpoint[];
    onRestoreCheckpoint: (checkpointId: string) => void;
    onDeleteCheckpoint: (checkpointId: string) => void;
    onViewCheckpointDiff: (checkpointId: string) => void;
}

export const ChangeCheckpoints: React.FC<ChangeCheckpointsProps> = ({
    checkpoints,
    onRestoreCheckpoint,
    onDeleteCheckpoint,
    onViewCheckpointDiff
}) => {
    const [expandedCheckpoints, setExpandedCheckpoints] = useState<Set<string>>(new Set());
    
    const toggleCheckpoint = (id: string) => {
        const newExpanded = new Set(expandedCheckpoints);
        if (newExpanded.has(id)) {
            newExpanded.delete(id);
        } else {
            newExpanded.add(id);
        }
        setExpandedCheckpoints(newExpanded);
    };
    
    const formatTimestamp = (timestamp: string) => {
        const date = new Date(timestamp);
        return date.toLocaleString();
    };
    
    const formatRelativeTime = (timestamp: string) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffSec = Math.floor(diffMs / 1000);
        const diffMin = Math.floor(diffSec / 60);
        const diffHour = Math.floor(diffMin / 60);
        const diffDay = Math.floor(diffHour / 24);
        
        if (diffDay > 0) {
            return `${diffDay} ${diffDay === 1 ? 'day' : 'days'} ago`;
        } else if (diffHour > 0) {
            return `${diffHour} ${diffHour === 1 ? 'hour' : 'hours'} ago`;
        } else if (diffMin > 0) {
            return `${diffMin} ${diffMin === 1 ? 'minute' : 'minutes'} ago`;
        } else {
            return 'Just now';
        }
    };

    if (checkpoints.length === 0) {
        return (
            <div className="change-checkpoints empty">
                <div className="empty-state">
                    <History size={32} />
                    <h3>No Checkpoints Available</h3>
                    <p>Checkpoints will be created automatically when changes are applied.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="change-checkpoints">
            <div className="checkpoints-header">
                <h3>
                    <History size={18} />
                    Change History
                </h3>
                <p className="checkpoints-description">
                    Checkpoints are automatically created when changes are applied. You can restore your project to any previous checkpoint.
                </p>
            </div>
            
            <div className="checkpoints-list">
                {checkpoints.map(checkpoint => (
                    <div 
                        key={checkpoint.id} 
                        className="checkpoint-item"
                    >
                        <div 
                            className="checkpoint-header"
                            onClick={() => toggleCheckpoint(checkpoint.id)}
                        >
                            {expandedCheckpoints.has(checkpoint.id) ? 
                                <ChevronDown size={16} /> : 
                                <ChevronRight size={16} />
                            }
                            <div className="checkpoint-title">
                                <span className="checkpoint-description">{checkpoint.description}</span>
                                <span className="checkpoint-time">{formatRelativeTime(checkpoint.timestamp)}</span>
                            </div>
                        </div>
                        
                        {expandedCheckpoints.has(checkpoint.id) && (
                            <div className="checkpoint-details">
                                <div className="checkpoint-metadata">
                                    <div className="metadata-item">
                                        <Calendar size={14} />
                                        <span>{formatTimestamp(checkpoint.timestamp)}</span>
                                    </div>
                                    
                                    {checkpoint.metadata.agentName && (
                                        <div className="metadata-item">
                                            <Clock size={14} />
                                            <span>Created by: {checkpoint.metadata.agentName}</span>
                                        </div>
                                    )}
                                    
                                    {checkpoint.metadata.taskName && (
                                        <div className="metadata-item">
                                            <FileText size={14} />
                                            <span>Task: {checkpoint.metadata.taskName}</span>
                                        </div>
                                    )}
                                </div>
                                
                                <div className="checkpoint-changes">
                                    <div className="changes-summary">
                                        <div className="change-count modified">
                                            <span className="count">{checkpoint.changes.filesModified}</span>
                                            <span className="label">Modified</span>
                                        </div>
                                        <div className="change-count created">
                                            <span className="count">{checkpoint.changes.filesCreated}</span>
                                            <span className="label">Created</span>
                                        </div>
                                        <div className="change-count deleted">
                                            <span className="count">{checkpoint.changes.filesDeleted}</span>
                                            <span className="label">Deleted</span>
                                        </div>
                                    </div>
                                </div>
                                
                                {checkpoint.metadata.tags && checkpoint.metadata.tags.length > 0 && (
                                    <div className="checkpoint-tags">
                                        {checkpoint.metadata.tags.map((tag, index) => (
                                            <span key={index} className="tag">{tag}</span>
                                        ))}
                                    </div>
                                )}
                                
                                <div className="checkpoint-actions">
                                    <button 
                                        className="action-button view-button"
                                        onClick={() => onViewCheckpointDiff(checkpoint.id)}
                                    >
                                        <FileText size={14} />
                                        View Changes
                                    </button>
                                    <button 
                                        className="action-button restore-button"
                                        onClick={() => onRestoreCheckpoint(checkpoint.id)}
                                    >
                                        <RotateCcw size={14} />
                                        Restore
                                    </button>
                                    <button 
                                        className="action-button delete-button"
                                        onClick={() => onDeleteCheckpoint(checkpoint.id)}
                                    >
                                        <Trash2 size={14} />
                                        Delete
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}; 