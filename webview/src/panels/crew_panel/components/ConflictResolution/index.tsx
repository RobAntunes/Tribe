import React, { useState } from 'react';
import { AlertTriangle, CheckCircle, X, ArrowRight, GitMerge, GitBranch, Clock, RefreshCw } from 'lucide-react';
import './styles.css';

interface Conflict {
  id: string;
  type: 'merge' | 'dependency' | 'logic' | 'other';
  description: string;
  status: 'pending' | 'resolving' | 'resolved' | 'failed';
  files: string[];
  agentId?: string;
  agentName?: string;
}

interface ConflictResolutionProps {
  conflicts: Conflict[];
  isResolving: boolean;
  onResolveManually?: (conflictId: string) => void;
  onResolveAutomatically?: (conflictId: string) => void;
  onDismissConflict?: (conflictId: string) => void;
  onResolveConflict?: (conflictId: string, resolution: string) => void;
  onRequestAIResolution?: (conflictId: string) => void;
  onViewInEditor?: (filePath: string, lineNumber?: number) => void;
}

export const ConflictResolution: React.FC<ConflictResolutionProps> = ({
  conflicts,
  isResolving,
  onResolveManually,
  onResolveAutomatically,
  onDismissConflict,
  onResolveConflict,
  onRequestAIResolution,
  onViewInEditor
}) => {
  const [selectedConflict, setSelectedConflict] = useState<string | null>(
    conflicts.length > 0 ? conflicts[0].id : null
  );

  const getConflictIcon = (type: Conflict['type']) => {
    switch (type) {
      case 'merge':
        return <GitMerge size={18} />;
      case 'dependency':
        return <GitBranch size={18} />;
      case 'logic':
        return <AlertTriangle size={18} />;
      default:
        return <AlertTriangle size={18} />;
    }
  };

  const getStatusIcon = (status: Conflict['status']) => {
    switch (status) {
      case 'pending':
        return <Clock size={16} />;
      case 'resolving':
        return <RefreshCw size={16} className="animate-spin" />;
      case 'resolved':
        return <CheckCircle size={16} />;
      case 'failed':
        return <X size={16} />;
      default:
        return <Clock size={16} />;
    }
  };

  const getStatusClass = (status: Conflict['status']) => {
    switch (status) {
      case 'pending':
        return 'status-pending';
      case 'resolving':
        return 'status-resolving';
      case 'resolved':
        return 'status-resolved';
      case 'failed':
        return 'status-failed';
      default:
        return '';
    }
  };

  if (conflicts.length === 0 && !isResolving) {
    return (
      <div className="conflict-resolution empty-state">
        <CheckCircle size={48} className="text-green-500" />
        <h3>No Conflicts</h3>
        <p>There are currently no conflicts that need resolution.</p>
      </div>
    );
  }

  if (isResolving) {
    return (
      <div className="conflict-resolution resolving-state">
        <RefreshCw size={48} className="animate-spin text-blue-500" />
        <h3>Resolving Conflicts</h3>
        <p>The system is automatically resolving conflicts. This may take a moment...</p>
      </div>
    );
  }

  const activeConflict = conflicts.find(c => c.id === selectedConflict);

  return (
    <div className="conflict-resolution">
      <div className="conflict-list">
        <h3>Conflicts ({conflicts.length})</h3>
        {conflicts.map((conflict) => (
          <div
            key={conflict.id}
            className={`conflict-item ${selectedConflict === conflict.id ? 'selected' : ''} ${getStatusClass(conflict.status)}`}
            onClick={() => setSelectedConflict(conflict.id)}
          >
            <div className="conflict-item-icon">
              {getConflictIcon(conflict.type)}
            </div>
            <div className="conflict-item-content">
              <div className="conflict-item-title">
                {conflict.type === 'merge' ? 'Merge Conflict' : 
                 conflict.type === 'dependency' ? 'Dependency Conflict' : 
                 conflict.type === 'logic' ? 'Logic Conflict' : 'Other Conflict'}
              </div>
              <div className="conflict-item-files">
                {conflict.files.length} file{conflict.files.length !== 1 ? 's' : ''} affected
              </div>
            </div>
            <div className={`conflict-item-status ${getStatusClass(conflict.status)}`}>
              {getStatusIcon(conflict.status)}
              <span>{conflict.status}</span>
            </div>
          </div>
        ))}
      </div>

      {activeConflict && (
        <div className="conflict-details">
          <div className="conflict-header">
            <h3>
              {activeConflict.type === 'merge' ? 'Merge Conflict' : 
               activeConflict.type === 'dependency' ? 'Dependency Conflict' : 
               activeConflict.type === 'logic' ? 'Logic Conflict' : 'Other Conflict'}
            </h3>
            <div className={`conflict-status ${getStatusClass(activeConflict.status)}`}>
              {getStatusIcon(activeConflict.status)}
              <span>{activeConflict.status}</span>
            </div>
          </div>
          
          <div className="conflict-description">
            <p>{activeConflict.description}</p>
          </div>
          
          <div className="conflict-files">
            <h4>Affected Files:</h4>
            <ul>
              {activeConflict.files.map((file, index) => (
                <li key={index}>{file}</li>
              ))}
            </ul>
          </div>
          
          {activeConflict.agentName && (
            <div className="conflict-agent">
              <h4>Assigned to:</h4>
              <p>{activeConflict.agentName}</p>
            </div>
          )}
          
          <div className="conflict-actions">
            {onResolveAutomatically && activeConflict.status === 'pending' && (
              <button 
                className="resolve-auto-button"
                onClick={() => onResolveAutomatically(activeConflict.id)}
              >
                <RefreshCw size={16} />
                Resolve Automatically
              </button>
            )}
            
            {onResolveManually && activeConflict.status === 'pending' && (
              <button 
                className="resolve-manual-button"
                onClick={() => onResolveManually(activeConflict.id)}
              >
                <ArrowRight size={16} />
                Resolve Manually
              </button>
            )}
            
            {onDismissConflict && (activeConflict.status === 'resolved' || activeConflict.status === 'failed') && (
              <button 
                className="dismiss-button"
                onClick={() => onDismissConflict(activeConflict.id)}
              >
                <CheckCircle size={16} />
                Dismiss
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};