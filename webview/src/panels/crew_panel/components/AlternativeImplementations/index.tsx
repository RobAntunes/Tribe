import React, { useState } from 'react';
import { Lightbulb, CheckCircle, X, ArrowRight, Code, ChevronRight, ChevronDown, Check } from 'lucide-react';
import './styles.css';

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
  const [selectedImplementation, setSelectedImplementation] = useState<string | null>(
    implementations.length > 0 ? implementations[0].id : null
  );
  const [expandedFileLists, setExpandedFileLists] = useState<Record<string, boolean>>({});
  const [viewingFile, setViewingFile] = useState<{
    implId: string;
    path: string;
    content: string;
    type: 'modify' | 'create';
  } | null>(null);

  const toggleFileList = (implId: string) => {
    setExpandedFileLists({
      ...expandedFileLists,
      [implId]: !expandedFileLists[implId]
    });
  };

  const viewFile = (implId: string, path: string, content: string, type: 'modify' | 'create') => {
    setViewingFile({ implId, path, content, type });
  };

  const closeFileView = () => {
    setViewingFile(null);
  };

  if (implementations.length === 0) {
    return (
      <div className="alternative-implementations empty-state">
        <Lightbulb size={48} className="text-yellow-500" />
        <h3>No Alternative Implementations</h3>
        <p>There are currently no alternative implementations to review.</p>
        <button className="dismiss-button" onClick={onDismiss}>
          <X size={16} />
          Dismiss
        </button>
      </div>
    );
  }

  const activeImplementation = implementations.find(impl => impl.id === selectedImplementation) || null;

  return (
    <div className="alternative-implementations">
      {viewingFile ? (
        <div className="file-view">
          <div className="file-view-header">
            <h3>{viewingFile.path}</h3>
            <button className="close-button" onClick={closeFileView}>
              <X size={16} />
              Close
            </button>
          </div>
          <div className="file-view-content">
            <pre>{viewingFile.content}</pre>
          </div>
        </div>
      ) : (
        <>
          <div className="implementations-list">
            <div className="implementations-header">
              <h3>Alternative Implementations ({implementations.length})</h3>
              <button className="dismiss-button" onClick={onDismiss}>
                <X size={16} />
                Dismiss
              </button>
            </div>
            {implementations.map((implementation) => (
              <div
                key={implementation.id}
                className={`implementation-item ${selectedImplementation === implementation.id ? 'selected' : ''}`}
                onClick={() => setSelectedImplementation(implementation.id)}
              >
                <div className="implementation-item-icon">
                  <Lightbulb size={18} />
                </div>
                <div className="implementation-item-content">
                  <div className="implementation-item-title">
                    {implementation.title}
                  </div>
                  <div className="implementation-item-files">
                    {implementation.files.modify.length + implementation.files.create.length + implementation.files.delete.length} file(s) affected
                  </div>
                </div>
                <div className="implementation-item-selector">
                  {selectedImplementation === implementation.id ? <CheckCircle size={18} /> : <div className="selector-circle" />}
                </div>
              </div>
            ))}
          </div>

          {activeImplementation && (
            <div className="implementation-details">
              <div className="implementation-header">
                <h3>{activeImplementation.title}</h3>
                <button 
                  className="select-button"
                  onClick={() => onSelect(activeImplementation.id)}
                >
                  <Check size={16} />
                  Select This Implementation
                </button>
              </div>
              
              <div className="implementation-description">
                <p>{activeImplementation.description}</p>
              </div>
              
              <div className="implementation-tradeoffs">
                <h4>Tradeoffs</h4>
                <div className="tradeoffs-grid">
                  <div className="pros">
                    <h5>Pros</h5>
                    <ul>
                      {activeImplementation.tradeoffs.pros.map((pro, index) => (
                        <li key={index}>{pro}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="cons">
                    <h5>Cons</h5>
                    <ul>
                      {activeImplementation.tradeoffs.cons.map((con, index) => (
                        <li key={index}>{con}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
              
              <div className="implementation-files">
                <div 
                  className="files-header"
                  onClick={() => toggleFileList(activeImplementation.id)}
                >
                  {expandedFileLists[activeImplementation.id] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  <h4>Files Changed</h4>
                  <span className="file-count">
                    {activeImplementation.files.modify.length + activeImplementation.files.create.length + activeImplementation.files.delete.length} files
                  </span>
                </div>
                
                {expandedFileLists[activeImplementation.id] && (
                  <div className="files-list">
                    {activeImplementation.files.modify.length > 0 && (
                      <div className="file-type-group">
                        <div className="file-type-header">Modified</div>
                        {activeImplementation.files.modify.map((file, index) => (
                          <div 
                            key={index}
                            className="file-item"
                            onClick={() => viewFile(activeImplementation.id, file.path, file.content, 'modify')}
                          >
                            <Code size={14} />
                            <span>{file.path}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {activeImplementation.files.create.length > 0 && (
                      <div className="file-type-group">
                        <div className="file-type-header">Created</div>
                        {activeImplementation.files.create.map((file, index) => (
                          <div 
                            key={index}
                            className="file-item"
                            onClick={() => viewFile(activeImplementation.id, file.path, file.content, 'create')}
                          >
                            <Code size={14} />
                            <span>{file.path}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {activeImplementation.files.delete.length > 0 && (
                      <div className="file-type-group">
                        <div className="file-type-header">Deleted</div>
                        {activeImplementation.files.delete.map((path, index) => (
                          <div key={index} className="file-item">
                            <Code size={14} />
                            <span>{path}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};