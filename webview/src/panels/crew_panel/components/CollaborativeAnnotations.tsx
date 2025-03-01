import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, User, Bot, Send, X, Edit, Trash2, FileCode, ExternalLink } from 'lucide-react';
import './CollaborativeAnnotations.css';
import { getVsCodeApi } from '../../../vscode';

// Initialize VS Code API
const vscode = getVsCodeApi();

interface Annotation {
    id: string;
    content: string;
    author: {
        id: string;
        name: string;
        type: 'human' | 'agent';
    };
    timestamp: string;
    filePath?: string;
    lineStart?: number;
    lineEnd?: number;
    codeSnippet?: string;
    replies: Annotation[];
}

interface CollaborativeAnnotationsProps {
    annotations: Annotation[];
    currentUser: {
        id: string;
        name: string;
    };
    agents: Array<{
        id: string;
        name: string;
    }>;
    onAddAnnotation: (annotation: Omit<Annotation, 'id' | 'timestamp' | 'replies'>) => void;
    onEditAnnotation: (id: string, content: string) => void;
    onDeleteAnnotation: (id: string) => void;
    onReplyToAnnotation: (parentId: string, reply: Omit<Annotation, 'id' | 'timestamp' | 'replies'>) => void;
    onViewInEditor?: (filePath: string, lineStart?: number, lineEnd?: number) => void;
}

export const CollaborativeAnnotations: React.FC<CollaborativeAnnotationsProps> = ({
    annotations,
    currentUser,
    agents,
    onAddAnnotation,
    onEditAnnotation,
    onDeleteAnnotation,
    onReplyToAnnotation,
    onViewInEditor
}) => {
    const [newAnnotation, setNewAnnotation] = useState('');
    const [replyContent, setReplyContent] = useState<Record<string, string>>({});
    const [editingAnnotation, setEditingAnnotation] = useState<string | null>(null);
    const [editContent, setEditContent] = useState('');
    const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set());
    
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const editInputRef = useRef<HTMLTextAreaElement>(null);
    
    useEffect(() => {
        if (editingAnnotation && editInputRef.current) {
            editInputRef.current.focus();
        }
    }, [editingAnnotation]);
    
    const handleSubmitAnnotation = () => {
        if (newAnnotation.trim()) {
            onAddAnnotation({
                content: newAnnotation.trim(),
                author: {
                    id: currentUser.id,
                    name: currentUser.name,
                    type: 'human'
                }
            });
            setNewAnnotation('');
        }
    };
    
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmitAnnotation();
        }
    };
    
    const handleStartEditing = (annotation: Annotation) => {
        setEditingAnnotation(annotation.id);
        setEditContent(annotation.content);
    };
    
    const handleCancelEditing = () => {
        setEditingAnnotation(null);
        setEditContent('');
    };
    
    const handleSaveEdit = (id: string) => {
        if (editContent.trim()) {
            onEditAnnotation(id, editContent.trim());
            setEditingAnnotation(null);
            setEditContent('');
        }
    };
    
    const handleReplyKeyDown = (e: React.KeyboardEvent, annotationId: string) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmitReply(annotationId);
        }
    };
    
    const handleSubmitReply = (annotationId: string) => {
        const content = replyContent[annotationId];
        if (content && content.trim()) {
            onReplyToAnnotation(annotationId, {
                content: content.trim(),
                author: {
                    id: currentUser.id,
                    name: currentUser.name,
                    type: 'human'
                }
            });
            setReplyContent(prev => ({
                ...prev,
                [annotationId]: ''
            }));
        }
    };
    
    const toggleThread = (id: string) => {
        const newExpanded = new Set(expandedThreads);
        if (newExpanded.has(id)) {
            newExpanded.delete(id);
        } else {
            newExpanded.add(id);
        }
        setExpandedThreads(newExpanded);
    };
    
    const formatTimestamp = (timestamp: string) => {
        const date = new Date(timestamp);
        return date.toLocaleString();
    };
    
    const handleViewInEditor = (filePath: string, lineStart?: number, lineEnd?: number) => {
        if (onViewInEditor) {
            onViewInEditor(filePath, lineStart, lineEnd);
        } else {
            // Default implementation using VS Code API
            vscode.postMessage({
                type: 'viewFile',
                payload: { 
                    filePath, 
                    lineStart, 
                    lineEnd 
                }
            });
        }
    };
    
    const renderAnnotation = (annotation: Annotation, isReply = false) => {
        const isEditing = editingAnnotation === annotation.id;
        
        return (
            <div 
                key={annotation.id} 
                className={`annotation ${isReply ? 'reply' : ''} ${annotation.author.type}`}
            >
                <div className="annotation-header">
                    <div className="author-info">
                        {annotation.author.type === 'human' ? (
                            <User size={16} className="author-icon human" />
                        ) : (
                            <Bot size={16} className="author-icon agent" />
                        )}
                        <span className="author-name">{annotation.author.name}</span>
                    </div>
                    <span className="annotation-time">
                        {formatTimestamp(annotation.timestamp)}
                    </span>
                </div>
                
                {isEditing ? (
                    <div className="edit-annotation">
                        <textarea
                            ref={editInputRef}
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            className="edit-textarea"
                            placeholder="Edit your annotation..."
                        />
                        <div className="edit-actions">
                            <button 
                                className="save-button"
                                onClick={() => handleSaveEdit(annotation.id)}
                            >
                                Save
                            </button>
                            <button 
                                className="cancel-button"
                                onClick={handleCancelEditing}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="annotation-content">
                            {annotation.content}
                        </div>
                        
                        {annotation.codeSnippet && (
                            <div className="code-snippet">
                                <div className="code-header">
                                    {annotation.filePath && (
                                        <div className="file-info">
                                            <span className="file-path">{annotation.filePath}</span>
                                            <button 
                                                className="view-in-editor-button"
                                                onClick={() => handleViewInEditor(
                                                    annotation.filePath!, 
                                                    annotation.lineStart, 
                                                    annotation.lineEnd
                                                )}
                                                title="View in editor"
                                            >
                                                <ExternalLink size={14} />
                                            </button>
                                        </div>
                                    )}
                                    {annotation.lineStart && annotation.lineEnd && (
                                        <span className="line-range">
                                            Lines {annotation.lineStart}-{annotation.lineEnd}
                                        </span>
                                    )}
                                </div>
                                <pre className="code-content">{annotation.codeSnippet}</pre>
                            </div>
                        )}
                        
                        <div className="annotation-actions">
                            {!isReply && (
                                <button 
                                    className="action-button reply-button"
                                    onClick={() => toggleThread(annotation.id)}
                                >
                                    <MessageSquare size={14} />
                                    {annotation.replies.length > 0 
                                        ? `${annotation.replies.length} ${annotation.replies.length === 1 ? 'reply' : 'replies'}` 
                                        : 'Reply'}
                                </button>
                            )}
                            
                            {annotation.filePath && (
                                <button 
                                    className="action-button view-code-button"
                                    onClick={() => handleViewInEditor(
                                        annotation.filePath!, 
                                        annotation.lineStart, 
                                        annotation.lineEnd
                                    )}
                                >
                                    <FileCode size={14} />
                                    View Code
                                </button>
                            )}
                            
                            {annotation.author.id === currentUser.id && (
                                <>
                                    <button 
                                        className="action-button edit-button"
                                        onClick={() => handleStartEditing(annotation)}
                                    >
                                        <Edit size={14} />
                                        Edit
                                    </button>
                                    <button 
                                        className="action-button delete-button"
                                        onClick={() => onDeleteAnnotation(annotation.id)}
                                    >
                                        <Trash2 size={14} />
                                        Delete
                                    </button>
                                </>
                            )}
                        </div>
                    </>
                )}
                
                {!isReply && expandedThreads.has(annotation.id) && (
                    <div className="replies-container">
                        {annotation.replies.map(reply => renderAnnotation(reply, true))}
                        
                        <div className="reply-input">
                            <textarea
                                value={replyContent[annotation.id] || ''}
                                onChange={(e) => setReplyContent(prev => ({
                                    ...prev,
                                    [annotation.id]: e.target.value
                                }))}
                                onKeyDown={(e) => handleReplyKeyDown(e, annotation.id)}
                                placeholder="Write a reply..."
                                className="reply-textarea"
                            />
                            <button 
                                className="send-reply-button"
                                onClick={() => handleSubmitReply(annotation.id)}
                                disabled={!replyContent[annotation.id]?.trim()}
                            >
                                <Send size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="collaborative-annotations">
            <div className="annotations-header">
                <h3>
                    <MessageSquare size={18} />
                    Collaborative Annotations
                </h3>
                <p className="annotations-description">
                    Add comments, questions, or suggestions about the code. Both humans and agents can participate in the discussion.
                </p>
            </div>
            
            <div className="annotations-list">
                {annotations.length > 0 ? (
                    annotations.map(annotation => renderAnnotation(annotation))
                ) : (
                    <div className="empty-annotations">
                        <p>No annotations yet. Start the conversation by adding a comment.</p>
                    </div>
                )}
            </div>
            
            <div className="new-annotation">
                <textarea
                    ref={inputRef}
                    value={newAnnotation}
                    onChange={(e) => setNewAnnotation(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Add a new annotation..."
                    className="annotation-textarea"
                />
                <button 
                    className="send-button"
                    onClick={handleSubmitAnnotation}
                    disabled={!newAnnotation.trim()}
                >
                    <Send size={18} />
                </button>
            </div>
        </div>
    );
}; 