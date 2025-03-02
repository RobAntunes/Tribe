import React, { useState, useEffect } from 'react';
import { 
  Users, 
  GitMerge, 
  MessageSquare, 
  GitBranch, 
  FileCode, 
  Settings, 
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Edit,
  Trash2,
  ArrowRight,
  Eye,
  Save,
  XCircle,
  CheckSquare,
  X
} from 'lucide-react';
import { DiffNavigationPortal } from '../DiffNavigationPortal/index';
import { ConflictResolution } from '../ConflictResolution';
import { CollaborativeAnnotations } from '../CollaborativeAnnotations';
import { getVsCodeApi } from '../../../../vscode';
import './styles.css';

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
            },
            {
              id: 'conflict-2',
              type: 'rebase',
              description: 'Rebase conflict in src/utils/helpers.ts',
              status: 'resolved',
              files: ['src/utils/helpers.ts'],
              conflictDetails: {
                ours: 'export function formatDate(date) {\n  return new Date(date).toLocaleDateString();\n}',
                theirs: 'export function formatDate(date) {\n  const options = { year: "numeric", month: "short", day: "numeric" };\n  return new Date(date).toLocaleDateString(undefined, options);\n}',
                base: 'export function formatDate(date) {\n  return date.toString();\n}',
                filePath: 'src/utils/helpers.ts',
                startLine: 5,
                endLine: 7
              }
            }
          ],
          annotations: [
            {
              id: 'annotation-1',
              author: 'Alice',
              timestamp: '2023-11-10T15:30:00Z',
              content: 'We should optimize this function to reduce complexity.',
              file: 'src/utils/parser.ts',
              lineNumber: 42,
              codeSnippet: 'function parseData(input) {\n  // TODO: Optimize this algorithm\n  return input.split("").reverse().join("");\n}'
            },
            {
              id: 'annotation-2',
              author: 'Bob',
              timestamp: '2023-11-11T09:15:00Z',
              content: 'This component should use memo to prevent unnecessary re-renders.',
              file: 'src/components/UserList.tsx',
              lineNumber: 15,
              codeSnippet: 'const UserList = ({ users }) => {\n  return (\n    <div>\n      {users.map(user => <UserItem key={user.id} user={user} />)}\n    </div>\n  );\n};'
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
  }, []);

  // Handle refresh button click
  const handleRefresh = () => {
    setIsLoading(true);
    
    // Simulate fetching updated data
    setTimeout(() => {
      setIsLoading(false);
    }, 800);
  };

  // Handle settings change
  const handleSettingsChange = (key: string, value: any) => {
    setData(prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        [key]: value
      }
    }));
    
    // In a real implementation, this would send the updated settings to the extension
    vscode.postMessage({
      type: 'UPDATE_SETTINGS',
      payload: {
        [key]: value
      }
    });
  };

  // Handle resolve conflict
  const handleResolveConflict = (conflictId: string, resolution: 'ours' | 'theirs' | 'custom', customContent?: string) => {
    // Update the conflict status locally
    setData(prev => ({
      ...prev,
      conflicts: prev.conflicts.map(conflict => 
        conflict.id === conflictId 
          ? { ...conflict, status: 'resolved' } 
          : conflict
      )
    }));
    
    // In a real implementation, this would send the resolution to the extension
    vscode.postMessage({
      type: 'RESOLVE_CONFLICT',
      payload: {
        conflictId,
        resolution,
        customContent
      }
    });
  };

  // Render different tab content based on active tab
  const renderTabContent = () => {
    if (isLoading) {
      return (
        <div className="loading-container">
          <div className="loading-spinner"></div>
        </div>
      );
    }

    switch (activeTab) {
      case 'changes':
        return renderChangesTab();
      case 'conflicts':
        return renderConflictsTab();
      case 'annotations':
        return renderAnnotationsTab();
      case 'settings':
        return renderSettingsTab();
      default:
        return renderChangesTab();
    }
  };

  // Render changes tab content
  const renderChangesTab = () => {
    if (data.changes.length === 0) {
      return (
        <div className="empty-state">
          <div className="empty-state-icon">📄</div>
          <h3 className="empty-state-title">No changes detected</h3>
          <p className="empty-state-description">
            There are currently no changes to review. Make some changes to your project and they will appear here.
          </p>
          <button className="dashboard-action-button" onClick={handleRefresh}>
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
      );
    }

    return (
      <div className="changes-list">
        {data.changes.map(change => (
          <div key={change.id} className="change-item">
            <div className="change-header">
              <h3 className="change-title">{change.title}</h3>
              <div className="change-metadata">
                <span className="change-meta-item">
                  <GitBranch size={14} />
                  {change.branch}
                </span>
                <span className="change-meta-item">
                  <Users size={14} />
                  {change.author}
                </span>
              </div>
            </div>
            <p className="change-description">{change.description}</p>
            <div className="change-files">
              {change.files.map((file: string, index: number) => (
                <span key={index} className="change-file">
                  <FileCode size={14} />
                  {file}
                </span>
              ))}
            </div>
            <div className="change-actions">
              <button className="dashboard-action-button">
                <Eye size={14} />
                View Changes
              </button>
              <button className="dashboard-action-button">
                <Edit size={14} />
                Review
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  // Render conflicts tab content
  const renderConflictsTab = () => {
    if (data.conflicts.length === 0) {
      return (
        <div className="empty-state">
          <div className="empty-state-icon">🔄</div>
          <h3 className="empty-state-title">No conflicts detected</h3>
          <p className="empty-state-description">
            There are currently no merge or rebase conflicts to resolve.
          </p>
          <button className="dashboard-action-button" onClick={handleRefresh}>
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
      );
    }

    return (
      <div className="conflicts-list">
        {data.conflicts.map(conflict => (
          <div key={conflict.id} className="conflict-item">
            <div className="conflict-header">
              <h3 className="conflict-title">
                <AlertTriangle size={16} />
                {conflict.description}
              </h3>
              <span className={`conflict-status ${conflict.status}`}>
                {conflict.status === 'resolved' ? <CheckCircle size={14} /> : null}
                {conflict.status}
              </span>
            </div>
            <div className="conflict-files">
              {conflict.files.map((file: string, index: number) => (
                <span key={index} className="conflict-file">
                  <FileCode size={14} />
                  {file}
                </span>
              ))}
            </div>
            
            <div className="conflict-preview">
              <div className="conflict-preview-header">
                Code Preview: {conflict.conflictDetails.filePath}
              </div>
              <div className="conflict-preview-content">
                <div className="conflict-line conflict-line-base">
                  Base: {conflict.conflictDetails.base}
                </div>
                <div className="conflict-line conflict-line-ours">
                  Ours: {conflict.conflictDetails.ours}
                </div>
                <div className="conflict-line conflict-line-theirs">
                  Theirs: {conflict.conflictDetails.theirs}
                </div>
              </div>
            </div>
            
            {conflict.status !== 'resolved' && (
              <div className="conflict-actions">
                <button 
                  className="conflict-action-button conflict-action-secondary"
                  onClick={() => handleResolveConflict(conflict.id, 'ours')}
                >
                  Use Ours
                </button>
                <button 
                  className="conflict-action-button conflict-action-secondary"
                  onClick={() => handleResolveConflict(conflict.id, 'theirs')}
                >
                  Use Theirs
                </button>
                <button 
                  className="conflict-action-button conflict-action-primary"
                  onClick={() => {
                    // In a real implementation, this would open a conflict editor
                    vscode.postMessage({
                      type: 'OPEN_CONFLICT_EDITOR',
                      payload: {
                        conflictId: conflict.id,
                        file: conflict.conflictDetails.filePath,
                        startLine: conflict.conflictDetails.startLine,
                        endLine: conflict.conflictDetails.endLine
                      }
                    });
                  }}
                >
                  <Edit size={14} />
                  Edit Manually
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  // Render annotations tab content
  const renderAnnotationsTab = () => {
    if (data.annotations.length === 0) {
      return (
        <div className="empty-state">
          <div className="empty-state-icon">💬</div>
          <h3 className="empty-state-title">No annotations found</h3>
          <p className="empty-state-description">
            There are currently no code annotations to review.
          </p>
          <button className="dashboard-action-button" onClick={handleRefresh}>
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
      );
    }

    return (
      <div className="annotations-list">
        {data.annotations.map(annotation => (
          <div key={annotation.id} className="annotation-item">
            <div className="annotation-header">
              <h3 className="annotation-title">
                <MessageSquare size={16} />
                Annotation on {annotation.file}
              </h3>
              <div className="annotation-author">
                <div className="annotation-author-avatar">
                  {annotation.author.charAt(0)}
                </div>
                <span>{annotation.author}</span>
                <span className="annotation-timestamp">
                  {new Date(annotation.timestamp).toLocaleString()}
                </span>
              </div>
            </div>
            
            <div className="annotation-file">
              <FileCode size={14} />
              {annotation.file}:{annotation.lineNumber}
            </div>
            
            <div className="annotation-code">
              {annotation.codeSnippet}
            </div>
            
            <div className="annotation-content">
              {annotation.content}
            </div>
            
            <div className="annotation-actions">
              <button className="dashboard-action-button">
                <ArrowRight size={14} />
                Go to Code
              </button>
              <button className="dashboard-action-button">
                <MessageSquare size={14} />
                Reply
              </button>
              <button className="dashboard-action-button">
                <CheckSquare size={14} />
                Mark as Resolved
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  // Render settings tab content
  const renderSettingsTab = () => {
    return (
      <div className="settings-content">
        <div className="settings-section">
          <h3 className="settings-section-title">
            <Settings size={16} />
            General Settings
          </h3>
          
          <div className="settings-grid">
            <div className="settings-item">
              <span className="settings-item-label">Color Theme</span>
              <p className="settings-item-description">Choose the color theme for the Tribe dashboard</p>
              <select 
                className="settings-select"
                value={data.settings.theme}
                onChange={(e) => handleSettingsChange('theme', e.target.value)}
              >
                <option value="vs-dark">Dark</option>
                <option value="vs-light">Light</option>
                <option value="vs-high-contrast">High Contrast</option>
              </select>
            </div>
            
            <div className="settings-item">
              <span className="settings-item-label">Auto-resolve Conflicts</span>
              <p className="settings-item-description">Automatically resolve simple conflicts</p>
              <div 
                className={`settings-toggle ${data.settings.autoResolve ? 'active' : ''}`}
                onClick={() => handleSettingsChange('autoResolve', !data.settings.autoResolve)}
              >
                <div className="settings-toggle-slider"></div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="settings-section">
          <h3 className="settings-section-title">
            <GitMerge size={16} />
            Code Diff Settings
          </h3>
          
          <div className="settings-grid">
            <div className="settings-item">
              <span className="settings-item-label">Show Line Numbers</span>
              <p className="settings-item-description">Display line numbers in code diffs</p>
              <div 
                className={`settings-toggle ${data.settings.showLineNumbers ? 'active' : ''}`}
                onClick={() => handleSettingsChange('showLineNumbers', !data.settings.showLineNumbers)}
              >
                <div className="settings-toggle-slider"></div>
              </div>
            </div>
            
            <div className="settings-item">
              <span className="settings-item-label">Diff View Mode</span>
              <p className="settings-item-description">How to display code differences</p>
              <select 
                className="settings-select"
                value={data.settings.diffViewMode}
                onChange={(e) => handleSettingsChange('diffViewMode', e.target.value)}
              >
                <option value="inline">Inline</option>
                <option value="split">Split</option>
              </select>
            </div>
          </div>
        </div>
        
        <div className="settings-actions">
          <button 
            className="settings-button settings-button-secondary"
            onClick={() => {
              // Reset settings to defaults
              handleSettingsChange('theme', 'vs-dark');
              handleSettingsChange('autoResolve', false);
              handleSettingsChange('showLineNumbers', true);
              handleSettingsChange('diffViewMode', 'inline');
            }}
          >
            Reset to Defaults
          </button>
          <button 
            className="settings-button settings-button-primary"
            onClick={() => {
              // Simulate saving settings
              vscode.postMessage({
                type: 'SAVE_SETTINGS',
                payload: data.settings
              });
            }}
          >
            <Save size={14} />
            Save Settings
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="tribe-dashboard">
      <div className="dashboard-header">
        <h2 className="dashboard-title">
          <Users size={24} className="dashboard-title-icon" />
          Tribe Dashboard
        </h2>
        <div className="dashboard-actions">
          <button 
            className="dashboard-action-button"
            onClick={handleRefresh}
            disabled={isLoading}
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
      </div>
      
      <div className="dashboard-tabs">
        <button 
          className={`dashboard-tab ${activeTab === 'changes' ? 'active' : ''}`}
          onClick={() => setActiveTab('changes')}
        >
          <GitBranch size={16} />
          Changes
        </button>
        <button 
          className={`dashboard-tab ${activeTab === 'conflicts' ? 'active' : ''}`}
          onClick={() => setActiveTab('conflicts')}
        >
          <GitMerge size={16} />
          Conflicts {data.conflicts.filter(c => c.status === 'pending').length > 0 && `(${data.conflicts.filter(c => c.status === 'pending').length})`}
        </button>
        <button 
          className={`dashboard-tab ${activeTab === 'annotations' ? 'active' : ''}`}
          onClick={() => setActiveTab('annotations')}
        >
          <MessageSquare size={16} />
          Annotations {data.annotations.length > 0 && `(${data.annotations.length})`}
        </button>
        <button 
          className={`dashboard-tab ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          <Settings size={16} />
          Settings
        </button>
      </div>
      
      <div className="dashboard-content">
        {renderTabContent()}
      </div>
    </div>
  );
};