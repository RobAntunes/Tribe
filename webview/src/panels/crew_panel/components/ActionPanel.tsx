import React, { useState } from 'react';
import './ActionPanel.css';

interface ActionPanelProps {
    onCreateAgent: (description: string) => void;
    onCreateTask: (description: string) => void;
    onCreateFlow: (description: string) => void;
    onCreateTool: (description: string) => void;
}

export const ActionPanel: React.FC<ActionPanelProps> = ({
    onCreateAgent,
    onCreateTask,
    onCreateFlow,
    onCreateTool
}) => {
    const [selectedAction, setSelectedAction] = useState<string | null>(null);
    const [description, setDescription] = useState('');

    const handleSubmit = () => {
        if (!selectedAction || !description.trim()) return;

        switch (selectedAction) {
            case 'agent':
                onCreateAgent(description);
                break;
            case 'task':
                onCreateTask(description);
                break;
            case 'flow':
                onCreateFlow(description);
                break;
            case 'tool':
                onCreateTool(description);
                break;
        }

        setDescription('');
        setSelectedAction(null);
    };

    const actions = [
        { id: 'agent', label: 'Create Agent', description: 'Create a new AI agent with specific capabilities' },
        { id: 'task', label: 'Create Task', description: 'Create a new task to be assigned to agents' },
        { id: 'flow', label: 'Create Flow', description: 'Create a new workflow or process' },
        { id: 'tool', label: 'Create Tool', description: 'Create a new tool for agents to use' }
    ];

    return (
        <div className="action-panel">
            {!selectedAction ? (
                <div className="action-grid">
                    {actions.map(action => (
                        <button
                            key={action.id}
                            className="action-button"
                            onClick={() => setSelectedAction(action.id)}
                        >
                            <h3>{action.label}</h3>
                            <p>{action.description}</p>
                        </button>
                    ))}
                </div>
            ) : (
                <div className="action-form">
                    <h2>{actions.find(a => a.id === selectedAction)?.label}</h2>
                    <textarea
                        className="description-input"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Describe your needs..."
                        rows={6}
                    />
                    <div className="button-group">
                        <button 
                            className="button ghost"
                            onClick={() => setSelectedAction(null)}
                        >
                            Cancel
                        </button>
                        <button
                            className="button primary"
                            onClick={handleSubmit}
                            disabled={!description.trim()}
                        >
                            Create
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
