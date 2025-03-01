import React, { useState } from 'react';
import { Agent, AutonomyLevel, AutonomyState, DecisionCriteria } from '../types';
import './AgentAutonomyPanel.css';

interface AgentAutonomyPanelProps {
    agent: Agent;
    onUpdate?: (agentId: string, updates: Partial<Agent>) => void;
}

export const AgentAutonomyPanel: React.FC<AgentAutonomyPanelProps> = ({ agent, onUpdate }) => {
    // Create default autonomy state if not provided
    const defaultAutonomyState: AutonomyState = {
        level: { level: 'MEDIUM', value: 50, description: 'Default autonomy level' },
        taskTypes: {},
        performanceHistory: [],
        adaptationHistory: []
    };

    // Use agent's autonomy state or default
    const autonomyState = agent.autonomyState || defaultAutonomyState;
    
    // Create default performance metrics if not provided
    const defaultPerformanceMetrics = {
        successRate: 0,
        taskCompletionTime: 0,
        resourceUsage: 0,
        errorRate: 0
    };

    // Use agent's performance metrics or default
    const performanceMetrics = agent.performanceMetrics || defaultPerformanceMetrics;

    const [autonomyLevel, setAutonomyLevel] = useState<number>(autonomyState.level.value);

    const handleAutonomyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = parseInt(e.target.value);
        setAutonomyLevel(newValue);
        
        // Determine the level based on the value
        let level: 'FULL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'MINIMAL' = 'MEDIUM';
        if (newValue >= 80) level = 'FULL';
        else if (newValue >= 60) level = 'HIGH';
        else if (newValue >= 40) level = 'MEDIUM';
        else if (newValue >= 20) level = 'LOW';
        else level = 'MINIMAL';
        
        // Create the new autonomy state
        const newAutonomyState: AutonomyState = {
            ...autonomyState,
            level: {
                level,
                value: newValue,
                description: getDescriptionForLevel(level)
            }
        };
        
        // Update the agent
        if (onUpdate) {
            onUpdate(agent.id, {
                autonomyState: newAutonomyState
            });
        }
    };
    
    const getDescriptionForLevel = (level: 'FULL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'MINIMAL'): string => {
        switch (level) {
            case 'FULL':
                return 'Agent can make all decisions without human intervention';
            case 'HIGH':
                return 'Agent can make most decisions, only consulting humans for critical issues';
            case 'MEDIUM':
                return 'Agent makes routine decisions but consults humans for important ones';
            case 'LOW':
                return 'Agent suggests actions but requires human approval for most decisions';
            case 'MINIMAL':
                return 'Agent only provides information and requires human approval for all actions';
        }
    };

    const handleTaskCriteriaChange = (taskType: string, criteria: Partial<DecisionCriteria>) => {
        const updatedTaskTypes = {
            ...autonomyState.taskTypes,
            [taskType]: {
                ...autonomyState.taskTypes[taskType],
                ...criteria
            }
        };

        if (onUpdate) {
            onUpdate(agent.id, {
                autonomyState: {
                    ...autonomyState,
                    taskTypes: updatedTaskTypes
                }
            });
        }
    };

    return (
        <div className="agent-autonomy-panel">
            <h3>Autonomy Settings</h3>
            
            <div className="autonomy-level-section">
                <h4>Current Autonomy Level</h4>
                <div className="autonomy-slider">
                    <input
                        type="range"
                        min="0"
                        max="100"
                        value={autonomyLevel}
                        onChange={handleAutonomyChange}
                    />
                    <div className="autonomy-level">
                        {autonomyState.level.level} ({autonomyLevel}%)
                    </div>
                </div>
                <p className="autonomy-description">
                    {autonomyState.level.description}
                </p>
            </div>

            <div className="task-types-section">
                <h4>Task-Specific Settings</h4>
                {Object.entries(autonomyState.taskTypes).map(([taskType, criteria]) => (
                    <div key={taskType} className="task-type-criteria">
                        <h5>{taskType}</h5>
                        <div className="criteria-controls">
                            <label>
                                Confidence Threshold
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.1"
                                    value={criteria.confidenceThreshold}
                                    onChange={(e) => handleTaskCriteriaChange(taskType, {
                                        confidenceThreshold: parseFloat(e.target.value)
                                    })}
                                />
                                <span>{criteria.confidenceThreshold}</span>
                            </label>
                            <label>
                                Risk Tolerance
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.1"
                                    value={criteria.riskTolerance}
                                    onChange={(e) => handleTaskCriteriaChange(taskType, {
                                        riskTolerance: parseFloat(e.target.value)
                                    })}
                                />
                                <span>{criteria.riskTolerance}</span>
                            </label>
                            <label>
                                Required Approvals
                                <input
                                    type="number"
                                    min="0"
                                    max="5"
                                    value={criteria.requiredApprovals}
                                    onChange={(e) => handleTaskCriteriaChange(taskType, {
                                        requiredApprovals: parseInt(e.target.value)
                                    })}
                                />
                            </label>
                        </div>
                    </div>
                ))}
            </div>

            <div className="performance-metrics">
                <h4>Performance Metrics</h4>
                <div className="metrics-grid">
                    <div className="metric">
                        <label>Success Rate</label>
                        <span>{(performanceMetrics.successRate * 100).toFixed(1)}%</span>
                    </div>
                    <div className="metric">
                        <label>Task Completion Time</label>
                        <span>{performanceMetrics.taskCompletionTime.toFixed(2)}s</span>
                    </div>
                    <div className="metric">
                        <label>Resource Usage</label>
                        <span>{(performanceMetrics.resourceUsage * 100).toFixed(1)}%</span>
                    </div>
                    <div className="metric">
                        <label>Error Rate</label>
                        <span>{(performanceMetrics.errorRate * 100).toFixed(1)}%</span>
                    </div>
                </div>
            </div>

            <div className="adaptation-history">
                <h4>Adaptation History</h4>
                <div className="history-list">
                    {autonomyState.adaptationHistory.map((entry, index) => (
                        <div key={index} className="history-entry">
                            <span className={`change-type ${entry.type}`}>
                                {entry.type === 'increase' ? '↑' : '↓'}
                            </span>
                            <span className="change-details">
                                {entry.from}% → {entry.to}%
                            </span>
                            <span className="reason">{entry.reason}</span>
                            <span className="timestamp">
                                {new Date(entry.timestamp).toLocaleString()}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}; 