import React, { useState, useEffect } from 'react';
import { getVsCodeApi } from '../../../vscode';
import { Agent } from '../types';
import { Clipboard, Wrench, Brain, Layers } from 'lucide-react';
import './ConsolidatedDashboard.css';

// Import the original components
import { ProjectDashboard } from './ProjectDashboard';
import { ToolsPanel } from './ToolsPanel';
import { LearningDashboard } from './LearningDashboard';

// Initialize VS Code API
const vscode = getVsCodeApi();

interface ConsolidatedDashboardProps {
  agents: Agent[];
  selectedAgent: Agent | null;
  projectSystemEnabled: boolean;
  toolsSystemEnabled: boolean;
  learningSystemEnabled: boolean;
  onToggleProjectSystem: (enabled: boolean) => void;
  onToggleToolsSystem: (enabled: boolean) => void;
  onToggleLearningSystem: (enabled: boolean) => void;
}

type DashboardTab = 'project' | 'tools' | 'learning' | 'overview';

export const ConsolidatedDashboard: React.FC<ConsolidatedDashboardProps> = ({
  agents,
  selectedAgent,
  projectSystemEnabled,
  toolsSystemEnabled,
  learningSystemEnabled,
  onToggleProjectSystem,
  onToggleToolsSystem,
  onToggleLearningSystem
}) => {
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  
  // Debug log when component mounts
  useEffect(() => {
    console.log('ConsolidatedDashboard mounted with props:', {
      agentsCount: agents?.length || 0,
      hasSelectedAgent: !!selectedAgent,
      projectSystemEnabled,
      toolsSystemEnabled,
      learningSystemEnabled
    });
  }, []);
  
  const renderTabContent = () => {
    switch (activeTab) {
      case 'project':
        return (
          <div className="tab-content-wrapper">
            {agents && agents.length > 0 ? (
              <ProjectDashboard 
                agents={agents}
                systemEnabled={projectSystemEnabled}
                onToggleSystem={onToggleProjectSystem}
              />
            ) : (
              <div className="empty-state">
                <p>No agents available. Please create an agent first.</p>
              </div>
            )}
          </div>
        );
        
      case 'tools':
        return (
          <div className="tab-content-wrapper">
            {agents && agents.length > 0 ? (
              <ToolsPanel 
                agents={agents}
                selectedAgent={selectedAgent}
                systemEnabled={toolsSystemEnabled}
                onToggleSystem={onToggleToolsSystem}
              />
            ) : (
              <div className="empty-state">
                <p>No agents available. Please create an agent first.</p>
              </div>
            )}
          </div>
        );
        
      case 'learning':
        return (
          <div className="tab-content-wrapper">
            {agents && agents.length > 0 ? (
              <LearningDashboard 
                agents={agents}
                selectedAgent={selectedAgent}
                systemEnabled={learningSystemEnabled}
                onToggleSystem={onToggleLearningSystem}
              />
            ) : (
              <div className="empty-state">
                <p>No agents available. Please create an agent first.</p>
              </div>
            )}
          </div>
        );
        
      case 'overview':
      default:
        return (
          <div className="dashboard-overview">
            <div className="overview-cards">
              <div className="overview-card project-card">
                <div className="card-header">
                  <Clipboard size={20} />
                  <h4>Project System</h4>
                </div>
                <div className="card-metrics">
                  <div className="metric">
                    <span className="metric-value">{agents?.length || 0}</span>
                    <span className="metric-label">Agents</span>
                  </div>
                  <div className="metric">
                    <span className="metric-value">
                      {projectSystemEnabled ? 'On' : 'Off'}
                    </span>
                    <span className="metric-label">Status</span>
                  </div>
                </div>
                <div className="card-status">
                  <span 
                    className={`status-indicator ${projectSystemEnabled ? 'active' : 'inactive'}`}
                  >
                    {projectSystemEnabled ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <button 
                  className="card-action-button"
                  onClick={() => onToggleProjectSystem(!projectSystemEnabled)}
                >
                  {projectSystemEnabled ? 'Disable' : 'Enable'} Project System
                </button>
              </div>
              
              <div className="overview-card tools-card">
                <div className="card-header">
                  <Wrench size={20} />
                  <h4>Tools System</h4>
                </div>
                <div className="card-metrics">
                  <div className="metric">
                    <span className="metric-value">{agents?.length || 0}</span>
                    <span className="metric-label">Agents</span>
                  </div>
                  <div className="metric">
                    <span className="metric-value">
                      {toolsSystemEnabled ? 'On' : 'Off'}
                    </span>
                    <span className="metric-label">Status</span>
                  </div>
                </div>
                <div className="card-status">
                  <span 
                    className={`status-indicator ${toolsSystemEnabled ? 'active' : 'inactive'}`}
                  >
                    {toolsSystemEnabled ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <button 
                  className="card-action-button"
                  onClick={() => onToggleToolsSystem(!toolsSystemEnabled)}
                >
                  {toolsSystemEnabled ? 'Disable' : 'Enable'} Tools System
                </button>
              </div>
              
              <div className="overview-card learning-card">
                <div className="card-header">
                  <Brain size={20} />
                  <h4>Learning System</h4>
                </div>
                <div className="card-metrics">
                  <div className="metric">
                    <span className="metric-value">{agents?.length || 0}</span>
                    <span className="metric-label">Agents</span>
                  </div>
                  <div className="metric">
                    <span className="metric-value">
                      {learningSystemEnabled ? 'On' : 'Off'}
                    </span>
                    <span className="metric-label">Status</span>
                  </div>
                </div>
                <div className="card-status">
                  <span 
                    className={`status-indicator ${learningSystemEnabled ? 'active' : 'inactive'}`}
                  >
                    {learningSystemEnabled ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <button 
                  className="card-action-button"
                  onClick={() => onToggleLearningSystem(!learningSystemEnabled)}
                >
                  {learningSystemEnabled ? 'Disable' : 'Enable'} Learning System
                </button>
              </div>
            </div>
            
            <div className="overview-agents">
              <div className="overview-section-header">
                <h4>Active Agents</h4>
              </div>
              
              {agents && agents.length > 0 ? (
                <div className="agent-avatars">
                  {agents.map((agent) => (
                    <div key={agent.id} className="agent-avatar-container">
                      <div className="agent-avatar">
                        {agent.name ? agent.name.substring(0, 2).toUpperCase() : 'AG'}
                      </div>
                      <span className="agent-name">{agent.name || 'Agent'}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p>No agents available. Please create an agent first.</p>
              )}
            </div>
            
            <div className="overview-actions">
              <button 
                className={`system-toggle-button ${projectSystemEnabled ? 'active' : ''}`}
                onClick={() => onToggleProjectSystem(!projectSystemEnabled)}
              >
                <Clipboard size={16} />
                <span>{projectSystemEnabled ? 'Disable' : 'Enable'} Project System</span>
              </button>
              
              <button 
                className={`system-toggle-button ${toolsSystemEnabled ? 'active' : ''}`}
                onClick={() => onToggleToolsSystem(!toolsSystemEnabled)}
              >
                <Wrench size={16} />
                <span>{toolsSystemEnabled ? 'Disable' : 'Enable'} Tools System</span>
              </button>
              
              <button 
                className={`system-toggle-button ${learningSystemEnabled ? 'active' : ''}`}
                onClick={() => onToggleLearningSystem(!learningSystemEnabled)}
              >
                <Brain size={16} />
                <span>{learningSystemEnabled ? 'Disable' : 'Enable'} Learning System</span>
              </button>
            </div>
          </div>
        );
    }
  };
  
  return (
    <div className="consolidated-dashboard">
      <div className="dashboard-tabs">
        <button
          className={`tab-button ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <Layers size={16} />
          <span>Overview</span>
        </button>
        
        <button
          className={`tab-button ${activeTab === 'project' ? 'active' : ''}`}
          onClick={() => setActiveTab('project')}
        >
          <Clipboard size={16} />
          <span>Projects</span>
        </button>
        
        <button
          className={`tab-button ${activeTab === 'tools' ? 'active' : ''}`}
          onClick={() => setActiveTab('tools')}
        >
          <Wrench size={16} />
          <span>Tools</span>
        </button>
        
        <button
          className={`tab-button ${activeTab === 'learning' ? 'active' : ''}`}
          onClick={() => setActiveTab('learning')}
        >
          <Brain size={16} />
          <span>Learning</span>
        </button>
      </div>
      
      <div className="dashboard-content">
        {renderTabContent()}
      </div>
    </div>
  );
}; 