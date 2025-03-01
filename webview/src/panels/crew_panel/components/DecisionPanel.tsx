import React from 'react';
import './DecisionPanel.css';

interface Decision {
    id: string;
    type: 'architecture' | 'implementation' | 'review';
    description: string;
    options: string[];
    impact: 'high' | 'medium' | 'low';
    deadline?: Date;
}

interface DecisionPanelProps {
    decisions: Decision[];
    onAccept: (decisionId: string, option: string) => void;
    onReject: (decisionId: string) => void;
}

export const DecisionPanel: React.FC<DecisionPanelProps> = ({
    decisions,
    onAccept,
    onReject
}) => {
    return (
        <div className="decision-panel">
            {decisions.length === 0 ? (
                <div className="empty-state">
                    <p>No pending decisions</p>
                </div>
            ) : (
                decisions.map(decision => (
                    <div key={decision.id} className={`decision-card ${decision.impact}`}>
                        <div className="decision-header">
                            <span className={`type-badge ${decision.type}`}>
                                {decision.type}
                            </span>
                            <span className={`impact-badge ${decision.impact}`}>
                                {decision.impact} impact
                            </span>
                            {decision.deadline && (
                                <span className="deadline">
                                    Due by: {new Date(decision.deadline).toLocaleDateString()}
                                </span>
                            )}
                        </div>
                        
                        <div className="decision-content">
                            <p>{decision.description}</p>
                            
                            <div className="options-list">
                                {decision.options.map((option, index) => (
                                    <div key={index} className="option">
                                        <p>{option}</p>
                                        <button
                                            className="button primary"
                                            onClick={() => onAccept(decision.id, option)}
                                        >
                                            Accept
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                        
                        <div className="decision-footer">
                            <button
                                className="button ghost"
                                onClick={() => onReject(decision.id)}
                            >
                                Reject All
                            </button>
                        </div>
                    </div>
                ))
            )}
        </div>
    );
};
