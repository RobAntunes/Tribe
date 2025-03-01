import React from 'react';

interface FlowOutputProps {
    result: any;
    onAction?: (action: string, data: any) => void;
}

export const FlowOutput: React.FC<FlowOutputProps> = ({ result, onAction }) => {
    if (!result) return null;

    return (
        <div className="flow-output-container">
            <div className="flow-result">
                {typeof result === 'string' ? (
                    <pre>{result}</pre>
                ) : (
                    <div className="result-object">
                        {Object.entries(result).map(([key, value]) => (
                            <div key={key} className="result-item">
                                <h4>{key}</h4>
                                <pre>{JSON.stringify(value, null, 2)}</pre>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
