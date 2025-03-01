import React, { useState, useEffect } from 'react';
import { getVsCodeApi } from '../../../vscode';
import { Agent } from '../types';
import { Brain, Share2, BarChart2, BookOpen, Clock } from 'lucide-react';
import './LearningDashboard.css';

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
      // Generate dummy metrics
      const dummyMetrics: LearningMetric[] = [];
      const metricTypes: ('performance' | 'knowledge' | 'adaptation')[] = ['performance', 'knowledge', 'adaptation'];
      
      agents.forEach(agent => {
        metricTypes.forEach(type => {
          for (let i = 0; i < 3; i++) {
            dummyMetrics.push({
              id: `${agent.id}-${type}-${i}`,
              agentId: agent.id,
              metricType: type,
              value: Math.random() * 100,
              timestamp: new Date(Date.now() - i * 86400000).toISOString(),
              description: `${type.charAt(0).toUpperCase() + type.slice(1)} metric for ${agent.name || agent.role}`
            });
          }
        });
      });
      
      // Generate dummy knowledge items
      const dummyKnowledge: KnowledgeItem[] = [];
      const categories = ['code', 'process', 'domain', 'tool'];
      
      agents.forEach(agent => {
        for (let i = 0; i < 5; i++) {
          const category = categories[Math.floor(Math.random() * categories.length)];
          dummyKnowledge.push({
            id: `${agent.id}-knowledge-${i}`,
            agentId: agent.id,
            title: `Knowledge about ${category}`,
            content: `This is a sample knowledge item about ${category} that the agent has learned.`,
            category,
            confidence: Math.random() * 100,
            timestamp: new Date(Date.now() - i * 86400000).toISOString(),
            source: Math.random() > 0.5 ? 'User interaction' : 'Agent collaboration'
          });
        }
      });
      
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
        enabled: !systemEnabled
      }
    });
    
    if (!systemEnabled) {
      fetchLearningData();
    }
  };
  
  const handleShareKnowledge = (knowledgeId: string) => {
    vscode.postMessage({
      type: 'SHARE_KNOWLEDGE',
      payload: {
        knowledgeId,
        sourceAgentId: selectedAgent?.id,
        targetAgentIds: agents.filter(a => a.id !== selectedAgent?.id).map(a => a.id)
      }
    });
  };
  
  const filteredMetrics = metrics.filter(metric => {
    const matchesAgent = !selectedAgent || metric.agentId === selectedAgent.id;
    const matchesType = selectedMetricType === 'all' || metric.metricType === selectedMetricType;
    return matchesAgent && matchesType;
  });
  
  const filteredKnowledge = knowledgeBase.filter(item => {
    return !selectedAgent || item.agentId === selectedAgent.id;
  });
  
  const getAgentName = (agentId: string) => {
    const agent = agents.find(a => a.id === agentId);
    return agent ? agent.name || agent.role : 'Unknown Agent';
  };
  
  const getAgentDescription = (agentId: string) => {
    const agent = agents.find(a => a.id === agentId);
    return agent ? agent.short_description || agent.role : '';
  };
  
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };
  
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
              <BarChart2 size={14} />
              Metrics
            </button>
            <button 
              className={`tab-button ${activeTab === 'knowledge' ? 'active' : ''}`}
              onClick={() => setActiveTab('knowledge')}
            >
              <BookOpen size={14} />
              Knowledge Base
            </button>
          </div>
          
          {loading ? (
            <div className="loading-indicator">Loading learning data...</div>
          ) : (
            activeTab === 'metrics' ? (
              <div className="metrics-view">
                <div className="metrics-filter">
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
                  {filteredMetrics.length === 0 ? (
                    <div className="no-metrics">
                      <p>No metrics found for the selected criteria.</p>
                    </div>
                  ) : (
                    filteredMetrics.map(metric => (
                      <div key={metric.id} className="metric-card">
                        <div className="metric-header">
                          <div className="metric-type">
                            {metric.metricType.charAt(0).toUpperCase() + metric.metricType.slice(1)}
                          </div>
                          <div className="metric-agent" title={getAgentDescription(metric.agentId)}>
                            {getAgentName(metric.agentId)}
                          </div>
                        </div>
                        
                        <div className="metric-value-container">
                          <div className="metric-value">
                            {metric.value.toFixed(1)}
                          </div>
                          <div 
                            className="metric-progress-bar"
                            style={{ width: `${Math.min(100, metric.value)}%` }}
                          ></div>
                        </div>
                        
                        <div className="metric-footer">
                          <div className="metric-description">
                            {metric.description}
                          </div>
                          <div className="metric-timestamp">
                            <Clock size={12} />
                            <span>{formatDate(metric.timestamp)}</span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <div className="knowledge-view">
                <div className="knowledge-list">
                  {filteredKnowledge.length === 0 ? (
                    <div className="no-knowledge">
                      <p>No knowledge items found for the selected agent.</p>
                    </div>
                  ) : (
                    filteredKnowledge.map(item => (
                      <div key={item.id} className="knowledge-card">
                        <div className="knowledge-header">
                          <h4 className="knowledge-title">{item.title}</h4>
                          <span className="knowledge-category">{item.category}</span>
                        </div>
                        
                        <p className="knowledge-content">{item.content}</p>
                        
                        <div className="knowledge-footer">
                          <div className="knowledge-meta">
                            <div className="knowledge-confidence">
                              Confidence: {item.confidence.toFixed(1)}%
                            </div>
                            <div className="knowledge-timestamp">
                              <Clock size={12} />
                              <span>{formatDate(item.timestamp)}</span>
                            </div>
                          </div>
                          
                          <button 
                            className="share-knowledge-button"
                            onClick={() => handleShareKnowledge(item.id)}
                            disabled={!selectedAgent}
                          >
                            <Share2 size={14} />
                            Share with Team
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )
          )}
        </div>
      ) : (
        <div className="learning-system-disabled">
          <Brain size={48} />
          <h4>Learning System is Disabled</h4>
          <p>Enable the learning system to track agent performance, knowledge acquisition, and adaptation over time.</p>
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