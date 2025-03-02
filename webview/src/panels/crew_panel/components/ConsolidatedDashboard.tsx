import React, { useState, useEffect } from 'react';
import { getVsCodeApi } from '../../../vscode';
import { Agent } from '../types';
import { Clipboard, Wrench, Brain, Layers, Bolt, Settings } from 'lucide-react';
import './ConsolidatedDashboard.css';

// Import the original components
import { ProjectDashboard } from './ProjectDashboard';
import { ToolsPanel } from './ToolsPanel';
import { LearningDashboard } from './LearningDashboard';
import { QuickActionsPanel } from './QuickActionsPanel';

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
  const [activePopover, setActivePopover] = useState<string | null>(null);
  
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
  
  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (activePopover) {
        setActivePopover(null);
      }
    };
    
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [activePopover]);
  
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
            {/* Quick Actions Panel */}
            <QuickActionsPanel
              onCreateTask={(description) => {
                vscode.postMessage({
                  type: 'CREATE_TASK',
                  payload: { description }
                });
              }}
              onSendTeamMessage={(message) => {
                vscode.postMessage({
                  type: 'SEND_TEAM_MESSAGE',
                  payload: { message }
                });
              }}
              onAnalyzeProject={() => {
                vscode.postMessage({
                  type: 'ANALYZE_PROJECT'
                });
              }}
              onCreateCheckpoint={(description) => {
                vscode.postMessage({
                  type: 'CREATE_CHECKPOINT',
                  payload: { description }
                });
              }}
              onGenerateCode={(description) => {
                vscode.postMessage({
                  type: 'GENERATE_CODE',
                  payload: { description }
                });
              }}
              onReviewCode={() => {
                vscode.postMessage({
                  type: 'REVIEW_CODE'
                });
              }}
            />
            
            <div className="overview-cards">
              <div className="overview-card project-card">
                <div className="card-header">
                  <div className="card-title">
                    <Clipboard size={20} />
                    <h4>Project System</h4>
                  </div>
                  <div className="settings-menu-container">
                    <button 
                      className="settings-cog-button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActivePopover(activePopover === 'project' ? null : 'project');
                      }}
                      title="Project System Settings"
                    >
                      <Settings size={16} />
                    </button>
                    {activePopover === 'project' && (
                      <div className="settings-popover" onClick={(e) => e.stopPropagation()}>
                        <div className="popover-header">
                          <h4>Project System</h4>
                        </div>
                        <div className="popover-content">
                          <div className="popover-toggle">
                            <label>
                              <span>System {projectSystemEnabled ? 'Enabled' : 'Disabled'}</span>
                              <button 
                                className={`toggle-button ${projectSystemEnabled ? 'active' : ''}`}
                                onClick={() => onToggleProjectSystem(!projectSystemEnabled)}
                              >
                                {projectSystemEnabled ? 'On' : 'Off'}
                              </button>
                            </label>
                          </div>
                          <div className="popover-actions">
                            <button 
                              className="action-button" 
                              onClick={() => {
                                vscode.postMessage({
                                  type: 'CONFIGURE_PROJECT_SYSTEM'
                                });
                                setActivePopover(null);
                              }}
                            >
                              Advanced Settings
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
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
              </div>
              
              <div className="overview-card tools-card">
                <div className="card-header">
                  <div className="card-title">
                    <Wrench size={20} />
                    <h4>Tools System</h4>
                  </div>
                  <div className="settings-menu-container">
                    <button 
                      className="settings-cog-button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActivePopover(activePopover === 'tools' ? null : 'tools');
                      }}
                      title="Tools System Settings"
                    >
                      <Settings size={16} />
                    </button>
                    {activePopover === 'tools' && (
                      <div className="settings-popover" onClick={(e) => e.stopPropagation()}>
                        <div className="popover-header">
                          <h4>Tools System</h4>
                        </div>
                        <div className="popover-content">
                          <div className="popover-toggle">
                            <label>
                              <span>System {toolsSystemEnabled ? 'Enabled' : 'Disabled'}</span>
                              <button 
                                className={`toggle-button ${toolsSystemEnabled ? 'active' : ''}`}
                                onClick={() => onToggleToolsSystem(!toolsSystemEnabled)}
                              >
                                {toolsSystemEnabled ? 'On' : 'Off'}
                              </button>
                            </label>
                          </div>
                          <div className="popover-actions">
                            <button 
                              className="action-button" 
                              onClick={() => {
                                vscode.postMessage({
                                  type: 'CONFIGURE_TOOLS_SYSTEM'
                                });
                                setActivePopover(null);
                              }}
                            >
                              Advanced Settings
                            </button>
                            <button 
                              className="action-button" 
                              onClick={() => {
                                vscode.postMessage({
                                  type: 'MANAGE_TOOLS'
                                });
                                setActivePopover(null);
                              }}
                            >
                              Manage Tools
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
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
              </div>
              
              <div className="overview-card learning-card">
                <div className="card-header">
                  <div className="card-title">
                    <Brain size={20} />
                    <h4>Learning System</h4>
                  </div>
                  <div className="settings-menu-container">
                    <button 
                      className="settings-cog-button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActivePopover(activePopover === 'learning' ? null : 'learning');
                      }}
                      title="Learning System Settings"
                    >
                      <Settings size={16} />
                    </button>
                    {activePopover === 'learning' && (
                      <div className="settings-popover" onClick={(e) => e.stopPropagation()}>
                        <div className="popover-header">
                          <h4>Learning System</h4>
                        </div>
                        <div className="popover-content">
                          <div className="popover-toggle">
                            <label>
                              <span>System {learningSystemEnabled ? 'Enabled' : 'Disabled'}</span>
                              <button 
                                className={`toggle-button ${learningSystemEnabled ? 'active' : ''}`}
                                onClick={() => onToggleLearningSystem(!learningSystemEnabled)}
                              >
                                {learningSystemEnabled ? 'On' : 'Off'}
                              </button>
                            </label>
                          </div>
                          <div className="popover-actions">
                            <button 
                              className="action-button" 
                              onClick={() => {
                                vscode.postMessage({
                                  type: 'CONFIGURE_LEARNING_SYSTEM'
                                });
                                setActivePopover(null);
                              }}
                            >
                              Advanced Settings
                            </button>
                            <button 
                              className="action-button" 
                              onClick={() => {
                                vscode.postMessage({
                                  type: 'VIEW_LEARNING_METRICS'
                                });
                                setActivePopover(null);
                              }}
                            >
                              View Metrics
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
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
            
{/* System toggle buttons removed in favor of settings cogs in each card */}
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