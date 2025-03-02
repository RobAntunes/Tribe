import React, { useState } from 'react';
import { Brain, BookOpen, ArrowUpRight, Zap, CheckCircle, ChevronDown, ChevronUp, Download, Search } from 'lucide-react';
import './styles.css';

interface Experience {
  id: string;
  agent_id: string;
  context: Record<string, any>;
  decision: string;
  outcome: Record<string, any>;
  timestamp: number;
}

interface Pattern {
  id: string;
  agent_id: string;
  topic: string;
  correlation: {
    type: string;
    factors: string[];
    strength: number;
    description: string;
  };
  generated_on: number;
  applied_count: number;
  success_rate: number;
}

interface LearningSystemProps {
  experiences?: Experience[];
  patterns?: Pattern[];
  agentNames: Record<string, string>;
  onCaptureExperience?: (experience: Omit<Experience, 'id' | 'timestamp'>) => Promise<any>;
  onExtractPatterns?: (agentId: string, topic: string) => Promise<any>;
}

export const LearningSystem: React.FC<LearningSystemProps> = ({
  experiences = [],
  patterns = [],
  agentNames,
  onCaptureExperience,
  onExtractPatterns
}) => {
  const [activeTab, setActiveTab] = useState<'experiences' | 'patterns'>('experiences');
  const [showCaptureForm, setShowCaptureForm] = useState(false);
  const [showExtractForm, setShowExtractForm] = useState(false);
  const [expandedExperiences, setExpandedExperiences] = useState<string[]>([]);
  const [expandedPatterns, setExpandedPatterns] = useState<string[]>([]);
  
  // Form states for capturing experience
  const [agentId, setAgentId] = useState('');
  const [contextValue, setContextValue] = useState('');
  const [decision, setDecision] = useState('');
  const [outcomeValue, setOutcomeValue] = useState('');
  const [isCapturing, setIsCapturing] = useState(false);
  
  // Form states for extracting patterns
  const [extractAgentId, setExtractAgentId] = useState('');
  const [topic, setTopic] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  
  const toggleExperienceExpand = (id: string) => {
    setExpandedExperiences(prev => 
      prev.includes(id) ? prev.filter(eId => eId !== id) : [...prev, id]
    );
  };
  
  const togglePatternExpand = (id: string) => {
    setExpandedPatterns(prev => 
      prev.includes(id) ? prev.filter(pId => pId !== id) : [...prev, id]
    );
  };
  
  const handleCaptureExperience = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCapturing(true);
    
    try {
      const context = JSON.parse(contextValue);
      const outcome = JSON.parse(outcomeValue);
      
      if (onCaptureExperience) {
        await onCaptureExperience({
          agent_id: agentId,
          context,
          decision,
          outcome
        });
        
        // Reset form on success
        setAgentId('');
        setContextValue('');
        setDecision('');
        setOutcomeValue('');
        setShowCaptureForm(false);
      }
    } catch (error) {
      console.error('Error capturing experience:', error);
      alert('Error: Please ensure all JSON fields are properly formatted.');
    } finally {
      setIsCapturing(false);
    }
  };
  
  const handleExtractPatterns = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsExtracting(true);
    
    try {
      if (onExtractPatterns) {
        await onExtractPatterns(extractAgentId, topic);
        // Reset form on success
        setShowExtractForm(false);
      }
    } catch (error) {
      console.error('Error extracting patterns:', error);
    } finally {
      setIsExtracting(false);
    }
  };
  
  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };
  
  const getAgentName = (id: string) => {
    return agentNames[id] || id;
  };
  
  const downloadJson = (data: any, filename: string) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  return (
    <div className="learning-system tribe-card">
      <div className="learning-system-header">
        <div className="learning-system-icon">
          <Brain size={24} />
        </div>
        <h2>Learning System</h2>
      </div>
      
      <div className="learning-system-tabs">
        <button 
          className={`learning-system-tab ${activeTab === 'experiences' ? 'active' : ''}`}
          onClick={() => setActiveTab('experiences')}
        >
          <BookOpen size={16} />
          <span>Experiences</span>
        </button>
        <button 
          className={`learning-system-tab ${activeTab === 'patterns' ? 'active' : ''}`}
          onClick={() => setActiveTab('patterns')}
        >
          <Zap size={16} />
          <span>Patterns</span>
        </button>
      </div>
      
      <div className="learning-system-content">
        {activeTab === 'experiences' ? (
          <div className="experiences-tab">
            <div className="tab-actions">
              <button 
                className="action-button"
                onClick={() => setShowCaptureForm(!showCaptureForm)}
              >
                <ArrowUpRight size={16} />
                {showCaptureForm ? 'Cancel' : 'Capture Experience'}
              </button>
            </div>
            
            {showCaptureForm && (
              <div className="capture-form-container">
                <h3>Capture New Experience</h3>
                <form onSubmit={handleCaptureExperience}>
                  <div className="form-group">
                    <label htmlFor="agentId">Agent</label>
                    <select
                      id="agentId"
                      value={agentId}
                      onChange={(e) => setAgentId(e.target.value)}
                      required
                    >
                      <option value="">Select an agent</option>
                      {Object.entries(agentNames).map(([id, name]) => (
                        <option key={id} value={id}>{name}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="context">Context (JSON)</label>
                    <textarea
                      id="context"
                      value={contextValue}
                      onChange={(e) => setContextValue(e.target.value)}
                      placeholder='{"task": "feature_implementation", "complexity": "high"}'
                      rows={3}
                      required
                    />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="decision">Decision</label>
                    <input
                      type="text"
                      id="decision"
                      value={decision}
                      onChange={(e) => setDecision(e.target.value)}
                      placeholder="e.g., delegate_to_specialist"
                      required
                    />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="outcome">Outcome (JSON)</label>
                    <textarea
                      id="outcome"
                      value={outcomeValue}
                      onChange={(e) => setOutcomeValue(e.target.value)}
                      placeholder='{"success": true, "time_taken": 120}'
                      rows={3}
                      required
                    />
                  </div>
                  
                  <div className="form-actions">
                    <button 
                      type="button" 
                      className="cancel-button"
                      onClick={() => setShowCaptureForm(false)}
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit" 
                      className="submit-button"
                      disabled={isCapturing}
                    >
                      {isCapturing ? (
                        <>
                          <div className="spinner"></div>
                          Capturing...
                        </>
                      ) : (
                        <>
                          <ArrowUpRight size={14} />
                          Capture Experience
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            )}
            
            <div className="experiences-list">
              <h3>Captured Experiences ({experiences.length})</h3>
              
              {experiences.length === 0 ? (
                <div className="empty-state">
                  <p>No experiences captured yet.</p>
                  <button 
                    className="action-button"
                    onClick={() => setShowCaptureForm(true)}
                  >
                    <ArrowUpRight size={16} />
                    Capture First Experience
                  </button>
                </div>
              ) : (
                <>
                  {experiences.map((experience) => (
                    <div 
                      key={experience.id} 
                      className={`experience-item ${expandedExperiences.includes(experience.id) ? 'expanded' : ''}`}
                    >
                      <div 
                        className="experience-header"
                        onClick={() => toggleExperienceExpand(experience.id)}
                      >
                        <div className="experience-title">
                          <span className="experience-decision">{experience.decision}</span>
                          <span className="experience-agent">{getAgentName(experience.agent_id)}</span>
                        </div>
                        <div className="experience-meta">
                          <span className="experience-time">{formatTimestamp(experience.timestamp)}</span>
                          <button className="expand-button">
                            {expandedExperiences.includes(experience.id) ? (
                              <ChevronUp size={16} />
                            ) : (
                              <ChevronDown size={16} />
                            )}
                          </button>
                        </div>
                      </div>
                      
                      {expandedExperiences.includes(experience.id) && (
                        <div className="experience-details">
                          <div className="detail-section">
                            <h4>Context</h4>
                            <pre>{JSON.stringify(experience.context, null, 2)}</pre>
                          </div>
                          
                          <div className="detail-section">
                            <h4>Outcome</h4>
                            <pre>{JSON.stringify(experience.outcome, null, 2)}</pre>
                          </div>
                          
                          <div className="experience-actions">
                            <button 
                              className="action-button-small"
                              onClick={() => downloadJson(experience, `experience-${experience.id}.json`)}
                            >
                              <Download size={14} />
                              Export
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="patterns-tab">
            <div className="tab-actions">
              <button 
                className="action-button"
                onClick={() => setShowExtractForm(!showExtractForm)}
              >
                <Search size={16} />
                {showExtractForm ? 'Cancel' : 'Extract Patterns'}
              </button>
            </div>
            
            {showExtractForm && (
              <div className="extract-form-container">
                <h3>Extract Patterns</h3>
                <form onSubmit={handleExtractPatterns}>
                  <div className="form-group">
                    <label htmlFor="extractAgentId">Agent</label>
                    <select
                      id="extractAgentId"
                      value={extractAgentId}
                      onChange={(e) => setExtractAgentId(e.target.value)}
                      required
                    >
                      <option value="">Select an agent</option>
                      {Object.entries(agentNames).map(([id, name]) => (
                        <option key={id} value={id}>{name}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="topic">Topic</label>
                    <input
                      type="text"
                      id="topic"
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      placeholder="e.g., feature_implementation"
                      required
                    />
                  </div>
                  
                  <div className="form-actions">
                    <button 
                      type="button" 
                      className="cancel-button"
                      onClick={() => setShowExtractForm(false)}
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit" 
                      className="submit-button"
                      disabled={isExtracting}
                    >
                      {isExtracting ? (
                        <>
                          <div className="spinner"></div>
                          Extracting...
                        </>
                      ) : (
                        <>
                          <Search size={14} />
                          Extract Patterns
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            )}
            
            <div className="patterns-list">
              <h3>Extracted Patterns ({patterns.length})</h3>
              
              {patterns.length === 0 ? (
                <div className="empty-state">
                  <p>No patterns extracted yet.</p>
                  <button 
                    className="action-button"
                    onClick={() => setShowExtractForm(true)}
                  >
                    <Search size={16} />
                    Extract First Pattern
                  </button>
                </div>
              ) : (
                <>
                  {patterns.map((pattern) => (
                    <div 
                      key={pattern.id} 
                      className={`pattern-item ${expandedPatterns.includes(pattern.id) ? 'expanded' : ''}`}
                    >
                      <div 
                        className="pattern-header"
                        onClick={() => togglePatternExpand(pattern.id)}
                      >
                        <div className="pattern-title">
                          <span className="pattern-topic">{pattern.topic}</span>
                          <span className="pattern-correlation-type">{pattern.correlation.type}</span>
                          <span className="pattern-agent">{getAgentName(pattern.agent_id)}</span>
                        </div>
                        <div className="pattern-meta">
                          <span className="pattern-success-rate">
                            <CheckCircle size={14} /> {(pattern.success_rate * 100).toFixed(0)}%
                          </span>
                          <button className="expand-button">
                            {expandedPatterns.includes(pattern.id) ? (
                              <ChevronUp size={16} />
                            ) : (
                              <ChevronDown size={16} />
                            )}
                          </button>
                        </div>
                      </div>
                      
                      {expandedPatterns.includes(pattern.id) && (
                        <div className="pattern-details">
                          <div className="detail-section">
                            <h4>Description</h4>
                            <p>{pattern.correlation.description}</p>
                          </div>
                          
                          <div className="detail-section">
                            <h4>Factors</h4>
                            <ul>
                              {pattern.correlation.factors.map((factor, i) => (
                                <li key={i}>{factor}</li>
                              ))}
                            </ul>
                          </div>
                          
                          <div className="detail-section">
                            <h4>Statistics</h4>
                            <div className="pattern-stats">
                              <div className="pattern-stat">
                                <span className="stat-label">Correlation Strength</span>
                                <span className="stat-value">{(pattern.correlation.strength * 100).toFixed(0)}%</span>
                              </div>
                              <div className="pattern-stat">
                                <span className="stat-label">Applied Count</span>
                                <span className="stat-value">{pattern.applied_count}</span>
                              </div>
                              <div className="pattern-stat">
                                <span className="stat-label">Success Rate</span>
                                <span className="stat-value">{(pattern.success_rate * 100).toFixed(0)}%</span>
                              </div>
                              <div className="pattern-stat">
                                <span className="stat-label">Generated On</span>
                                <span className="stat-value">{formatTimestamp(pattern.generated_on)}</span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="pattern-actions">
                            <button 
                              className="action-button-small"
                              onClick={() => downloadJson(pattern, `pattern-${pattern.id}.json`)}
                            >
                              <Download size={14} />
                              Export
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};