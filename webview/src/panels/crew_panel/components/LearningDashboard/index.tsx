import React, { useState, useEffect } from 'react';
import { getVsCodeApi } from '../../../../vscode';
import { Agent } from '../../types';
import { Brain, Share2, BarChart2, BookOpen, Clock, Settings } from 'lucide-react';
import './styles.css';

// Initialize VS Code API
const vscode = getVsCodeApi();

interface LearningMetric {
  id: string;
  agentId: string;
  metricType: 'performance' | 'knowledge' | 'adaptation';
  value: number;
  timestamp: string;
  description: string;
}

interface KnowledgeItem {
  id: string;
  agentId: string;
  title: string;
  content: string;
  category: string;
  confidence: number;
  timestamp: string;
  source?: string;
}

interface LearningDashboardProps {
  agents: Agent[];
  selectedAgent: Agent | null;
  systemEnabled: boolean;
  onToggleSystem: (enabled: boolean) => void;
}

export const LearningDashboard: React.FC<LearningDashboardProps> = ({
  agents,
  selectedAgent,
  systemEnabled,
  onToggleSystem
}) => {
  const [metrics, setMetrics] = useState<LearningMetric[]>([]);
  const [knowledgeBase, setKnowledgeBase] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'metrics' | 'knowledge'>('metrics');
  const [selectedMetricType, setSelectedMetricType] = useState<string>('all');
  
  // Fetch learning data when component mounts or selected agent changes
  useEffect(() => {
    if (systemEnabled) {
      fetchLearningData();
    }
  }, [systemEnabled, selectedAgent]);
  
  const fetchLearningData = () => {
    setLoading(true);
    
    // Simulate API call to get learning metrics and knowledge base
    setTimeout(() => {
      // Generate dummy metrics data
      const dummyMetrics: LearningMetric[] = [];
      
      // Performance metrics
      for (let i = 0; i < 10; i++) {
        dummyMetrics.push({
          id: `perf-${i}`,
          agentId: selectedAgent?.id || agents[0]?.id || '',
          metricType: 'performance',
          value: 0.5 + (Math.random() * 0.5), // 0.5 to 1.0
          timestamp: new Date(Date.now() - i * 86400000).toISOString(),
          description: `Performance metric #${i+1}`
        });
      }
      
      // Knowledge metrics
      for (let i = 0; i < 10; i++) {
        dummyMetrics.push({
          id: `know-${i}`,
          agentId: selectedAgent?.id || agents[0]?.id || '',
          metricType: 'knowledge',
          value: 0.3 + (Math.random() * 0.7), // 0.3 to 1.0
          timestamp: new Date(Date.now() - i * 86400000).toISOString(),
          description: `Knowledge acquisition metric #${i+1}`
        });
      }
      
      // Adaptation metrics
      for (let i = 0; i < 10; i++) {
        dummyMetrics.push({
          id: `adapt-${i}`,
          agentId: selectedAgent?.id || agents[0]?.id || '',
          metricType: 'adaptation',
          value: 0.2 + (Math.random() * 0.8), // 0.2 to 1.0
          timestamp: new Date(Date.now() - i * 86400000).toISOString(),
          description: `Adaptation metric #${i+1}`
        });
      }
      
      // Generate dummy knowledge base items
      const dummyKnowledge: KnowledgeItem[] = [
        {
          id: '1',
          agentId: selectedAgent?.id || agents[0]?.id || '',
          title: 'React Component Best Practices',
          content: 'React components should be small, focused, and reusable. Follow the single responsibility principle.',
          category: 'Development',
          confidence: 0.92,
          timestamp: new Date(Date.now() - 2 * 86400000).toISOString(),
          source: 'Documentation'
        },
        {
          id: '2',
          agentId: selectedAgent?.id || agents[0]?.id || '',
          title: 'TypeScript Interface vs Type',
          content: 'Interfaces are better for object shapes when they can be extended, types are better for unions, intersections, and complex types.',
          category: 'Development',
          confidence: 0.85,
          timestamp: new Date(Date.now() - 3 * 86400000).toISOString(),
          source: 'Code Analysis'
        },
        {
          id: '3',
          agentId: selectedAgent?.id || agents[0]?.id || '',
          title: 'CSS-in-JS Performance',
          content: 'CSS-in-JS can have performance implications with SSR. Consider alternatives like CSS Modules for better performance.',
          category: 'Development',
          confidence: 0.78,
          timestamp: new Date(Date.now() - 5 * 86400000).toISOString(),
          source: 'Experience'
        },
        {
          id: '4',
          agentId: selectedAgent?.id || agents[0]?.id || '',
          title: 'React Hooks Order',
          content: 'Hooks must be called in the same order each time a component renders. Don\'t call hooks inside loops, conditions, or nested functions.',
          category: 'Development',
          confidence: 0.95,
          timestamp: new Date(Date.now() - 7 * 86400000).toISOString(),
          source: 'Documentation'
        },
        {
          id: '5',
          agentId: selectedAgent?.id || agents[0]?.id || '',
          title: 'Optimization Techniques',
          content: 'Use React.memo for functional components and shouldComponentUpdate for class components to prevent unnecessary re-renders.',
          category: 'Performance',
          confidence: 0.88,
          timestamp: new Date(Date.now() - 10 * 86400000).toISOString(),
          source: 'Experience'
        }
      ];
      
      setMetrics(dummyMetrics);
      setKnowledgeBase(dummyKnowledge);
      setLoading(false);
    }, 1000);
  };
  
  const handleToggleSystem = () => {
    onToggleSystem(!systemEnabled);
    
    // Notify the extension
    vscode.postMessage({
      type: 'TOGGLE_LEARNING_SYSTEM',
      payload: {
        enabled: !systemEnabled,
      },
    });
    
    if (!systemEnabled) {
      fetchLearningData();
    }
  };
  
  const handleShareKnowledge = (knowledgeId: string) => {
    const knowledge = knowledgeBase.find(k => k.id === knowledgeId);
    
    if (!knowledge) return;
    
    vscode.postMessage({
      type: 'SHARE_KNOWLEDGE',
      payload: {
        knowledge
      },
    });
    
    // Show a brief success message or feedback
    // For now, just log it
    console.log('Knowledge shared:', knowledge);
  };
  
  // Filter metrics based on selected type
  const filteredMetrics = metrics.filter(metric => 
    selectedMetricType === 'all' || metric.metricType === selectedMetricType
  );
  
  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  // Get color for metric value
  const getMetricColor = (value: number) => {
    if (value >= 0.8) return 'var(--tribe-success)';
    if (value >= 0.6) return 'var(--tribe-info)';
    if (value >= 0.4) return 'var(--tribe-warning)';
    return 'var(--tribe-error)';
  };
  
  // Get icon for knowledge category
  const getCategoryIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case 'development':
        return <BookOpen size={16} />;
      case 'performance':
        return <BarChart2 size={16} />;
      default:
        return <Brain size={16} />;
    }
  };
  
  // Calculate aggregate metrics
  const calculateAggregate = (metricType: 'performance' | 'knowledge' | 'adaptation') => {
    const typedMetrics = metrics.filter(m => m.metricType === metricType);
    if (typedMetrics.length === 0) return 0;
    
    const sum = typedMetrics.reduce((acc, metric) => acc + metric.value, 0);
    return sum / typedMetrics.length;
  };
  
  const performanceScore = calculateAggregate('performance');
  const knowledgeScore = calculateAggregate('knowledge');
  const adaptationScore = calculateAggregate('adaptation');
  
  return (
    <div className="learning-dashboard">
      <div className="learning-dashboard-header">
        <div className="learning-title">
          <Brain size={20} />
          <h3>Learning System</h3>
        </div>
        
        <div className="learning-system-toggle">
          <span>System Status:</span>
          <div 
            className={`toggle-switch ${systemEnabled ? 'active' : ''}`}
            onClick={handleToggleSystem}
          >
            <div className="toggle-slider"></div>
          </div>
        </div>
      </div>
      
      {systemEnabled ? (
        <div className="learning-dashboard-content">
          <div className="learning-tabs">
            <button 
              className={`tab-button ${activeTab === 'metrics' ? 'active' : ''}`}
              onClick={() => setActiveTab('metrics')}
            >
              <BarChart2 size={16} />
              <span>Learning Metrics</span>
            </button>
            <button 
              className={`tab-button ${activeTab === 'knowledge' ? 'active' : ''}`}
              onClick={() => setActiveTab('knowledge')}
            >
              <BookOpen size={16} />
              <span>Knowledge Base</span>
            </button>
          </div>
          
          {loading ? (
            <div className="loading-indicator">Loading learning data...</div>
          ) : (
            <>
              {activeTab === 'metrics' ? (
                <div className="metrics-view">
                  <div className="metrics-summary">
                    <div className="metric-card">
                      <div className="metric-card-header">
                        <h4>Performance</h4>
                      </div>
                      <div className="metric-value">
                        <div 
                          className="circular-progress" 
                          style={{
                            background: `conic-gradient(${getMetricColor(performanceScore)} ${performanceScore * 100}%, transparent 0)`
                          }}
                        >
                          <span>{Math.round(performanceScore * 100)}%</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="metric-card">
                      <div className="metric-card-header">
                        <h4>Knowledge</h4>
                      </div>
                      <div className="metric-value">
                        <div 
                          className="circular-progress" 
                          style={{
                            background: `conic-gradient(${getMetricColor(knowledgeScore)} ${knowledgeScore * 100}%, transparent 0)`
                          }}
                        >
                          <span>{Math.round(knowledgeScore * 100)}%</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="metric-card">
                      <div className="metric-card-header">
                        <h4>Adaptation</h4>
                      </div>
                      <div className="metric-value">
                        <div 
                          className="circular-progress" 
                          style={{
                            background: `conic-gradient(${getMetricColor(adaptationScore)} ${adaptationScore * 100}%, transparent 0)`
                          }}
                        >
                          <span>{Math.round(adaptationScore * 100)}%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="metrics-filter">
                    <label>Filter by type:</label>
                    <select 
                      value={selectedMetricType} 
                      onChange={(e) => setSelectedMetricType(e.target.value)}
                    >
                      <option value="all">All Metrics</option>
                      <option value="performance">Performance</option>
                      <option value="knowledge">Knowledge</option>
                      <option value="adaptation">Adaptation</option>
                    </select>
                  </div>
                  
                  <div className="metrics-list">
                    <table className="metrics-table">
                      <thead>
                        <tr>
                          <th>Type</th>
                          <th>Description</th>
                          <th>Value</th>
                          <th>Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredMetrics.map(metric => (
                          <tr key={metric.id} className="metric-row">
                            <td className="metric-type">{metric.metricType}</td>
                            <td className="metric-description">{metric.description}</td>
                            <td className="metric-value-cell">
                              <div className="progress-bar">
                                <div 
                                  className="progress-fill"
                                  style={{
                                    width: `${metric.value * 100}%`,
                                    backgroundColor: getMetricColor(metric.value)
                                  }}
                                ></div>
                              </div>
                              <span>{Math.round(metric.value * 100)}%</span>
                            </td>
                            <td className="metric-date">
                              <Clock size={14} />
                              <span>{formatDate(metric.timestamp)}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="knowledge-view">
                  <div className="knowledge-header">
                    <h4>Agent Knowledge Base</h4>
                    <p>Knowledge items learned by the agent through experience and training.</p>
                  </div>
                  
                  <div className="knowledge-list">
                    {knowledgeBase.map(item => (
                      <div key={item.id} className="knowledge-card">
                        <div className="knowledge-card-header">
                          <div className="knowledge-title">
                            {getCategoryIcon(item.category)}
                            <h4>{item.title}</h4>
                          </div>
                          <div className="knowledge-category">
                            <span>{item.category}</span>
                          </div>
                        </div>
                        
                        <div className="knowledge-content">
                          <p>{item.content}</p>
                        </div>
                        
                        <div className="knowledge-footer">
                          <div className="knowledge-meta">
                            <div className="knowledge-confidence">
                              <span>Confidence: {Math.round(item.confidence * 100)}%</span>
                              <div className="confidence-bar">
                                <div 
                                  className="confidence-fill"
                                  style={{
                                    width: `${item.confidence * 100}%`,
                                    backgroundColor: getMetricColor(item.confidence)
                                  }}
                                ></div>
                              </div>
                            </div>
                            <div className="knowledge-source">
                              {item.source && <span>Source: {item.source}</span>}
                            </div>
                            <div className="knowledge-date">
                              <Clock size={14} />
                              <span>{formatDate(item.timestamp)}</span>
                            </div>
                          </div>
                          
                          <button 
                            className="share-knowledge-button" 
                            onClick={() => handleShareKnowledge(item.id)}
                            title="Share with other agents"
                          >
                            <Share2 size={14} />
                            <span>Share</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="learning-system-disabled">
          <Brain size={48} />
          <h4>Learning System is Disabled</h4>
          <p>
            Enable the learning system to track metrics, build a knowledge base, and improve agent performance over time.
          </p>
          <button 
            className="enable-learning-button"
            onClick={handleToggleSystem}
          >
            Enable Learning System
          </button>
        </div>
      )}
    </div>
  );
};