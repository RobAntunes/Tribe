import React, { useState, useEffect } from 'react';
import { MessageSquare, Search, Star, BarChart, ThumbsUp, ThumbsDown, Plus, ChevronDown, ChevronUp, Download, Filter } from 'lucide-react';
import './styles.css';

interface Feedback {
  id: string;
  source_id: string;
  target_id: string;
  feedback_type: string;
  content: {
    rating?: number;
    message?: string;
    [key: string]: any;
  };
  metadata?: Record<string, any>;
  timestamp: number;
}

interface FeedbackAnalysis {
  patterns: Array<{
    type: string;
    feedback_type: string;
    theme?: string;
    sentiment?: string;
    frequency: number;
    percentage: number;
    supporting_evidence?: string[];
  }>;
  recommendations: Array<{
    type: string;
    area?: string;
    feedback_type?: string;
    priority?: 'high' | 'medium' | 'low';
    confidence: number;
    suggestion: string;
  }>;
}

interface FeedbackSystemProps {
  onCollectFeedback: (sourceId: string, targetId: string, feedbackType: string, content: any, metadata?: any) => Promise<any>;
  onAnalyzeFeedback: (targetId: string, feedbackTypes?: string[], timeRange?: any) => Promise<any>;
  feedback?: Feedback[];
  analysis?: FeedbackAnalysis;
  agents: Array<{ id: string; name: string }>;
}

export const FeedbackSystem: React.FC<FeedbackSystemProps> = ({
  onCollectFeedback,
  onAnalyzeFeedback,
  feedback = [],
  analysis = { patterns: [], recommendations: [] },
  agents
}) => {
  const [activeTab, setActiveTab] = useState<'feedback' | 'analysis'>('feedback');
  const [isCollecting, setIsCollecting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // Form states for collecting feedback
  const [sourceId, setSourceId] = useState('user');
  const [targetId, setTargetId] = useState('');
  const [feedbackType, setFeedbackType] = useState('performance');
  const [rating, setRating] = useState(3);
  const [message, setMessage] = useState('');
  const [metadataValue, setMetadataValue] = useState('');
  
  // Form states for analyzing feedback
  const [analysisTargetId, setAnalysisTargetId] = useState('');
  const [feedbackTypesValue, setFeedbackTypesValue] = useState('');
  const [timeRangeStart, setTimeRangeStart] = useState('');
  const [timeRangeEnd, setTimeRangeEnd] = useState('');
  
  // UI states
  const [expandedFeedback, setExpandedFeedback] = useState<string[]>([]);
  const [expandedPatterns, setExpandedPatterns] = useState<string[]>([]);
  const [expandedRecommendations, setExpandedRecommendations] = useState<string[]>([]);
  const [showCollectForm, setShowCollectForm] = useState(false);
  const [showAnalyzeForm, setShowAnalyzeForm] = useState(false);
  
  const toggleFeedbackExpand = (id: string) => {
    setExpandedFeedback(prev => 
      prev.includes(id) ? prev.filter(fId => fId !== id) : [...prev, id]
    );
  };
  
  const togglePatternExpand = (id: string) => {
    setExpandedPatterns(prev => 
      prev.includes(id) ? prev.filter(pId => pId !== id) : [...prev, id]
    );
  };
  
  const toggleRecommendationExpand = (id: string) => {
    setExpandedRecommendations(prev => 
      prev.includes(id) ? prev.filter(rId => rId !== id) : [...prev, id]
    );
  };
  
  const handleCollectFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCollecting(true);
    
    try {
      const content = {
        rating,
        message
      };
      
      const metadata = metadataValue ? JSON.parse(metadataValue) : undefined;
      
      const result = await onCollectFeedback(
        sourceId,
        targetId,
        feedbackType,
        content,
        metadata
      );
      
      if (result.success) {
        // Reset form on success
        setTargetId('');
        setFeedbackType('performance');
        setRating(3);
        setMessage('');
        setMetadataValue('');
        setShowCollectForm(false);
      }
    } catch (error) {
      console.error('Error collecting feedback:', error);
    } finally {
      setIsCollecting(false);
    }
  };
  
  const handleAnalyzeFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAnalyzing(true);
    
    try {
      const feedbackTypes = feedbackTypesValue
        ? feedbackTypesValue.split(',').map(type => type.trim())
        : undefined;
        
      const timeRange = (timeRangeStart || timeRangeEnd)
        ? {
            start_time: timeRangeStart ? new Date(timeRangeStart).getTime() / 1000 : undefined,
            end_time: timeRangeEnd ? new Date(timeRangeEnd).getTime() / 1000 : undefined
          }
        : undefined;
        
      await onAnalyzeFeedback(
        analysisTargetId,
        feedbackTypes,
        timeRange
      );
    } catch (error) {
      console.error('Error analyzing feedback:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };
  
  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };
  
  const getAgentName = (agentId: string) => {
    if (agentId === 'user') return 'You';
    const agent = agents.find(a => a.id === agentId);
    return agent ? agent.name : agentId;
  };
  
  const renderStars = (rating: number) => {
    return Array(5).fill(0).map((_, i) => (
      <Star 
        key={i} 
        size={16} 
        className={i < rating ? 'star-filled' : 'star-empty'} 
      />
    ));
  };
  
  const getPriorityClass = (priority?: string) => {
    switch (priority) {
      case 'high': return 'priority-high';
      case 'medium': return 'priority-medium';
      case 'low': return 'priority-low';
      default: return '';
    }
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
    <div className="feedback-system tribe-card">
      <div className="feedback-system-header">
        <div className="feedback-system-icon">
          <MessageSquare size={24} />
        </div>
        <h2>Feedback System</h2>
      </div>
      
      <div className="feedback-system-tabs">
        <button 
          className={`feedback-system-tab ${activeTab === 'feedback' ? 'active' : ''}`}
          onClick={() => setActiveTab('feedback')}
        >
          <MessageSquare size={16} />
          <span>Feedback</span>
        </button>
        <button 
          className={`feedback-system-tab ${activeTab === 'analysis' ? 'active' : ''}`}
          onClick={() => setActiveTab('analysis')}
        >
          <BarChart size={16} />
          <span>Analysis</span>
        </button>
      </div>
      
      <div className="feedback-system-content">
        {activeTab === 'feedback' ? (
          <div className="feedback-tab">
            <div className="tab-actions">
              <button 
                className="action-button"
                onClick={() => setShowCollectForm(!showCollectForm)}
              >
                <Plus size={16} />
                {showCollectForm ? 'Cancel' : 'Collect Feedback'}
              </button>
            </div>
            
            {showCollectForm && (
              <div className="collect-form-container">
                <h3>Collect New Feedback</h3>
                <form onSubmit={handleCollectFeedback}>
                  <div className="form-group">
                    <label htmlFor="sourceId">Source</label>
                    <select
                      id="sourceId"
                      value={sourceId}
                      onChange={(e) => setSourceId(e.target.value)}
                      required
                    >
                      <option value="user">You</option>
                      {agents.map(agent => (
                        <option key={agent.id} value={agent.id}>{agent.name}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="targetId">Target</label>
                    <select
                      id="targetId"
                      value={targetId}
                      onChange={(e) => setTargetId(e.target.value)}
                      required
                    >
                      <option value="">Select a target</option>
                      {agents.map(agent => (
                        <option key={agent.id} value={agent.id}>{agent.name}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="feedbackType">Feedback Type</label>
                    <select
                      id="feedbackType"
                      value={feedbackType}
                      onChange={(e) => setFeedbackType(e.target.value)}
                      required
                    >
                      <option value="performance">Performance</option>
                      <option value="quality">Quality</option>
                      <option value="communication">Communication</option>
                      <option value="collaboration">Collaboration</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="rating">Rating</label>
                    <div className="rating-input">
                      <div className="rating-stars">
                        {[1, 2, 3, 4, 5].map((value) => (
                          <button
                            key={value}
                            type="button"
                            className={`star-button ${value <= rating ? 'active' : ''}`}
                            onClick={() => setRating(value)}
                          >
                            <Star size={24} />
                          </button>
                        ))}
                      </div>
                      <span className="rating-value">{rating}/5</span>
                    </div>
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="message">Message</label>
                    <textarea
                      id="message"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Provide detailed feedback..."
                      rows={3}
                      required
                    />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="metadata">Metadata (JSON, optional)</label>
                    <textarea
                      id="metadata"
                      value={metadataValue}
                      onChange={(e) => setMetadataValue(e.target.value)}
                      placeholder='{"context": "task completion", "importance": "high"}'
                      rows={2}
                    />
                  </div>
                  
                  <div className="form-actions">
                    <button 
                      type="button" 
                      className="cancel-button"
                      onClick={() => setShowCollectForm(false)}
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit" 
                      className="submit-button"
                      disabled={isCollecting}
                    >
                      {isCollecting ? (
                        <>
                          <div className="spinner"></div>
                          Submitting...
                        </>
                      ) : (
                        <>
                          <MessageSquare size={14} />
                          Submit Feedback
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            )}
            
            <div className="feedback-list">
              <h3>Collected Feedback ({feedback.length})</h3>
              
              {feedback.length === 0 ? (
                <div className="empty-state">
                  <p>No feedback collected yet.</p>
                  <button 
                    className="action-button"
                    onClick={() => setShowCollectForm(true)}
                  >
                    <Plus size={16} />
                    Collect First Feedback
                  </button>
                </div>
              ) : (
                <>
                  {feedback.map((item) => (
                    <div 
                      key={item.id} 
                      className={`feedback-item ${expandedFeedback.includes(item.id) ? 'expanded' : ''}`}
                    >
                      <div 
                        className="feedback-header"
                        onClick={() => toggleFeedbackExpand(item.id)}
                      >
                        <div className="feedback-title">
                          <span className="feedback-type">{item.feedback_type}</span>
                          <span className="feedback-source-target">
                            {getAgentName(item.source_id)} → {getAgentName(item.target_id)}
                          </span>
                        </div>
                        <div className="feedback-meta">
                          {item.content.rating && (
                            <div className="feedback-rating">
                              {renderStars(item.content.rating)}
                            </div>
                          )}
                          <span className="feedback-time">{formatTimestamp(item.timestamp)}</span>
                          <button className="expand-button">
                            {expandedFeedback.includes(item.id) ? (
                              <ChevronUp size={16} />
                            ) : (
                              <ChevronDown size={16} />
                            )}
                          </button>
                        </div>
                      </div>
                      
                      {expandedFeedback.includes(item.id) && (
                        <div className="feedback-details">
                          {item.content.message && (
                            <div className="detail-section">
                              <h4>Message</h4>
                              <p>{item.content.message}</p>
                            </div>
                          )}
                          
                          <div className="detail-section">
                            <h4>Content</h4>
                            <pre>{JSON.stringify(item.content, null, 2)}</pre>
                          </div>
                          
                          {item.metadata && (
                            <div className="detail-section">
                              <h4>Metadata</h4>
                              <pre>{JSON.stringify(item.metadata, null, 2)}</pre>
                            </div>
                          )}
                          
                          <div className="feedback-actions">
                            <button 
                              className="action-button-small"
                              onClick={() => downloadJson(item, `feedback-${item.id}.json`)}
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
          <div className="analysis-tab">
            <div className="tab-actions">
              <button 
                className="action-button"
                onClick={() => setShowAnalyzeForm(!showAnalyzeForm)}
              >
                <Search size={16} />
                {showAnalyzeForm ? 'Cancel' : 'Analyze Feedback'}
              </button>
            </div>
            
            {showAnalyzeForm && (
              <div className="analyze-form-container">
                <h3>Analyze Feedback</h3>
                <form onSubmit={handleAnalyzeFeedback}>
                  <div className="form-group">
                    <label htmlFor="analysisTargetId">Target Agent</label>
                    <select
                      id="analysisTargetId"
                      value={analysisTargetId}
                      onChange={(e) => setAnalysisTargetId(e.target.value)}
                      required
                    >
                      <option value="">Select a target</option>
                      {agents.map(agent => (
                        <option key={agent.id} value={agent.id}>{agent.name}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="feedbackTypes">Feedback Types (comma-separated, optional)</label>
                    <input
                      type="text"
                      id="feedbackTypes"
                      value={feedbackTypesValue}
                      onChange={(e) => setFeedbackTypesValue(e.target.value)}
                      placeholder="e.g., performance, quality"
                    />
                  </div>
                  
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="timeRangeStart">From Date (optional)</label>
                      <input
                        type="date"
                        id="timeRangeStart"
                        value={timeRangeStart}
                        onChange={(e) => setTimeRangeStart(e.target.value)}
                      />
                    </div>
                    
                    <div className="form-group">
                      <label htmlFor="timeRangeEnd">To Date (optional)</label>
                      <input
                        type="date"
                        id="timeRangeEnd"
                        value={timeRangeEnd}
                        onChange={(e) => setTimeRangeEnd(e.target.value)}
                      />
                    </div>
                  </div>
                  
                  <div className="form-actions">
                    <button 
                      type="button" 
                      className="cancel-button"
                      onClick={() => setShowAnalyzeForm(false)}
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit" 
                      className="submit-button"
                      disabled={isAnalyzing || !analysisTargetId}
                    >
                      {isAnalyzing ? (
                        <>
                          <div className="spinner"></div>
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <Search size={14} />
                          Analyze Feedback
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            )}
            
            <div className="analysis-results">
              <div className="patterns-section">
                <h3>Identified Patterns ({analysis.patterns.length})</h3>
                
                {analysis.patterns.length === 0 ? (
                  <div className="empty-state">
                    <p>No patterns identified yet.</p>
                    <button 
                      className="action-button"
                      onClick={() => setShowAnalyzeForm(true)}
                    >
                      <Search size={16} />
                      Analyze Feedback
                    </button>
                  </div>
                ) : (
                  <>
                    {analysis.patterns.map((pattern, index) => (
                      <div 
                        key={index} 
                        className={`pattern-item ${expandedPatterns.includes(index.toString()) ? 'expanded' : ''}`}
                      >
                        <div 
                          className="pattern-header"
                          onClick={() => togglePatternExpand(index.toString())}
                        >
                          <div className="pattern-title">
                            <span className="pattern-type">{pattern.type}</span>
                            <span className="pattern-feedback-type">{pattern.feedback_type}</span>
                            {pattern.theme && <span className="pattern-theme">{pattern.theme}</span>}
                          </div>
                          <div className="pattern-meta">
                            <span className="pattern-frequency">
                              {pattern.percentage.toFixed(0)}% ({pattern.frequency})
                            </span>
                            <button className="expand-button">
                              {expandedPatterns.includes(index.toString()) ? (
                                <ChevronUp size={16} />
                              ) : (
                                <ChevronDown size={16} />
                              )}
                            </button>
                          </div>
                        </div>
                        
                        {expandedPatterns.includes(index.toString()) && (
                          <div className="pattern-details">
                            {pattern.sentiment && (
                              <div className="detail-section">
                                <h4>Sentiment</h4>
                                <div className="sentiment-indicator">
                                  {pattern.sentiment === 'positive' ? (
                                    <><ThumbsUp size={16} /> Positive</>
                                  ) : pattern.sentiment === 'negative' ? (
                                    <><ThumbsDown size={16} /> Negative</>
                                  ) : (
                                    <>Neutral</>
                                  )}
                                </div>
                              </div>
                            )}
                            
                            {pattern.supporting_evidence && (
                              <div className="detail-section">
                                <h4>Supporting Evidence</h4>
                                <ul>
                                  {pattern.supporting_evidence.map((evidence, i) => (
                                    <li key={i}>{evidence}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            
                            <div className="pattern-actions">
                              <button 
                                className="action-button-small"
                                onClick={() => downloadJson(pattern, `pattern-${index}.json`)}
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
              
              <div className="recommendations-section">
                <h3>Recommendations ({analysis.recommendations.length})</h3>
                
                {analysis.recommendations.length === 0 ? (
                  <div className="empty-state">
                    <p>No recommendations available yet.</p>
                    <button 
                      className="action-button"
                      onClick={() => setShowAnalyzeForm(true)}
                    >
                      <Search size={16} />
                      Analyze Feedback
                    </button>
                  </div>
                ) : (
                  <>
                    {analysis.recommendations.map((recommendation, index) => (
                      <div 
                        key={index} 
                        className={`recommendation-item ${expandedRecommendations.includes(index.toString()) ? 'expanded' : ''} ${getPriorityClass(recommendation.priority)}`}
                      >
                        <div 
                          className="recommendation-header"
                          onClick={() => toggleRecommendationExpand(index.toString())}
                        >
                          <div className="recommendation-title">
                            <span className="recommendation-type">{recommendation.type}</span>
                            {recommendation.area && (
                              <span className="recommendation-area">{recommendation.area}</span>
                            )}
                            {recommendation.priority && (
                              <span className={`recommendation-priority ${getPriorityClass(recommendation.priority)}`}>
                                {recommendation.priority}
                              </span>
                            )}
                          </div>
                          <div className="recommendation-meta">
                            <span className="recommendation-confidence">
                              Confidence: {(recommendation.confidence * 100).toFixed(0)}%
                            </span>
                            <button className="expand-button">
                              {expandedRecommendations.includes(index.toString()) ? (
                                <ChevronUp size={16} />
                              ) : (
                                <ChevronDown size={16} />
                              )}
                            </button>
                          </div>
                        </div>
                        
                        {expandedRecommendations.includes(index.toString()) && (
                          <div className="recommendation-details">
                            <div className="detail-section">
                              <h4>Suggestion</h4>
                              <p>{recommendation.suggestion}</p>
                            </div>
                            
                            <div className="recommendation-actions">
                              <button 
                                className="action-button-small"
                                onClick={() => downloadJson(recommendation, `recommendation-${index}.json`)}
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
          </div>
        )}
      </div>
    </div>
  );
};