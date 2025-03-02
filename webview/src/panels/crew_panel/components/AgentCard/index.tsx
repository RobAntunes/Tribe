import React, { useState, useEffect } from 'react';
import { Agent, Message, AutonomyLevel } from '../../types';
import { AgentAutonomyPanel } from '../AgentAutonomyPanel';
import { ChatWindow } from '../ChatWindow';
import { ChevronRight, ChevronDown, MessageSquare, Wrench, Users, CheckSquare, Settings, Brain } from 'lucide-react';
import { getVsCodeApi } from '../../../../vscode';
import './styles.css';

// Initialize VS Code API
const vscode = getVsCodeApi();

// Predefined autonomy levels
const AUTONOMY_LEVELS: AutonomyLevel[] = [
  { level: 'MINIMAL', value: 0.2, description: 'Requires approval for most actions' },
  { level: 'LOW', value: 0.4, description: 'Can perform routine tasks independently' },
  { level: 'MEDIUM', value: 0.6, description: 'Can make decisions within defined parameters' },
  { level: 'HIGH', value: 0.8, description: 'Operates with minimal oversight' },
  { level: 'FULL', value: 1.0, description: 'Complete autonomy in decision making' }
];

interface AgentCardProps {
    agent: Agent;
    selected?: boolean;
    isSelected?: boolean;
    expanded?: boolean;
    onClick?: () => void;
    showControls?: boolean;
    onActivate?: () => void;
    onDeactivate?: () => void;
    onSelect?: (agent: Agent) => void;
    onSendMessage?: (agentId: string, message: string) => void;
    onUpdateAutonomy?: (agentId: string, updates: Partial<Agent>) => void;
    messages?: Message[];
    loadingAgent?: string;
    onDirectMessage?: (agentId: string) => void;
    teams?: Array<{ id: string; name: string; members: string[] }>;
    tasks?: Array<{ id: string; title: string; assignedTo: string; status: string }>;
}

export const AgentCard: React.FC<AgentCardProps> = ({
    agent,
    selected,
    isSelected,
    expanded,
    onClick,
    showControls,
    onActivate,
    onDeactivate,
    onSelect,
    onSendMessage,
    onUpdateAutonomy,
    messages = [],
    loadingAgent,
    onDirectMessage,
    teams = [],
    tasks = []
}) => {
    const [showAutonomyPanel, setShowAutonomyPanel] = useState(false);
    const [showDirectChat, setShowDirectChat] = useState(false);
    const [showMessagesPanel, setShowMessagesPanel] = useState(false);
    const [agentDescription, setAgentDescription] = useState<string | null>(null);
    const [showStats, setShowStats] = useState(false);
    const [showTools, setShowTools] = useState(false);
    const [showTeams, setShowTeams] = useState(false);
    const [showTasks, setShowTasks] = useState(false);
    const [showLearning, setShowLearning] = useState(false);
    const [selectedAutonomyLevel, setSelectedAutonomyLevel] = useState<string>(
        agent.autonomyState?.level.level || 'MEDIUM'
    );

    // Ensure agent has all required properties with defaults
    const safeAgent = {
        id: agent.id,
        name: agent.name || agent.role || 'Agent', // Use name from agent spec, fallback to role
        role: agent.role || 'Unknown Role',
        status: agent.status || 'active',
        backstory: agent.backstory || '',
        description: agent.description || '',
        short_description: agent.short_description || agent.description || '',
        tools: agent.tools || [],
        performanceMetrics: agent.performanceMetrics || null,
        autonomyState: agent.autonomyState || {
            level: AUTONOMY_LEVELS.find(l => l.level === 'MEDIUM') || AUTONOMY_LEVELS[2],
            taskTypes: {},
            performanceHistory: [],
            adaptationHistory: []
        },
        learningEnabled: agent.learningEnabled !== undefined ? agent.learningEnabled : true
    };

    // Extract description from agent backstory or messages
    useEffect(() => {
        // First priority: use the short_description field if available
        if (safeAgent.short_description) {
            setAgentDescription(safeAgent.short_description);
        }
        // Second priority: use the description field if available
        else if (safeAgent.description) {
            setAgentDescription(safeAgent.description);
        }
        // Third priority: use the backstory from the agent spec
        else if (safeAgent.backstory) {
            setAgentDescription(safeAgent.backstory);
        } 
        // Fourth priority: try to extract from agent messages
        else if (messages && messages.length > 0) {
            // Look for introduction or description messages from this agent
            const introMessages = messages.filter(m => 
                m.sender === safeAgent.id && 
                (m.content.toLowerCase().includes('introduction') || 
                 m.content.toLowerCase().includes('my role') ||
                 m.content.toLowerCase().includes('i am responsible') ||
                 m.content.toLowerCase().includes('my responsibilities'))
            );
            
            if (introMessages.length > 0) {
                // Extract a concise description from the first relevant message
                const content = introMessages[0].content;
                const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
                
                // Take the first 1-2 sentences that seem descriptive
                const relevantSentences = sentences.filter(s => 
                    s.toLowerCase().includes('responsible') || 
                    s.toLowerCase().includes('role') || 
                    s.toLowerCase().includes('focus') ||
                    s.toLowerCase().includes('specialize')
                ).slice(0, 2);
                
                if (relevantSentences.length > 0) {
                    setAgentDescription(relevantSentences.join('. ') + '.');
                } else if (sentences.length > 0) {
                    // If no clearly relevant sentences, just take the first one
                    setAgentDescription(sentences[0] + '.');
                }
            }
        }
        
        // If still no description, use a default based on role
        if (!agentDescription) {
            const defaultDescription = `${safeAgent.role} agent working on the project.`;
            setAgentDescription(defaultDescription);
            
            // Also log this for debugging
            console.log(`Setting default description for agent ${safeAgent.id}: ${defaultDescription}`);
        }
    }, [messages, safeAgent.id, safeAgent.backstory, safeAgent.short_description, safeAgent.description, safeAgent.role, agentDescription]);

    // Handle autonomy level change
    const handleAutonomyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newLevel = e.target.value;
        setSelectedAutonomyLevel(newLevel);
        
        const autonomyLevel = AUTONOMY_LEVELS.find(l => l.level === newLevel);
        if (autonomyLevel && onUpdateAutonomy) {
            const updates: Partial<Agent> = {
                autonomyState: {
                    ...safeAgent.autonomyState,
                    level: autonomyLevel,
                    adaptationHistory: [
                        ...(safeAgent.autonomyState?.adaptationHistory || []),
                        {
                            type: autonomyLevel.value > (safeAgent.autonomyState?.level.value || 0.6) 
                                ? 'increase' 
                                : 'decrease',
                            from: safeAgent.autonomyState?.level.value || 0.6,
                            to: autonomyLevel.value,
                            reason: 'Manual adjustment',
                            timestamp: new Date().toISOString()
                        }
                    ]
                }
            };
            
            onUpdateAutonomy(safeAgent.id, updates);
            
            // Also notify the extension
            vscode.postMessage({
                type: 'UPDATE_AGENT_AUTONOMY',
                payload: {
                    agentId: safeAgent.id,
                    autonomyLevel: newLevel
                }
            });
        }
    };

    // Toggle learning enabled
    const handleToggleLearning = () => {
        const newLearningEnabled = !safeAgent.learningEnabled;
        
        if (onUpdateAutonomy) {
            onUpdateAutonomy(safeAgent.id, {
                learningEnabled: newLearningEnabled
            });
        }
        
        // Notify the extension
        vscode.postMessage({
            type: 'UPDATE_AGENT_LEARNING',
            payload: {
                agentId: safeAgent.id,
                learningEnabled: newLearningEnabled
            }
        });
    };

    const handleSendDirectMessage = (message: string) => {
        const directMessage = {
            id: Date.now().toString(),
            sender: 'User',
            content: message,
            timestamp: new Date().toISOString(),
            type: 'user' as const,
            targetAgent: safeAgent.id
        };
        
        // Add message to UI immediately
        if (onSendMessage) {
            onSendMessage(safeAgent.id, message);
        }

        // Send message to extension
        vscode.postMessage({
            type: 'SEND_AGENT_MESSAGE',
            payload: {
                agentId: safeAgent.id,
                message,
                direct: true
            }
        });
    };

    const handleClearMessages = (e: React.MouseEvent) => {
        e.stopPropagation();
        vscode.postMessage({
            type: 'CLEAR_AGENT_MESSAGES',
            payload: {
                agentId: safeAgent.id
            }
        });
    };

    useEffect(() => {
        if ((showDirectChat || showMessagesPanel) && messages.some(m => !m.read)) {
            vscode.postMessage({
                type: 'MARK_MESSAGES_READ',
                payload: {
                    agentId: safeAgent.id,
                    messageIds: messages.filter(m => !m.read).map(m => m.id)
                }
            });
        }
    }, [showDirectChat, showMessagesPanel, messages, safeAgent.id]);

    const unreadMessages = messages.filter(m => !m.read).length;

    const handleDirectMessage = (e: React.MouseEvent) => {
        e.stopPropagation();
        setShowDirectChat(!showDirectChat);
    };

    // Get initials for avatar
    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map(part => part[0])
            .join('')
            .toUpperCase()
            .substring(0, 2);
    };

    // Calculate agent activity metrics
    const agentActivity = React.useMemo(() => {
        const agentMessages = messages.filter(m => m.sender === safeAgent.id);
        const totalMessages = agentMessages.length;
        const last24Hours = agentMessages.filter(m => {
            const messageTime = new Date(m.timestamp).getTime();
            const now = Date.now();
            return (now - messageTime) < 24 * 60 * 60 * 1000;
        }).length;
        
        return {
            totalMessages,
            last24Hours,
            averageLength: totalMessages > 0 
                ? Math.round(agentMessages.reduce((sum, m) => sum + m.content.length, 0) / totalMessages) 
                : 0
        };
    }, [messages, safeAgent.id]);

    // Get agent's teams
    const agentTeams = teams.filter(team => team.members.includes(safeAgent.id));
    
    // Get agent's tasks
    const agentTasks = tasks.filter(task => task.assignedTo === safeAgent.id);

    return (
        <div className={`agent-card ${selected ? 'selected' : ''} ${loadingAgent === safeAgent.id ? 'loading' : ''}`}>
            <div className="agent-card-header" onClick={() => onSelect?.(agent)}>
                <div className={`agent-avatar ${safeAgent.status}`}>
                    {getInitials(safeAgent.name)}
                </div>
                <div className="agent-info">
                    <h3 className="agent-name">{safeAgent.name}</h3>
                </div>
                {unreadMessages > 0 && (
                    <div className="unread-badge">{unreadMessages}</div>
                )}
            </div>
            
            <div className="agent-card-content" onClick={() => onSelect?.(agent)}>
                <div className="agent-card-description">
                    {agentDescription ? (
                        <p>{agentDescription}</p>
                    ) : (
                        <p>{safeAgent.description || safeAgent.backstory || `${safeAgent.role} agent working on the project.`}</p>
                    )}
                </div>
                
                {/* Settings Cog */}
                <div className="agent-settings-container">
                    <button 
                        className="settings-cog-button"
                        onClick={(e) => { 
                            e.stopPropagation();
                            setShowLearning(!showLearning);
                        }}
                        title="Agent Settings"
                    >
                        <Settings size={16} />
                    </button>
                    {showLearning && (
                        <div className="settings-popover" onClick={(e) => e.stopPropagation()}>
                            <div className="popover-header">
                                <h4>Agent Settings</h4>
                            </div>
                            <div className="popover-content">
                                <div className="popover-toggle">
                                    <label>
                                        <span>Learning {safeAgent.learningEnabled ? 'Enabled' : 'Disabled'}</span>
                                        <button 
                                            className={`toggle-button ${safeAgent.learningEnabled ? 'active' : ''}`}
                                            onClick={handleToggleLearning}
                                        >
                                            {safeAgent.learningEnabled ? 'On' : 'Off'}
                                        </button>
                                    </label>
                                </div>
                                <div className="popover-actions">
                                    <button 
                                        className="action-button" 
                                        onClick={() => {
                                            vscode.postMessage({
                                                type: 'CONFIGURE_AGENT',
                                                payload: {
                                                    agentId: safeAgent.id
                                                }
                                            });
                                            setShowLearning(false);
                                        }}
                                    >
                                        Configure Agent
                                    </button>
                                    <button 
                                        className="action-button" 
                                        onClick={() => {
                                            vscode.postMessage({
                                                type: 'VIEW_AGENT_METRICS',
                                                payload: {
                                                    agentId: safeAgent.id
                                                }
                                            });
                                            setShowLearning(false);
                                        }}
                                    >
                                        View Metrics
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                
                {/* Collapsible Sections */}
                <div className="agent-sections">
                    {/* Performance Metrics Section */}
                    <div className="agent-section">
                        <div className="agent-section-header" onClick={(e) => { e.stopPropagation(); setShowStats(!showStats); }}>
                            <span><Settings size={14} /> Performance</span>
                            {showStats ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </div>
                        
                        {showStats && (
                            <div className="agent-section-content">
                                {safeAgent.performanceMetrics ? (
                                    <div className="metrics-grid">
                                        <div className="metric">
                                            <span className="metric-label">Success Rate</span>
                                            <span className="metric-value">{(safeAgent.performanceMetrics.successRate * 100).toFixed(0)}%</span>
                                        </div>
                                        <div className="metric">
                                            <span className="metric-label">Task Time</span>
                                            <span className="metric-value">{safeAgent.performanceMetrics.taskCompletionTime.toFixed(1)}m</span>
                                        </div>
                                        <div className="metric">
                                            <span className="metric-label">Resource Usage</span>
                                            <span className="metric-value">{safeAgent.performanceMetrics.resourceUsage.toFixed(1)}</span>
                                        </div>
                                        <div className="metric">
                                            <span className="metric-label">Error Rate</span>
                                            <span className="metric-value">{(safeAgent.performanceMetrics.errorRate * 100).toFixed(1)}%</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="activity-metrics">
                                        <div className="metric">
                                            <span className="metric-label">Total Messages</span>
                                            <span className="metric-value">{agentActivity.totalMessages}</span>
                                        </div>
                                        <div className="metric">
                                            <span className="metric-label">Last 24h</span>
                                            <span className="metric-value">{agentActivity.last24Hours}</span>
                                        </div>
                                        <div className="metric">
                                            <span className="metric-label">Avg Length</span>
                                            <span className="metric-value">{agentActivity.averageLength} chars</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    
                    {/* Tools Section */}
                    <div className="agent-section">
                        <div className="agent-section-header" onClick={(e) => { e.stopPropagation(); setShowTools(!showTools); }}>
                            <span><Wrench size={14} /> Tools</span>
                            {showTools ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </div>
                        
                        {showTools && (
                            <div className="agent-section-content">
                                {safeAgent.tools && safeAgent.tools.length > 0 ? (
                                    <div className="tools-list">
                                        {safeAgent.tools.map((tool, index) => (
                                            <div key={index} className="tool-item">
                                                {typeof tool === 'string' 
                                                    ? tool 
                                                    : (tool as any).name || JSON.stringify(tool)}
                                                {typeof tool !== 'string' && (tool as any).description && (
                                                    <span className="tool-description">{(tool as any).description}</span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="empty-state">No tools assigned</p>
                                )}
                            </div>
                        )}
                    </div>
                    
                    {/* Teams Section */}
                    <div className="agent-section">
                        <div className="agent-section-header" onClick={(e) => { e.stopPropagation(); setShowTeams(!showTeams); }}>
                            <span><Users size={14} /> Teams</span>
                            {showTeams ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </div>
                        
                        {showTeams && (
                            <div className="agent-section-content">
                                {agentTeams.length > 0 ? (
                                    <div className="teams-list">
                                        {agentTeams.map(team => (
                                            <div key={team.id} className="team-item">
                                                {team.name}
                                                <span className="team-members">{team.members.length} members</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="empty-state">Not assigned to any teams</p>
                                )}
                            </div>
                        )}
                    </div>
                    
                    {/* Tasks Section */}
                    <div className="agent-section">
                        <div className="agent-section-header" onClick={(e) => { e.stopPropagation(); setShowTasks(!showTasks); }}>
                            <span><CheckSquare size={14} /> Tasks</span>
                            {showTasks ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </div>
                        
                        {showTasks && (
                            <div className="agent-section-content">
                                {agentTasks.length > 0 ? (
                                    <div className="tasks-list">
                                        {agentTasks.map(task => (
                                            <div key={task.id} className="task-item">
                                                <span className={`task-status ${task.status.toLowerCase()}`}></span>
                                                {task.title}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="empty-state">No active tasks</p>
                                )}
                            </div>
                        )}
                    </div>
                    
                    {/* Learning Section */}
                    <div className="agent-section">
                        <div className="agent-section-header" onClick={(e) => { e.stopPropagation(); setShowLearning(!showLearning); }}>
                            <span><Brain size={14} /> Learning</span>
                            {showLearning ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </div>
                        
                        {showLearning && (
                            <div className="agent-section-content">
                                <div className="learning-status">
                                    <div className="learning-indicator">
                                        <div className="learning-label">Status:</div>
                                        <div className={`learning-value ${safeAgent.learningEnabled ? 'enabled' : 'disabled'}`}>
                                            {safeAgent.learningEnabled ? 'Enabled' : 'Disabled'}
                                        </div>
                                    </div>
                                    
                                    <div className="learning-stats">
                                        <div className="learning-stat">
                                            <div className="learning-stat-label">Patterns Learned:</div>
                                            <div className="learning-stat-value">12</div>
                                        </div>
                                        <div className="learning-stat">
                                            <div className="learning-stat-label">Knowledge Base:</div>
                                            <div className="learning-stat-value">Active</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            
            <div className="agent-card-footer">
                <button 
                    className="agent-action-button primary"
                    onClick={handleDirectMessage}
                >
                    <MessageSquare size={14} />
                    Direct Message
                </button>
            </div>

            {/* Direct Chat Window - Moved outside the card content to be modal-like */}
            {showDirectChat && (
                <div className="direct-chat-overlay" onClick={(e) => { 
                    if (e.target === e.currentTarget) setShowDirectChat(false);
                }}>
                    <div className="direct-chat-container" onClick={(e) => e.stopPropagation()}>
                        <div className="direct-chat-header">
                            <h4>Direct Chat with {safeAgent.name}</h4>
                            <button 
                                className="close-chat-button"
                                onClick={() => setShowDirectChat(false)}
                            >
                                &times;
                            </button>
                        </div>
                        <div className="direct-chat-messages">
                            {messages
                                .filter(m => m.targetAgent === safeAgent.id || m.sender === safeAgent.id)
                                .map(message => (
                                    <div 
                                        key={message.id} 
                                        className={`chat-message ${message.sender === 'User' ? 'user-message' : 'agent-message'}`}
                                    >
                                        <div className="message-content">{message.content}</div>
                                        <div className="message-timestamp">
                                            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    </div>
                                ))
                            }
                            {messages.filter(m => m.targetAgent === safeAgent.id || m.sender === safeAgent.id).length === 0 && (
                                <div className="empty-chat-message">
                                    No direct messages with this agent yet. Send a message to start the conversation.
                                </div>
                            )}
                        </div>
                        <div className="direct-chat-input">
                            <form onSubmit={(e) => {
                                e.preventDefault();
                                const input = e.currentTarget.elements.namedItem('message') as HTMLInputElement;
                                if (input.value.trim()) {
                                    handleSendDirectMessage(input.value);
                                    input.value = '';
                                }
                            }}>
                                <input 
                                    type="text" 
                                    name="message" 
                                    placeholder={`Message ${safeAgent.name}...`}
                                    autoComplete="off"
                                    autoFocus
                                />
                                <button type="submit" className="send-button">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="22" y1="2" x2="11" y2="13"></line>
                                        <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                                    </svg>
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};