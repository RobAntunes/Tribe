import React from 'react';
import { Clock, AlertCircle, Check, X } from 'lucide-react';

interface Decision {
    id: string;
    type: 'architecture' | 'implementation' | 'review';
    description: string;
    options: string[];
    impact: 'high' | 'medium' | 'low';
    deadline?: Date;
}

interface DecisionHubProps {
    decisions: Decision[];
    onDecisionMade: (id: string, approved: boolean, option?: string) => void;
}

const DecisionHub: React.FC<DecisionHubProps> = ({ decisions, onDecisionMade }) => {
    const getImpactColor = (impact: string) => {
        switch (impact) {
            case 'high': return 'bg-red-100 text-red-800';
            case 'medium': return 'bg-yellow-100 text-yellow-800';
            case 'low': return 'bg-green-100 text-green-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    return (
        <div className="decision-hub">
            <div className="decision-list">
                {decisions.map(decision => (
                    <div key={decision.id} className="decision-card">
                        <div className="decision-header">
                            <span className={`impact-badge ${getImpactColor(decision.impact)}`}>
                                {decision.impact} impact
                            </span>
                            {decision.deadline && (
                                <div className="deadline">
                                    <Clock className="w-4 h-4" />
                                    <span>{new Date(decision.deadline).toLocaleString()}</span>
                                </div>
                            )}
                        </div>
                        <div className="decision-content">
                            <h3 className="decision-type">{decision.type}</h3>
                            <p className="decision-description">{decision.description}</p>
                            {decision.options.length > 0 && (
                                <div className="decision-options">
                                    {decision.options.map((option, index) => (
                                        <button
                                            key={index}
                                            className="option-button"
                                            onClick={() => onDecisionMade(decision.id, true, option)}
                                        >
                                            {option}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="decision-actions">
                            <button
                                className="approve-button"
                                onClick={() => onDecisionMade(decision.id, true)}
                            >
                                <Check className="w-4 h-4" />
                                Approve
                            </button>
                            <button
                                className="reject-button"
                                onClick={() => onDecisionMade(decision.id, false)}
                            >
                                <X className="w-4 h-4" />
                                Reject
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default DecisionHub;
