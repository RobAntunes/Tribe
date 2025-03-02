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
import './styles.css';

interface QuickAction {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  category: 'developer' | 'team' | 'project' | 'system';
  handler: () => void;
}

interface QuickActionsPanelProps {
  onCreateTask?: (description: string) => void;
  onSendTeamMessage?: (message: string) => void;
  onAnalyzeProject?: () => void;
  onCreateCheckpoint?: (description: string) => void;
  onGenerateCode?: (description: string) => void;
  onReviewCode?: () => void;
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
  const [activeAction, setActiveAction] = useState<string>('');
  const [inputValue, setInputValue] = useState<string>('');
  
  // Generate quick actions
  const quickActions: QuickAction[] = [
    {
      id: 'create-task',
      name: 'Create Task',
      description: 'Create a new task in the project',
      icon: <Clipboard size={20} />,
      category: 'project',
      handler: () => setActiveAction('create-task')
    },
    {
      id: 'team-message',
      name: 'Send Team Message',
      description: 'Send a message to the team',
      icon: <MessageSquare size={20} />,
      category: 'team',
      handler: () => setActiveAction('team-message')
    },
    {
      id: 'analyze-project',
      name: 'Analyze Project',
      description: 'Analyze the current project structure',
      icon: <Search size={20} />,
      category: 'developer',
      handler: () => {
        if (onAnalyzeProject) {
          onAnalyzeProject();
        }
      }
    },
    {
      id: 'create-checkpoint',
      name: 'Create Checkpoint',
      description: 'Create a checkpoint for the current state',
      icon: <Save size={20} />,
      category: 'project',
      handler: () => setActiveAction('create-checkpoint')
    },
    {
      id: 'generate-code',
      name: 'Generate Code',
      description: 'Generate code based on a description',
      icon: <Code size={20} />,
      category: 'developer',
      handler: () => setActiveAction('generate-code')
    },
    {
      id: 'review-code',
      name: 'Review Code',
      description: 'Review the current code for improvements',
      icon: <Eye size={20} />,
      category: 'developer',
      handler: () => {
        if (onReviewCode) {
          onReviewCode();
        }
      }
    },
    {
      id: 'generate-docs',
      name: 'Generate Documentation',
      description: 'Generate documentation for the code',
      icon: <FileText size={20} />,
      category: 'developer',
      handler: () => setActiveAction('generate-docs')
    },
    {
      id: 'optimize-code',
      name: 'Optimize Code',
      description: 'Optimize the current code for performance',
      icon: <Zap size={20} />,
      category: 'developer',
      handler: () => setActiveAction('optimize-code')
    },
    {
      id: 'create-merge',
      name: 'Create Merge Request',
      description: 'Create a merge request for your changes',
      icon: <GitMerge size={20} />,
      category: 'developer',
      handler: () => setActiveAction('create-merge')
    },
    {
      id: 'run-tests',
      name: 'Run Tests',
      description: 'Run the test suite for the project',
      icon: <Play size={20} />,
      category: 'developer',
      handler: () => setActiveAction('run-tests')
    },
    {
      id: 'improve-learning',
      name: 'Improve Learning',
      description: 'Improve the learning system with new data',
      icon: <Brain size={20} />,
      category: 'system',
      handler: () => setActiveAction('improve-learning')
    },
    {
      id: 'system-status',
      name: 'System Health Check',
      description: 'Check the health status of all systems',
      icon: <Activity size={20} />,
      category: 'system',
      handler: () => setActiveAction('system-status')
    }
  ];
  
  const filteredActions = quickActions.filter(action => 
    activeCategory === 'all' || action.category === activeCategory
  );
  
  const handleSubmit = () => {
    if (!inputValue.trim()) return;
    
    switch (activeAction) {
      case 'create-task':
        if (onCreateTask) {
          onCreateTask(inputValue);
        }
        break;
      case 'team-message':
        if (onSendTeamMessage) {
          onSendTeamMessage(inputValue);
        }
        break;
      case 'create-checkpoint':
        if (onCreateCheckpoint) {
          onCreateCheckpoint(inputValue);
        }
        break;
      case 'generate-code':
        if (onGenerateCode) {
          onGenerateCode(inputValue);
        }
        break;
      default:
        console.log(`Action ${activeAction} not implemented yet`);
    }
    
    // Reset input and active action
    setInputValue('');
    setActiveAction('');
  };
  
  return (
    <div className="quick-actions-panel">
      <div className="quick-actions-header">
        <h3>Quick Actions</h3>
        <div className="quick-actions-tabs">
          <button 
            className={`category-tab ${activeCategory === 'developer' ? 'active' : ''}`}
            onClick={() => setActiveCategory('developer')}
          >
            <Code size={16} />
            <span>Developer</span>
          </button>
          <button 
            className={`category-tab ${activeCategory === 'team' ? 'active' : ''}`}
            onClick={() => setActiveCategory('team')}
          >
            <Users size={16} />
            <span>Team</span>
          </button>
          <button 
            className={`category-tab ${activeCategory === 'project' ? 'active' : ''}`}
            onClick={() => setActiveCategory('project')}
          >
            <Clipboard size={16} />
            <span>Project</span>
          </button>
          <button 
            className={`category-tab ${activeCategory === 'system' ? 'active' : ''}`}
            onClick={() => setActiveCategory('system')}
          >
            <Activity size={16} />
            <span>System</span>
          </button>
          <button 
            className={`category-tab ${activeCategory === 'all' ? 'active' : ''}`}
            onClick={() => setActiveCategory('all')}
          >
            <Bolt size={16} />
            <span>All</span>
          </button>
        </div>
      </div>
      
      <div className="quick-actions-grid">
        {filteredActions.map(action => (
          <button 
            key={action.id}
            className={`action-card ${activeAction === action.id ? 'active' : ''}`}
            onClick={action.handler}
          >
            <div className="action-icon">
              {action.icon}
            </div>
            <div className="action-details">
              <span className="action-name">{action.name}</span>
              <span className="action-description">{action.description}</span>
            </div>
          </button>
        ))}
      </div>
      
      {activeAction && (
        <div className="action-input-container">
          <div className="input-header">
            <h4>{quickActions.find(a => a.id === activeAction)?.name}</h4>
            <button 
              className="close-input"
              onClick={() => {
                setActiveAction('');
                setInputValue('');
              }}
            >
              &times;
            </button>
          </div>
          <div className="input-form">
            <label>
              {activeAction === 'create-task' && 'Task Description:'}
              {activeAction === 'team-message' && 'Message:'}
              {activeAction === 'create-checkpoint' && 'Checkpoint Description:'}
              {activeAction === 'generate-code' && 'Code Description:'}
              {activeAction === 'generate-docs' && 'Documentation Request:'}
              {activeAction === 'optimize-code' && 'Optimization Target:'}
              {activeAction === 'create-merge' && 'Merge Request Title:'}
              {activeAction === 'run-tests' && 'Test Filter:'}
              {activeAction === 'improve-learning' && 'Learning Input:'}
              {activeAction === 'system-status' && 'System Component:'}
            </label>
            <textarea 
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Enter details..."
            />
            <button 
              className="execute-button"
              onClick={handleSubmit}
              disabled={!inputValue.trim()}
            >
              <FastForward size={16} />
              Execute
            </button>
          </div>
        </div>
      )}
    </div>
  );
};