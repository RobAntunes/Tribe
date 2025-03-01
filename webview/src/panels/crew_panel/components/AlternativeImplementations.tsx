import React, { useState } from 'react';
import { Check, X, ChevronDown, ChevronRight, Info, ArrowRight } from 'lucide-react';
import './AlternativeImplementations.css';

interface Implementation {
    id: string;
    title: string;
    description: string;
    tradeoffs: {
        pros: string[];
        cons: string[];
    };
    files: {
        modify: Array<{ path: string; content: string; originalContent?: string }>;
        create: Array<{ path: string; content: string }>;
        delete: string[];
    };
}

interface AlternativeImplementationsProps {
    implementations: Implementation[];
    onSelect: (implementationId: string) => void;
    onDismiss: () => void;
}

export const AlternativeImplementations: React.FC<AlternativeImplementationsProps> = ({
    implementations,
    onSelect,
    onDismiss
}) => {
    const [expandedImplementations, setExpandedImplementations] = useState<Set<string>>(new Set([implementations[0]?.id]));
    const [selectedImplementation, setSelectedImplementation] = useState<string | null>(null);
    const [expandedTradeoffs, setExpandedTradeoffs] = useState<Set<string>>(new Set());

    const toggleImplementation = (id: string) => {
        const newExpanded = new Set(expandedImplementations);
        if (newExpanded.has(id)) {
            newExpanded.delete(id);
        } else {
            newExpanded.add(id);
        }
        setExpandedImplementations(newExpanded);
    };

    const toggleTradeoffs = (id: string) => {
        const newExpanded = new Set(expandedTradeoffs);
        if (newExpanded.has(id)) {
            newExpanded.delete(id);
        } else {
            newExpanded.add(id);
        }
        setExpandedTradeoffs(newExpanded);
    };

    const handleSelect = (id: string) => {
        setSelectedImplementation(id);
        onSelect(id);
    };

    if (implementations.length === 0) {
        return (
            <div className="alternative-implementations empty">
                <div className="empty-state">
                    <h3>No Alternative Implementations</h3>
                    <p>There are no alternative implementations to review.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="alternative-implementations">
            <div className="implementations-header">
                <h2>Alternative Implementations</h2>
                <p className="implementations-description">
                    The agents have identified multiple ways to implement this feature with different tradeoffs.
                    Review each option and select the one that best fits your requirements.
                </p>
            </div>

            <div className="implementations-list">
                {implementations.map((implementation) => (
                    <div 
                        key={implementation.id} 
                        className={`implementation-item ${selectedImplementation === implementation.id ? 'selected' : ''}`}
                    >
                        <div 
                            className="implementation-header"
                            onClick={() => toggleImplementation(implementation.id)}
                        >
                            {expandedImplementations.has(implementation.id) ? 
                                <ChevronDown size={16} /> : 
                                <ChevronRight size={16} />
                            }
                            <h3 className="implementation-title">{implementation.title}</h3>
                            <div className="implementation-file-count">
                                {implementation.files.modify.length + implementation.files.create.length + implementation.files.delete.length} files
                            </div>
                        </div>

                        {expandedImplementations.has(implementation.id) && (
                            <div className="implementation-details">
                                <p className="implementation-description">{implementation.description}</p>
                                
                                <div className="implementation-tradeoffs">
                                    <div 
                                        className="tradeoffs-header"
                                        onClick={() => toggleTradeoffs(implementation.id)}
                                    >
                                        {expandedTradeoffs.has(implementation.id) ? 
                                            <ChevronDown size={16} /> : 
                                            <ChevronRight size={16} />
                                        }
                                        <h4>Tradeoffs</h4>
                                    </div>
                                    
                                    {expandedTradeoffs.has(implementation.id) && (
                                        <div className="tradeoffs-content">
                                            <div className="pros">
                                                <h5>Pros</h5>
                                                <ul>
                                                    {implementation.tradeoffs.pros.map((pro, index) => (
                                                        <li key={index}>{pro}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                            <div className="cons">
                                                <h5>Cons</h5>
                                                <ul>
                                                    {implementation.tradeoffs.cons.map((con, index) => (
                                                        <li key={index}>{con}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                
                                <div className="implementation-files-summary">
                                    <h4>Files to be Changed</h4>
                                    <div className="files-summary">
                                        {implementation.files.modify.length > 0 && (
                                            <div className="file-type">
                                                <span className="file-type-label">Modified:</span>
                                                <span className="file-count">{implementation.files.modify.length}</span>
                                            </div>
                                        )}
                                        {implementation.files.create.length > 0 && (
                                            <div className="file-type">
                                                <span className="file-type-label">Created:</span>
                                                <span className="file-count">{implementation.files.create.length}</span>
                                            </div>
                                        )}
                                        {implementation.files.delete.length > 0 && (
                                            <div className="file-type">
                                                <span className="file-type-label">Deleted:</span>
                                                <span className="file-count">{implementation.files.delete.length}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                
                                <div className="implementation-actions">
                                    <button 
                                        className="select-button"
                                        onClick={() => handleSelect(implementation.id)}
                                    >
                                        <Check size={16} />
                                        Select This Implementation
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
            
            <div className="implementations-actions">
                <button 
                    className="dismiss-button"
                    onClick={onDismiss}
                >
                    <X size={16} />
                    Dismiss All
                </button>
            </div>
        </div>
    );
}; 