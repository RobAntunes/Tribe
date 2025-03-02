import React, { useState } from 'react';
import { MessageSquare, Edit, Trash2, Reply, Send, User, UserCog } from 'lucide-react';
import './styles.css';

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
  onViewInEditor?: (filePath: string, lineNumber?: number) => void;
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
  const [editingAnnotation, setEditingAnnotation] = useState<{ id: string; content: string } | null>(null);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [lineStart, setLineStart] = useState<number | null>(null);
  const [lineEnd, setLineEnd] = useState<number | null>(null);
  const [codeSnippet, setCodeSnippet] = useState<string>('');

  const handleAddAnnotation = () => {
    if (newAnnotation.trim() === '') return;

    onAddAnnotation({
      content: newAnnotation,
      author: {
        id: currentUser.id,
        name: currentUser.name,
        type: 'human'
      },
      filePath: selectedFilePath || undefined,
      lineStart: lineStart || undefined,
      lineEnd: lineEnd || undefined,
      codeSnippet: codeSnippet || undefined
    });

    setNewAnnotation('');
    setSelectedFilePath(null);
    setLineStart(null);
    setLineEnd(null);
    setCodeSnippet('');
  };

  const handleEditAnnotation = () => {
    if (!editingAnnotation || editingAnnotation.content.trim() === '') return;

    onEditAnnotation(editingAnnotation.id, editingAnnotation.content);
    setEditingAnnotation(null);
  };

  const handleReplyToAnnotation = () => {
    if (!replyingTo || replyContent.trim() === '') return;

    onReplyToAnnotation(replyingTo, {
      content: replyContent,
      author: {
        id: currentUser.id,
        name: currentUser.name,
        type: 'human'
      }
    });

    setReplyingTo(null);
    setReplyContent('');
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  const getUniqueFilePaths = () => {
    const paths = new Set<string>();
    annotations.forEach(annotation => {
      if (annotation.filePath) {
        paths.add(annotation.filePath);
      }
    });
    return Array.from(paths);
  };

  const renderAnnotation = (annotation: Annotation, level = 0) => {
    const isEditing = editingAnnotation && editingAnnotation.id === annotation.id;
    const isReplying = replyingTo === annotation.id;
    const isCurrentUser = annotation.author.id === currentUser.id;

    return (
      <div className={`annotation-item level-${level}`} key={annotation.id}>
        <div className="annotation-header">
          <div className="annotation-author">
            {annotation.author.type === 'human' ? (
              <User size={16} />
            ) : (
              <UserCog size={16} />
            )}
            <span>{annotation.author.name}</span>
          </div>
          <div className="annotation-timestamp">
            {formatDate(annotation.timestamp)}
          </div>
        </div>
        
        {annotation.filePath && (
          <div className="annotation-file-info">
            <span className="file-path">{annotation.filePath}</span>
            {annotation.lineStart && (
              <span className="line-range">
                {annotation.lineStart}{annotation.lineEnd && annotation.lineEnd !== annotation.lineStart ? `-${annotation.lineEnd}` : ''}
              </span>
            )}
          </div>
        )}
        
        {annotation.codeSnippet && (
          <div className="code-snippet">
            <pre>{annotation.codeSnippet}</pre>
          </div>
        )}
        
        {isEditing ? (
          <div className="edit-form">
            <textarea
              value={editingAnnotation.content}
              onChange={(e) => setEditingAnnotation({ ...editingAnnotation, content: e.target.value })}
              placeholder="Edit your annotation..."
            />
            <div className="edit-actions">
              <button onClick={handleEditAnnotation}>Save</button>
              <button onClick={() => setEditingAnnotation(null)}>Cancel</button>
            </div>
          </div>
        ) : (
          <div className="annotation-content">
            {annotation.content}
          </div>
        )}
        
        <div className="annotation-actions">
          <button
            className="reply-button"
            onClick={() => setReplyingTo(isReplying ? null : annotation.id)}
          >
            <Reply size={14} />
            Reply
          </button>
          
          {isCurrentUser && (
            <>
              <button
                className="edit-button"
                onClick={() => setEditingAnnotation({ id: annotation.id, content: annotation.content })}
              >
                <Edit size={14} />
                Edit
              </button>
              <button
                className="delete-button"
                onClick={() => onDeleteAnnotation(annotation.id)}
              >
                <Trash2 size={14} />
                Delete
              </button>
            </>
          )}
        </div>
        
        {isReplying && (
          <div className="reply-form">
            <textarea
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              placeholder="Add your reply..."
            />
            <div className="reply-actions">
              <button onClick={handleReplyToAnnotation}>
                <Send size={14} />
                Reply
              </button>
              <button onClick={() => setReplyingTo(null)}>Cancel</button>
            </div>
          </div>
        )}
        
        {annotation.replies.length > 0 && (
          <div className="annotation-replies">
            {annotation.replies.map(reply => renderAnnotation(reply, level + 1))}
          </div>
        )}
      </div>
    );
  };

  const filePaths = getUniqueFilePaths();

  return (
    <div className="collaborative-annotations">
      <div className="annotations-header">
        <h3>Annotations & Comments</h3>
      </div>
      
      <div className="add-annotation">
        <h4>Add New Annotation</h4>
        <div className="code-reference">
          <div className="field">
            <label>File Path (optional):</label>
            <select
              value={selectedFilePath || ''}
              onChange={(e) => setSelectedFilePath(e.target.value || null)}
            >
              <option value="">-- Select a file --</option>
              {filePaths.map(path => (
                <option key={path} value={path}>{path}</option>
              ))}
            </select>
          </div>
          
          {selectedFilePath && (
            <>
              <div className="line-numbers">
                <div className="field">
                  <label>Line Start:</label>
                  <input
                    type="number"
                    value={lineStart || ''}
                    onChange={(e) => setLineStart(e.target.value ? parseInt(e.target.value) : null)}
                  />
                </div>
                <div className="field">
                  <label>Line End:</label>
                  <input
                    type="number"
                    value={lineEnd || ''}
                    onChange={(e) => setLineEnd(e.target.value ? parseInt(e.target.value) : null)}
                  />
                </div>
              </div>
              
              <div className="field">
                <label>Code Snippet (optional):</label>
                <textarea
                  value={codeSnippet}
                  onChange={(e) => setCodeSnippet(e.target.value)}
                  placeholder="Paste relevant code here..."
                  rows={3}
                />
              </div>
            </>
          )}
        </div>
        
        <textarea
          value={newAnnotation}
          onChange={(e) => setNewAnnotation(e.target.value)}
          placeholder="Add your annotation or comment..."
          rows={4}
        />
        
        <button
          className="add-button"
          onClick={handleAddAnnotation}
          disabled={newAnnotation.trim() === ''}
        >
          <MessageSquare size={16} />
          Add Annotation
        </button>
      </div>
      
      <div className="annotations-list">
        <h4>All Annotations</h4>
        {annotations.length === 0 ? (
          <div className="empty-state">
            <MessageSquare size={32} />
            <p>No annotations yet. Add one to start the conversation!</p>
          </div>
        ) : (
          annotations.map(annotation => renderAnnotation(annotation))
        )}
      </div>
    </div>
  );
};