import React, { useState, useEffect } from 'react';
import { BookOpen, Search, Filter, BarChart2, Lightbulb, Plus, ChevronDown, ChevronUp, Download, Trash2, Brain } from 'lucide-react';
import './styles.css';

interface Reflection {
  id: string;
  focus: string;
  agents: string[];
  status: 'scheduled' | 'in_progress' | 'completed';
  timestamp: number;
  completed_at?: number;
  results?: {
    findings: Array<{
      category: string;
      description: string;
      evidence: string[];
      impact: 'high' | 'medium' | 'low';
    }>;
    recommendations: Array<{
      description: string;
      priority: 'high' | 'medium' | 'low';
      implementation_steps?: string[];
    }>;
    meta_observations?: string[];
  };
}

interface Insight {
  id: string;
  source_reflection_id: string;
  category: string;
  description: string;
  applicability: string[];
  confidence: number;
  timestamp: number;
}

interface ImprovementPlan {
  id: string;
  source_reflection_id: string;
  target_agents: string[];
  status: 'pending' | 'in_progress' | 'completed';
  steps: Array<{
    description: string;
    status: 'pending' | 'completed';
    assigned_to?: string;
  }>;
  created_at: number;
  updated_at: number;
}

interface ReflectionSystemProps {
  onCreateReflection: (agents: string[], focus: string, reflectionAgent?: string) => Promise<any>;
  onExtractInsights: (reflectionId: string | any, reflectionTypes?: any) => Promise<any>;
  onCreateImprovementPlan: (reflectionId: string, targetAgents: string[]) => Promise<any>;
  reflections?: Reflection[];
  insights?: Insight[];
  improvementPlans?: ImprovementPlan[];
  agents: Array<{ id: string; name: string }>;
}

export const ReflectionSystem: React.FC<ReflectionSystemProps> = ({
  onCreateReflection,
  onExtractInsights,
  onCreateImprovementPlan,
  reflections = [],
  insights = [],
  improvementPlans = [],
  agents
}) => {
  const [activeTab, setActiveTab] = useState<'reflections' | 'insights' | 'plans'>('reflections');
  const [isCreatingReflection, setIsCreatingReflection] = useState(false);
  const [isExtractingInsights, setIsExtractingInsights] = useState(false);
  const [isCreatingPlan, setIsCreatingPlan] = useState(false);
  
  // Form states for creating reflection
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [reflectionFocus, setReflectionFocus] = useState('output_quality');
  const [reflectionAgent, setReflectionAgent] = useState('');
  
  // Form states for creating improvement plan
  const [selectedReflectionId, setSelectedReflectionId] = useState('');
  const [targetAgents, setTargetAgents] = useState<string[]>([]);
  
  // UI states
  const [expandedReflections, setExpandedReflections] = useState<string[]>([]);
  const [expandedInsights, setExpandedInsights] = useState<string[]>([]);
  const [expandedPlans, setExpandedPlans] = useState<string[]>([]);
  const [showCreateReflectionForm, setShowCreateReflectionForm] = useState(false);
  const [showCreatePlanForm, setShowCreatePlanForm] = useState(false);
  
  // Define handleCreateReflection function before it's used
  const handleCreateReflection = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (selectedAgents.length === 0) {
      alert('Please select at least one agent to reflect on');
      return;
    }
    
    if (!reflectionFocus) {
      alert('Please select a reflection focus');
      return;
    }
    
    try {
      await onCreateReflection(
        selectedAgents,
        reflectionFocus,
        reflectionAgent || undefined
      );
      
      setSelectedAgents([]);
      setReflectionFocus('output_quality');
      setReflectionAgent('');
      setShowCreateReflectionForm(false);
    } catch (error) {
      console.error('Error creating reflection:', error);
    }
  };
  
  const toggleReflectionExpand = (id: string) => {
    setExpandedReflections(prev => 
      prev.includes(id) ? prev.filter(rId => rId !== id) : [...prev, id]
    );
  };
  
  const toggleInsightExpand = (id: string) => {
    setExpandedInsights(prev => 
      prev.includes(id) ? prev.filter(iId => iId !== id) : [...prev, id]
    );
  };
  
  const togglePlanExpand = (id: string) => {
    setExpandedPlans(prev => 
      prev.includes(id) ? prev.filter(pId => pId !== id) : [...prev, id]
    );
  };
  
  // Define handleCreatePlan function before it's used
  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingPlan(true);
    
    try {
      await onCreateImprovementPlan(
        selectedReflectionId,
        targetAgents
      );
      
      // Reset form on success
      setSelectedReflectionId('');
      setTargetAgents([]);
      setShowCreatePlanForm(false);
    } catch (error) {
      console.error('Error creating improvement plan:', error);
    } finally {
      setIsCreatingPlan(false);
    }
  };
  
  return (
    <div className="reflection-system tribe-card">
      <div className="reflection-system-header">
        <div className="reflection-system-icon">
          <Brain size={24} />
        </div>
        <h2>Reflection System</h2>
      </div>
      
      <div className="reflection-system-tabs">
        <button 
          className={`reflection-system-tab ${activeTab === 'reflections' ? 'active' : ''}`}
          onClick={() => setActiveTab('reflections')}
        >
          <Brain size={16} />
          <span>Reflections</span>
        </button>
        <button 
          className={`reflection-system-tab ${activeTab === 'insights' ? 'active' : ''}`}
          onClick={() => setActiveTab('insights')}
        >
          <Lightbulb size={16} />
          <span>Insights</span>
        </button>
        <button 
          className={`reflection-system-tab ${activeTab === 'plans' ? 'active' : ''}`}
          onClick={() => setActiveTab('plans')}
        >
          <BarChart2 size={16} />
          <span>Improvement Plans</span>
        </button>
      </div>
      
      <div className="reflection-system-content">
        {activeTab === 'reflections' ? (
          <div className="reflections-tab">
            <div className="tab-actions">
              <button 
                className="action-button"
                onClick={() => setShowCreateReflectionForm(!showCreateReflectionForm)}
              >
                <Plus size={16} />
                {showCreateReflectionForm ? 'Cancel' : 'Create Reflection'}
              </button>
            </div>
            
            {showCreateReflectionForm && (
              <div className="create-form-container">
                <h3>Create New Reflection</h3>
                <form onSubmit={handleCreateReflection}>
                  <div className="form-group">
                    <label htmlFor="agents">Agents to Reflect On</label>
                    <div className="checkbox-group">
                      {agents.map(agent => (
                        <div key={agent.id} className="checkbox-item">
                          <input
                            type="checkbox"
                            id={`agent-${agent.id}`}
                            checked={selectedAgents.includes(agent.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedAgents(prev => [...prev, agent.id]);
                              } else {
                                setSelectedAgents(prev => prev.filter(id => id !== agent.id));
                              }
                            }}
                          />
                          <label htmlFor={`agent-${agent.id}`}>{agent.name}</label>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="focus">Reflection Focus</label>
                    <select
                      id="focus"
                      value={reflectionFocus}
                      onChange={(e) => setReflectionFocus(e.target.value)}
                      required
                    >
                      <option value="output_quality">Output Quality</option>
                      <option value="process_efficiency">Process Efficiency</option>
                      <option value="collaboration">Collaboration</option>
                      <option value="decision_making">Decision Making</option>
                      <option value="innovation">Innovation</option>
                    </select>
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="reflectionAgent">Reflection Agent (optional)</label>
                    <select
                      id="reflectionAgent"
                      value={reflectionAgent}
                      onChange={(e) => setReflectionAgent(e.target.value)}
                    >
                      <option value="">Auto-select</option>
                      {agents.map(agent => (
                        <option key={agent.id} value={agent.id}>{agent.name}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="form-actions">
                    <button 
                      type="button" 
                      className="cancel-button"
                      onClick={() => setShowCreateReflectionForm(false)}
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit" 
                      className="submit-button"
                      disabled={isCreatingReflection || selectedAgents.length === 0}
                    >
                      {isCreatingReflection ? (
                        <>
                          <div className="spinner"></div>
                          Creating...
                        </>
                      ) : (
                        <>
                          <Brain size={14} />
                          Create Reflection
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            )}
            
            <div className="reflections-list">
              <h3>Reflection Sessions ({reflections.length})</h3>
              
              {reflections.length === 0 ? (
                <div className="empty-state">
                  <p>No reflection sessions created yet.</p>
                  <button 
                    className="action-button"
                    onClick={() => setShowCreateReflectionForm(true)}
                  >
                    <Plus size={16} />
                    Create First Reflection
                  </button>
                </div>
              ) : (
                <>
                  {reflections.map((reflection) => (
                    <div 
                      key={reflection.id} 
                      className={`reflection-item ${expandedReflections.includes(reflection.id) ? 'expanded' : ''} ${reflection.status}`}
                    >
                      <div 
                        className="reflection-header"
                        onClick={() => toggleReflectionExpand(reflection.id)}
                      >
                        <div className="reflection-title">
                          <span className="reflection-focus">{reflection.focus.replace('_', ' ')}</span>
                          <span className="reflection-agents">
                            {reflection.agents.length} agent{reflection.agents.length !== 1 ? 's' : ''}
                          </span>
                          <span className={`reflection-status status-${reflection.status}`}>
                            {reflection.status}
                          </span>
                        </div>
                        <div className="reflection-meta">
                          <span className="reflection-time">
                            {formatTimestamp(reflection.timestamp)}
                          </span>
                          <button className="expand-button">
                            {expandedReflections.includes(reflection.id) ? (
                              <ChevronUp size={16} />
                            ) : (
                              <ChevronDown size={16} />
                            )}
                          </button>
                        </div>
                      </div>
                      
                      {expandedReflections.includes(reflection.id) && (
                        <div className="reflection-details">
                          <div className="detail-section">
                            <h4>Agents</h4>
                            <div className="agent-list">
                              {reflection.agents.map(agentId => (
                                <span key={agentId} className="agent-tag">
                                  {getAgentName(agentId)}
                                </span>
                              ))}
                            </div>
                          </div>
                          
                          {reflection.results && (
                            <>
                              <div className="detail-section">
                                <h4>Findings ({reflection.results.findings.length})</h4>
                                {reflection.results.findings.map((finding, index) => (
                                  <div key={index} className={`finding-item impact-${finding.impact}`}>
                                    <div className="finding-header">
                                      <span className="finding-category">{finding.category}</span>
                                      <span className={`finding-impact impact-${finding.impact}`}>
                                        {finding.impact} impact
                                      </span>
                                    </div>
                                    <p className="finding-description">{finding.description}</p>
                                    {finding.evidence.length > 0 && (
                                      <div className="finding-evidence">
                                        <h5>Evidence:</h5>
                                        <ul>
                                          {finding.evidence.map((item, i) => (
                                            <li key={i}>{item}</li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                              
                              <div className="detail-section">
                                <h4>Recommendations ({reflection.results.recommendations.length})</h4>
                                {reflection.results.recommendations.map((rec, index) => (
                                  <div key={index} className={`recommendation-item priority-${rec.priority}`}>
                                    <div className="recommendation-header">
                                      <span className={`recommendation-priority priority-${rec.priority}`}>
                                        {rec.priority} priority
                                      </span>
                                    </div>
                                    <p className="recommendation-description">{rec.description}</p>
                                    {rec.implementation_steps && rec.implementation_steps.length > 0 && (
                                      <div className="implementation-steps">
                                        <h5>Implementation Steps:</h5>
                                        <ol>
                                          {rec.implementation_steps.map((step, i) => (
                                            <li key={i}>{step}</li>
                                          ))}
                                        </ol>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                              
                              {reflection.results.meta_observations && (
                                <div className="detail-section">
                                  <h4>Meta Observations</h4>
                                  <ul className="meta-observations">
                                    {reflection.results.meta_observations.map((obs, index) => (
                                      <li key={index}>{obs}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </>
                          )}
                          
                          <div className="reflection-actions">
                            {reflection.status === 'completed' && (
                              <>
                                <button 
                                  className="action-button-small"
                                  onClick={() => handleExtractInsights(reflection.id)}
                                  disabled={isExtractingInsights}
                                >
                                  {isExtractingInsights ? (
                                    <div className="spinner-small"></div>
                                  ) : (
                                    <Lightbulb size={14} />
                                  )}
                                  Extract Insights
                                </button>
                                <button 
                                  className="action-button-small"
                                  onClick={() => {
                                    setSelectedReflectionId(reflection.id);
                                    setShowCreatePlanForm(true);
                                    setActiveTab('plans');
                                  }}
                                >
                                  <BarChart2 size={14} />
                                  Create Plan
                                </button>
                              </>
                            )}
                            <button 
                              className="action-button-small"
                              onClick={() => downloadJson(reflection, `reflection-${reflection.id}.json`)}
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
        ) : activeTab === 'insights' ? (
          <div className="insights-tab">
            <div className="tab-actions">
              <button 
                className="action-button"
                onClick={() => setActiveTab('reflections')}
              >
                <Brain size={16} />
                Back to Reflections
              </button>
            </div>
            
            <div className="insights-list">
              <h3>Extracted Insights ({insights.length})</h3>
              
              {insights.length === 0 ? (
                <div className="empty-state">
                  <p>No insights extracted yet.</p>
                  <button 
                    className="action-button"
                    onClick={() => setActiveTab('reflections')}
                  >
                    <Brain size={16} />
                    Create Reflection First
                  </button>
                </div>
              ) : (
                <>
                  {insights.map((insight) => (
                    <div 
                      key={insight.id} 
                      className={`insight-item ${expandedInsights.includes(insight.id) ? 'expanded' : ''}`}
                    >
                      <div 
                        className="insight-header"
                        onClick={() => toggleInsightExpand(insight.id)}
                      >
                        <div className="insight-title">
                          <span className="insight-category">{insight.category}</span>
                          <span className="insight-confidence">
                            {(insight.confidence * 100).toFixed(0)}% confidence
                          </span>
                        </div>
                        <div className="insight-meta">
                          <span className="insight-time">
                            {formatTimestamp(insight.timestamp)}
                          </span>
                          <button className="expand-button">
                            {expandedInsights.includes(insight.id) ? (
                              <ChevronUp size={16} />
                            ) : (
                              <ChevronDown size={16} />
                            )}
                          </button>
                        </div>
                      </div>
                      
                      {expandedInsights.includes(insight.id) && (
                        <div className="insight-details">
                          <div className="detail-section">
                            <h4>Description</h4>
                            <p>{insight.description}</p>
                          </div>
                          
                          <div className="detail-section">
                            <h4>Applicability</h4>
                            <div className="applicability-list">
                              {insight.applicability.map((item, index) => (
                                <span key={index} className="applicability-tag">
                                  {item}
                                </span>
                              ))}
                            </div>
                          </div>
                          
                          <div className="detail-section">
                            <h4>Source</h4>
                            <p>
                              From reflection: {
                                reflections.find(r => r.id === insight.source_reflection_id)?.focus.replace('_', ' ') || 
                                insight.source_reflection_id
                              }
                            </p>
                          </div>
                          
                          <div className="insight-actions">
                            <button 
                              className="action-button-small"
                              onClick={() => {
                                const sourceReflection = reflections.find(r => r.id === insight.source_reflection_id);
                                if (sourceReflection) {
                                  setSelectedReflectionId(sourceReflection.id);
                                  setShowCreatePlanForm(true);
                                  setActiveTab('plans');
                                }
                              }}
                            >
                              <BarChart2 size={14} />
                              Create Plan
                            </button>
                            <button 
                              className="action-button-small"
                              onClick={() => downloadJson(insight, `insight-${insight.id}.json`)}
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
          <div className="plans-tab">
            <div className="tab-actions">
              <button 
                className="action-button"
                onClick={() => setActiveTab('reflections')}
              >
                <Brain size={16} />
                Back to Reflections
              </button>
            </div>
            
            {showCreatePlanForm && (
              <div className="create-form-container">
                <h3>Create Improvement Plan</h3>
                <form onSubmit={handleCreatePlan}>
                  <div className="form-group">
                    <label htmlFor="reflectionSource">Source Reflection</label>
                    <select
                      id="reflectionSource"
                      value={selectedReflectionId}
                      onChange={(e) => setSelectedReflectionId(e.target.value)}
                      required
                      disabled={!!selectedReflectionId}
                    >
                      <option value="">Select a reflection</option>
                      {reflections
                        .filter(r => r.status === 'completed')
                        .map(reflection => (
                          <option key={reflection.id} value={reflection.id}>
                            {reflection.focus.replace('_', ' ')} ({formatTimestamp(reflection.timestamp)})
                          </option>
                        ))}
                    </select>
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="targetAgents">Target Agents</label>
                    <div className="checkbox-group">
                      {agents.map(agent => (
                        <div key={agent.id} className="checkbox-item">
                          <input
                            type="checkbox"
                            id={`target-agent-${agent.id}`}
                            checked={targetAgents.includes(agent.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setTargetAgents(prev => [...prev, agent.id]);
                              } else {
                                setTargetAgents(prev => prev.filter(id => id !== agent.id));
                              }
                            }}
                          />
                          <label htmlFor={`target-agent-${agent.id}`}>{agent.name}</label>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="form-actions">
                    <button 
                      type="button" 
                      className="cancel-button"
                      onClick={() => {
                        setShowCreatePlanForm(false);
                        setSelectedReflectionId('');
                        setTargetAgents([]);
                      }}
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit" 
                      className="submit-button"
                      disabled={isCreatingPlan || !selectedReflectionId || targetAgents.length === 0}
                    >
                      {isCreatingPlan ? (
                        <>
                          <div className="spinner"></div>
                          Creating...
                        </>
                      ) : (
                        <>
                          <BarChart2 size={14} />
                          Create Plan
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            )}
            
            <div className="plans-list">
              <h3>Improvement Plans ({improvementPlans.length})</h3>
              
              {improvementPlans.length === 0 ? (
                <div className="empty-state">
                  <p>No improvement plans created yet.</p>
                  <button 
                    className="action-button"
                    onClick={() => {
                      setShowCreatePlanForm(true);
                      setSelectedReflectionId('');
                    }}
                  >
                    <Plus size={16} />
                    Create First Plan
                  </button>
                </div>
              ) : (
                <>
                  {improvementPlans.map((plan) => (
                    <div 
                      key={plan.id} 
                      className={`plan-item ${expandedPlans.includes(plan.id) ? 'expanded' : ''} status-${plan.status}`}
                    >
                      <div 
                        className="plan-header"
                        onClick={() => togglePlanExpand(plan.id)}
                      >
                        <div className="plan-title">
                          <span className="plan-source">
                            {reflections.find(r => r.id === plan.source_reflection_id)?.focus.replace('_', ' ') || 'Unknown'}
                          </span>
                          <span className="plan-agents">
                            {plan.target_agents.length} agent{plan.target_agents.length !== 1 ? 's' : ''}
                          </span>
                          <span className={`plan-status status-${plan.status}`}>
                            {plan.status}
                          </span>
                        </div>
                        <div className="plan-meta">
                          <span className="plan-time">
                            {formatTimestamp(plan.created_at)}
                          </span>
                          <button className="expand-button">
                            {expandedPlans.includes(plan.id) ? (
                              <ChevronUp size={16} />
                            ) : (
                              <ChevronDown size={16} />
                            )}
                          </button>
                        </div>
                      </div>
                      
                      {expandedPlans.includes(plan.id) && (
                        <div className="plan-details">
                          <div className="detail-section">
                            <h4>Target Agents</h4>
                            <div className="agent-list">
                              {plan.target_agents.map(agentId => (
                                <span key={agentId} className="agent-tag">
                                  {getAgentName(agentId)}
                                </span>
                              ))}
                            </div>
                          </div>
                          
                          <div className="detail-section">
                            <h4>Implementation Steps</h4>
                            <div className="steps-list">
                              {plan.steps.map((step, index) => (
                                <div key={index} className={`step-item status-${step.status}`}>
                                  <div className="step-header">
                                    <span className="step-number">Step {index + 1}</span>
                                    <span className={`step-status status-${step.status}`}>
                                      {step.status}
                                    </span>
                                  </div>
                                  <p className="step-description">{step.description}</p>
                                  {step.assigned_to && (
                                    <div className="step-assignment">
                                      Assigned to: <span className="assigned-agent">{getAgentName(step.assigned_to)}</span>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                          
                          <div className="plan-actions">
                            <button 
                              className="action-button-small"
                              onClick={() => downloadJson(plan, `plan-${plan.id}.json`)}
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
  
  // Helper functions
  function formatTimestamp(timestamp: number) {
    return new Date(timestamp * 1000).toLocaleString();
  }
  
  function getAgentName(agentId: string) {
    const agent = agents.find(a => a.id === agentId);
    return agent ? agent.name : agentId;
  }
  
  function downloadJson(data: any, filename: string) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  
  function handleExtractInsights(reflectionId: string) {
    setIsExtractingInsights(true);
    
    try {
      onExtractInsights(reflectionId)
        .then(() => {
          setActiveTab('insights');
        })
        .finally(() => {
          setIsExtractingInsights(false);
        });
    } catch (error) {
      console.error('Error extracting insights:', error);
      setIsExtractingInsights(false);
    }
  }
};