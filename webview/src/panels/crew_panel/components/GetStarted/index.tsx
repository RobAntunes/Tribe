import React, { useState, useEffect } from 'react';
import './styles.css';
import { AgentSpec } from '../../types';

declare const vscode: {
    postMessage<T = unknown>(message: T): void;
};

interface GetStartedProps {
    onSubmit?: (description: string) => void;
    onInitialize?: (projectData: any) => void;
    onCreateTeam?: (teamData: any) => void;
    onAddAgent?: (agentData: AgentSpec) => void;
}

export const GetStarted: React.FC<GetStartedProps> = ({ onSubmit, onInitialize, onCreateTeam, onAddAgent }) => {
    const [description, setDescription] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Handle messages from the extension
        const messageHandler = (event: MessageEvent) => {
            const message = event.data;
            switch (message.type) {
                case 'PROJECT_INITIALIZED':
                    setIsLoading(false);
                    onSubmit?.(description);
                    break;
                case 'error':
                    setError(message.payload);
                    setIsLoading(false);
                    break;
            }
        };

        window.addEventListener('message', messageHandler);
        return () => window.removeEventListener('message', messageHandler);
    }, [description, onSubmit]);

    const handleSubmit = async () => {
        if (description.trim()) {
            setIsLoading(true);
            setError(null);
            try {
                console.log('Sending createTeam message to extension');
                // Send message to extension host
                vscode.postMessage({
                    type: 'createTeam',
                    payload: {
                        description: description.trim()
                    }
                });
            } catch (error) {
                console.error('Error submitting project description:', error);
                setError('Failed to send request to extension');
                setIsLoading(false);
            }
        }
    };

    return (
        <div className="get-started get-started-tab">
            <div className="content">
                <h1>Welcome to Tribe</h1>
                <p className="subtitle">Let's get started by understanding your project</p>

                <div className="form">
                    <label htmlFor="project-description">
                        Describe your project and goals
                    </label>
                    <textarea
                        id="project-description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="I want to build..."
                        rows={9}
                    />
                    {error && (
                        <div className="error-message">
                            {error}
                        </div>
                    )}
                    <button
                        className="button primary"
                        onClick={handleSubmit}
                        disabled={!description.trim() || isLoading}
                    >
                        {isLoading ? 'Creating...' : 'Create My Team'}
                    </button>
                </div>

                <div className="info">
                    <p>
                        Based on your description, Tribe will create an optimal team
                        of AI agents tailored to your project's needs.
                    </p>
                </div>
            </div>
        </div>
    );
};