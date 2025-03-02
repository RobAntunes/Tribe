import React, { useState } from 'react';
import {
  Activity,
  Code,
  GitMerge,
  MessageSquare,
  Users,
  Brain,
  Bolt,
  Play,
  Clipboard,
  Search,
  Eye,
  FileText,
  Zap,
  FastForward,
  Save
} from 'lucide-react';
import './QuickActionsPanel.css';

interface QuickAction {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  category: 'developer' | 'team' | 'project' | 'system';
  handler: () => void;
}

interface QuickActionsPanelProps {
  onCreateTask: (description: string) => void;
  onSendTeamMessage: (message: string) => void;
  onAnalyzeProject: () => void;
  onCreateCheckpoint: (description: string) => void;
  onGenerateCode: (description: string) => void;
  onReviewCode: () => void;
}

export const QuickActionsPanel: React.FC<QuickActionsPanelProps> = ({
  onCreateTask,
  onSendTeamMessage,
  onAnalyzeProject,
  onCreateCheckpoint,
  onGenerateCode,
  onReviewCode
}) => {
  const [activeCategory, setActiveCategory] = useState<string>('developer');
  const [actionInput, setActionInput] = useState<string>('');
  const [selectedAction, setSelectedAction] = useState<QuickAction | null>(null);

  // Define common actions
  const quickActions: QuickAction[] = [
    {
      id: 'create-task',
      name: 'Create Task',
      description: 'Create a new task for the team',
      icon: <Clipboard size={16} />,
      category: 'developer',
      handler: () => {
        if (actionInput) {
          onCreateTask(actionInput);
          setActionInput('');
        }
      }
    },
    {
      id: 'team-message',
      name: 'Team Message',
      description: 'Send a message to the entire team',
      icon: <MessageSquare size={16} />,
      category: 'team',
      handler: () => {
        if (actionInput) {
          onSendTeamMessage(actionInput);
          setActionInput('');
        }
      }
    },
    {
      id: 'analyze-project',
      name: 'Analyze Project',
      description: 'Run a comprehensive analysis of the project',
      icon: <Search size={16} />,
      category: 'project',
      handler: () => {
        onAnalyzeProject();
        setActionInput('');
      }
    },
    {
      id: 'create-checkpoint',
      name: 'Create Checkpoint',
      description: 'Create a checkpoint of the current state',
      icon: <Save size={16} />,
      category: 'system',
      handler: () => {
        if (actionInput) {
          onCreateCheckpoint(actionInput);
          setActionInput('');
        }
      }
    },
    {
      id: 'generate-code',
      name: 'Generate Code',
      description: 'Generate code based on a description',
      icon: <Code size={16} />,
      category: 'developer',
      handler: () => {
        if (actionInput) {
          onGenerateCode(actionInput);
          setActionInput('');
        }
      }
    },
    {
      id: 'review-code',
      name: 'Review Code',
      description: 'Initiate a code review',
      icon: <Eye size={16} />,
      category: 'developer',
      handler: () => {
        onReviewCode();
        setActionInput('');
      }
    },
  ];

  const filteredActions = quickActions.filter(
    action => action.category === activeCategory
  );

  const handleActionSelect = (action: QuickAction) => {
    setSelectedAction(action);
  };

  const handleActionExecute = () => {
    if (selectedAction) {
      selectedAction.handler();
      setSelectedAction(null);
    }
  };

  return (
    <div className="quick-actions-panel">
      <div className="quick-actions-header">
        <h3>
          <Bolt size={16} className="icon" />
          <span>Quick Actions</span>
        </h3>
        <div className="category-tabs">
          <button
            className={`category-tab ${activeCategory === 'developer' ? 'active' : ''}`}
            onClick={() => setActiveCategory('developer')}
            title="Developer Actions"
          >
            <Code size={14} />
            <span>Developer</span>
          </button>
          <button
            className={`category-tab ${activeCategory === 'team' ? 'active' : ''}`}
            onClick={() => setActiveCategory('team')}
            title="Team Actions"
          >
            <Users size={14} />
            <span>Team</span>
          </button>
          <button
            className={`category-tab ${activeCategory === 'project' ? 'active' : ''}`}
            onClick={() => setActiveCategory('project')}
            title="Project Actions"
          >
            <FileText size={14} />
            <span>Project</span>
          </button>
          <button
            className={`category-tab ${activeCategory === 'system' ? 'active' : ''}`}
            onClick={() => setActiveCategory('system')}
            title="System Actions"
          >
            <Zap size={14} />
            <span>System</span>
          </button>
        </div>
      </div>

      <div className="actions-grid">
        {filteredActions.map(action => (
          <button
            key={action.id}
            className={`action-button ${selectedAction?.id === action.id ? 'selected' : ''}`}
            onClick={() => handleActionSelect(action)}
          >
            <div className="action-icon">{action.icon}</div>
            <div className="action-info">
              <div className="action-name">{action.name}</div>
              <div className="action-description">{action.description}</div>
            </div>
          </button>
        ))}
      </div>

      {selectedAction && (
        <div className="action-input-container">
          <div className="input-header">
            <span>{selectedAction.name}</span>
            <button className="close-button" onClick={() => setSelectedAction(null)}>
              ✕
            </button>
          </div>
          <div className="input-body">
            <textarea
              className="action-input"
              placeholder={`Enter details for ${selectedAction.name}...`}
              value={actionInput}
              onChange={(e) => setActionInput(e.target.value)}
            />
            <button 
              className="execute-button"
              onClick={handleActionExecute}
              disabled={!actionInput && selectedAction.id !== 'analyze-project' && selectedAction.id !== 'review-code'}
            >
              <Play size={14} /> Execute
            </button>
          </div>
        </div>
      )}
    </div>
  );
};