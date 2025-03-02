import React, { useState } from 'react';
import { Cpu, Send, ChevronDown, ChevronUp, Download, RotateCw, Lightbulb, Settings, Plus, Minus } from 'lucide-react';
import './styles.css';

interface ModelQuery {
  id: string;
  prompt: string;
  response: string;
  metadata: {
    model: string;
    temperature: number;
    max_tokens: number;
    elapsed_time: number;
    tokens_used: {
      prompt: number;
      completion: number;
      total: number;
    };
    cost?: number;
  };
  timestamp: number;
  purpose?: string;
}

interface OptimizedPrompt {
  id: string;
  purpose: string;
  prompt: string;
  model: string;
  example_outputs: string[];
  metadata: {
    target_audience?: string;
    complexity_level?: string;
    context_required?: boolean;
    word_count?: number;
  };
  timestamp: number;
}

interface AgentSpecification {
  id: string;
  name: string;
  role: string;
  description: string;
  backstory?: string;
  capabilities: string[];
  constraints: string[];
  tools?: string[];
  metadata: {
    project_type: string;
    team_role: string;
    expertise_level: string;
    communication_style?: string;
  };
  timestamp: number;
}

interface FoundationModelInterfaceProps {
  queries?: ModelQuery[];
  optimizedPrompts?: OptimizedPrompt[];
  agentSpecs?: AgentSpecification[];
  supportedModels: string[];
  onQueryModel?: (prompt: string, temperature: number, maxTokens: number, model: string, purpose?: string) => Promise<any>;
  onGenerateOptimizedPrompt?: (purpose: string, context: any, model: string) => Promise<any>;
  onGenerateAgentSpec?: (projectNeeds: any, model: string) => Promise<any>;
}

export const FoundationModelInterface: React.FC<FoundationModelInterfaceProps> = ({
  queries = [],
  optimizedPrompts = [],
  agentSpecs = [],
  supportedModels = ['gpt-4-turbo', 'claude-3-opus', 'claude-3-sonnet'],
  onQueryModel,
  onGenerateOptimizedPrompt,
  onGenerateAgentSpec
}) => {
  const [activeTab, setActiveTab] = useState<'queries' | 'prompts' | 'agents'>('queries');
  const [showQueryForm, setShowQueryForm] = useState(false);
  const [showPromptForm, setShowPromptForm] = useState(false);
  const [showAgentForm, setShowAgentForm] = useState(false);
  const [expandedQueries, setExpandedQueries] = useState<string[]>([]);
  const [expandedPrompts, setExpandedPrompts] = useState<string[]>([]);
  const [expandedAgents, setExpandedAgents] = useState<string[]>([]);
  
  // Form states for querying model
  const [prompt, setPrompt] = useState('');
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(500);
  const [model, setModel] = useState(supportedModels[0]);
  const [purpose, setPurpose] = useState('');
  const [isQuerying, setIsQuerying] = useState(false);
  
  // Form states for generating optimized prompt
  const [promptPurpose, setPromptPurpose] = useState('');
  const [contextValue, setContextValue] = useState('');
  const [promptModel, setPromptModel] = useState(supportedModels[0]);
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);
  
  // Form states for generating agent specification
  const [projectNeedsValue, setProjectNeedsValue] = useState('');
  const [agentModel, setAgentModel] = useState(supportedModels[0]);
  const [isGeneratingAgent, setIsGeneratingAgent] = useState(false);
  
  const toggleQueryExpand = (id: string) => {
    setExpandedQueries(prev => 
      prev.includes(id) ? prev.filter(qId => qId !== id) : [...prev, id]
    );
  };
  
  const togglePromptExpand = (id: string) => {
    setExpandedPrompts(prev => 
      prev.includes(id) ? prev.filter(pId => pId !== id) : [...prev, id]
    );
  };
  
  const toggleAgentExpand = (id: string) => {
    setExpandedAgents(prev => 
      prev.includes(id) ? prev.filter(aId => aId !== id) : [...prev, id]
    );
  };
  
  const handleQueryModel = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsQuerying(true);
    
    try {
      if (onQueryModel) {
        await onQueryModel(prompt, temperature, maxTokens, model, purpose || undefined);
        // Reset form on success
        setPrompt('');
        setPurpose('');
        setShowQueryForm(false);
      }
    } catch (error) {
      console.error('Error querying model:', error);
    } finally {
      setIsQuerying(false);
    }
  };
  
  const handleGenerateOptimizedPrompt = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGeneratingPrompt(true);
    
    try {
      const context = JSON.parse(contextValue);
      
      if (onGenerateOptimizedPrompt) {
        await onGenerateOptimizedPrompt(promptPurpose, context, promptModel);
        // Reset form on success
        setPromptPurpose('');
        setContextValue('');
        setShowPromptForm(false);
      }
    } catch (error) {
      console.error('Error generating optimized prompt:', error);
      alert('Error: Please ensure all JSON fields are properly formatted.');
    } finally {
      setIsGeneratingPrompt(false);
    }
  };
  
  const handleGenerateAgentSpec = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGeneratingAgent(true);
    
    try {
      const projectNeeds = JSON.parse(projectNeedsValue);
      
      if (onGenerateAgentSpec) {
        await onGenerateAgentSpec(projectNeeds, agentModel);
        // Reset form on success
        setProjectNeedsValue('');
        setShowAgentForm(false);
      }
    } catch (error) {
      console.error('Error generating agent specification:', error);
      alert('Error: Please ensure all JSON fields are properly formatted.');
    } finally {
      setIsGeneratingAgent(false);
    }
  };
  
  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };
  
  const formatCost = (cost?: number) => {
    if (cost === undefined) return 'N/A';
    return `$${cost.toFixed(4)}`;
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
  
  const downloadText = (text: string, filename: string) => {
    const blob = new Blob([text], { type: 'text/plain' });
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
    <div className="foundation-model-interface tribe-card">
      <div className="model-interface-header">
        <div className="model-interface-icon">
          <Cpu size={24} />
        </div>
        <h2>Foundation Model Interface</h2>
      </div>
      
      <div className="model-interface-tabs">
        <button 
          className={`model-interface-tab ${activeTab === 'queries' ? 'active' : ''}`}
          onClick={() => setActiveTab('queries')}
        >
          <Send size={16} />
          <span>Queries</span>
        </button>
        <button 
          className={`model-interface-tab ${activeTab === 'prompts' ? 'active' : ''}`}
          onClick={() => setActiveTab('prompts')}
        >
          <Lightbulb size={16} />
          <span>Optimized Prompts</span>
        </button>
        <button 
          className={`model-interface-tab ${activeTab === 'agents' ? 'active' : ''}`}
          onClick={() => setActiveTab('agents')}
        >
          <Settings size={16} />
          <span>Agent Specs</span>
        </button>
      </div>
      
      <div className="model-interface-content">
        {activeTab === 'queries' ? (
          <div className="queries-tab">
            <div className="tab-actions">
              <button 
                className="action-button"
                onClick={() => setShowQueryForm(!showQueryForm)}
              >
                <Send size={16} />
                {showQueryForm ? 'Cancel' : 'Query Model'}
              </button>
            </div>
            
            {showQueryForm && (
              <div className="query-form-container">
                <h3>Query Model</h3>
                <form onSubmit={handleQueryModel}>
                  <div className="form-group">
                    <label htmlFor="model">Model</label>
                    <select
                      id="model"
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      required
                    >
                      {supportedModels.map((modelName) => (
                        <option key={modelName} value={modelName}>{modelName}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="prompt">Prompt</label>
                    <textarea
                      id="prompt"
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder="Enter your prompt here..."
                      rows={5}
                      required
                    />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="purpose">Purpose (optional)</label>
                    <input
                      type="text"
                      id="purpose"
                      value={purpose}
                      onChange={(e) => setPurpose(e.target.value)}
                      placeholder="e.g., code_explanation, requirement_analysis"
                    />
                  </div>
                  
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="temperature">Temperature: {temperature}</label>
                      <div className="slider-container">
                        <button 
                          type="button" 
                          className="slider-button"
                          onClick={() => setTemperature(Math.max(0, temperature - 0.1))}
                        >
                          <Minus size={14} />
                        </button>
                        <input
                          type="range"
                          id="temperature"
                          min="0"
                          max="1"
                          step="0.1"
                          value={temperature}
                          onChange={(e) => setTemperature(parseFloat(e.target.value))}
                        />
                        <button 
                          type="button" 
                          className="slider-button"
                          onClick={() => setTemperature(Math.min(1, temperature + 0.1))}
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>
                    
                    <div className="form-group">
                      <label htmlFor="maxTokens">Max Tokens: {maxTokens}</label>
                      <div className="slider-container">
                        <button 
                          type="button" 
                          className="slider-button"
                          onClick={() => setMaxTokens(Math.max(100, maxTokens - 100))}
                        >
                          <Minus size={14} />
                        </button>
                        <input
                          type="range"
                          id="maxTokens"
                          min="100"
                          max="2000"
                          step="100"
                          value={maxTokens}
                          onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                        />
                        <button 
                          type="button" 
                          className="slider-button"
                          onClick={() => setMaxTokens(Math.min(2000, maxTokens + 100))}
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  <div className="form-actions">
                    <button 
                      type="button" 
                      className="cancel-button"
                      onClick={() => setShowQueryForm(false)}
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit" 
                      className="submit-button"
                      disabled={isQuerying}
                    >
                      {isQuerying ? (
                        <>
                          <div className="spinner"></div>
                          Querying...
                        </>
                      ) : (
                        <>
                          <Send size={14} />
                          Send Query
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            )}
            
            <div className="queries-list">
              <h3>Recent Queries ({queries.length})</h3>
              
              {queries.length === 0 ? (
                <div className="empty-state">
                  <p>No queries have been sent yet.</p>
                  <button 
                    className="action-button"
                    onClick={() => setShowQueryForm(true)}
                  >
                    <Send size={16} />
                    Send First Query
                  </button>
                </div>
              ) : (
                <>
                  {queries.map((query) => (
                    <div 
                      key={query.id} 
                      className={`query-item ${expandedQueries.includes(query.id) ? 'expanded' : ''}`}
                    >
                      <div 
                        className="query-header"
                        onClick={() => toggleQueryExpand(query.id)}
                      >
                        <div className="query-title">
                          <span className="query-model">{query.metadata.model}</span>
                          {query.purpose && <span className="query-purpose">{query.purpose}</span>}
                        </div>
                        <div className="query-meta">
                          <span className="query-time">{formatTimestamp(query.timestamp)}</span>
                          <button className="expand-button">
                            {expandedQueries.includes(query.id) ? (
                              <ChevronUp size={16} />
                            ) : (
                              <ChevronDown size={16} />
                            )}
                          </button>
                        </div>
                      </div>
                      
                      {expandedQueries.includes(query.id) && (
                        <div className="query-details">
                          <div className="detail-section">
                            <h4>Prompt</h4>
                            <pre>{query.prompt}</pre>
                          </div>
                          
                          <div className="detail-section">
                            <h4>Response</h4>
                            <pre>{query.response}</pre>
                          </div>
                          
                          <div className="detail-section">
                            <h4>Metadata</h4>
                            <div className="metadata-grid">
                              <div className="metadata-item">
                                <span className="metadata-label">Temperature</span>
                                <span className="metadata-value">{query.metadata.temperature}</span>
                              </div>
                              <div className="metadata-item">
                                <span className="metadata-label">Max Tokens</span>
                                <span className="metadata-value">{query.metadata.max_tokens}</span>
                              </div>
                              <div className="metadata-item">
                                <span className="metadata-label">Elapsed Time</span>
                                <span className="metadata-value">{query.metadata.elapsed_time.toFixed(2)}s</span>
                              </div>
                              <div className="metadata-item">
                                <span className="metadata-label">Tokens Used</span>
                                <span className="metadata-value">{query.metadata.tokens_used.total}</span>
                              </div>
                              <div className="metadata-item">
                                <span className="metadata-label">Prompt Tokens</span>
                                <span className="metadata-value">{query.metadata.tokens_used.prompt}</span>
                              </div>
                              <div className="metadata-item">
                                <span className="metadata-label">Completion Tokens</span>
                                <span className="metadata-value">{query.metadata.tokens_used.completion}</span>
                              </div>
                              <div className="metadata-item">
                                <span className="metadata-label">Cost</span>
                                <span className="metadata-value">{formatCost(query.metadata.cost)}</span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="query-actions">
                            <button 
                              className="action-button-small"
                              onClick={() => downloadText(query.response, `response-${query.id}.txt`)}
                            >
                              <Download size={14} />
                              Export Response
                            </button>
                            <button 
                              className="action-button-small"
                              onClick={() => downloadJson(query, `query-${query.id}.json`)}
                            >
                              <Download size={14} />
                              Export All
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
        ) : activeTab === 'prompts' ? (
          <div className="prompts-tab">
            <div className="tab-actions">
              <button 
                className="action-button"
                onClick={() => setShowPromptForm(!showPromptForm)}
              >
                <Lightbulb size={16} />
                {showPromptForm ? 'Cancel' : 'Generate Prompt'}
              </button>
            </div>
            
            {showPromptForm && (
              <div className="prompt-form-container">
                <h3>Generate Optimized Prompt</h3>
                <form onSubmit={handleGenerateOptimizedPrompt}>
                  <div className="form-group">
                    <label htmlFor="promptModel">Model</label>
                    <select
                      id="promptModel"
                      value={promptModel}
                      onChange={(e) => setPromptModel(e.target.value)}
                      required
                    >
                      {supportedModels.map((modelName) => (
                        <option key={modelName} value={modelName}>{modelName}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="promptPurpose">Purpose</label>
                    <input
                      type="text"
                      id="promptPurpose"
                      value={promptPurpose}
                      onChange={(e) => setPromptPurpose(e.target.value)}
                      placeholder="e.g., explain_technical_concept, code_review"
                      required
                    />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="context">Context (JSON)</label>
                    <textarea
                      id="context"
                      value={contextValue}
                      onChange={(e) => setContextValue(e.target.value)}
                      placeholder='{"concept": "machine_learning", "audience": "beginners"}'
                      rows={5}
                      required
                    />
                  </div>
                  
                  <div className="form-actions">
                    <button 
                      type="button" 
                      className="cancel-button"
                      onClick={() => setShowPromptForm(false)}
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit" 
                      className="submit-button"
                      disabled={isGeneratingPrompt}
                    >
                      {isGeneratingPrompt ? (
                        <>
                          <div className="spinner"></div>
                          Generating...
                        </>
                      ) : (
                        <>
                          <Lightbulb size={14} />
                          Generate Prompt
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            )}
            
            <div className="prompts-list">
              <h3>Optimized Prompts ({optimizedPrompts.length})</h3>
              
              {optimizedPrompts.length === 0 ? (
                <div className="empty-state">
                  <p>No optimized prompts have been generated yet.</p>
                  <button 
                    className="action-button"
                    onClick={() => setShowPromptForm(true)}
                  >
                    <Lightbulb size={16} />
                    Generate First Prompt
                  </button>
                </div>
              ) : (
                <>
                  {optimizedPrompts.map((optimizedPrompt) => (
                    <div 
                      key={optimizedPrompt.id} 
                      className={`prompt-item ${expandedPrompts.includes(optimizedPrompt.id) ? 'expanded' : ''}`}
                    >
                      <div 
                        className="prompt-header"
                        onClick={() => togglePromptExpand(optimizedPrompt.id)}
                      >
                        <div className="prompt-title">
                          <span className="prompt-purpose">{optimizedPrompt.purpose}</span>
                          <span className="prompt-model">{optimizedPrompt.model}</span>
                        </div>
                        <div className="prompt-meta">
                          <span className="prompt-time">{formatTimestamp(optimizedPrompt.timestamp)}</span>
                          <button className="expand-button">
                            {expandedPrompts.includes(optimizedPrompt.id) ? (
                              <ChevronUp size={16} />
                            ) : (
                              <ChevronDown size={16} />
                            )}
                          </button>
                        </div>
                      </div>
                      
                      {expandedPrompts.includes(optimizedPrompt.id) && (
                        <div className="prompt-details">
                          <div className="detail-section">
                            <h4>Optimized Prompt</h4>
                            <pre>{optimizedPrompt.prompt}</pre>
                          </div>
                          
                          {optimizedPrompt.example_outputs.length > 0 && (
                            <div className="detail-section">
                              <h4>Example Outputs</h4>
                              {optimizedPrompt.example_outputs.map((output, index) => (
                                <div key={index} className="example-output">
                                  <h5>Example {index + 1}</h5>
                                  <pre>{output}</pre>
                                </div>
                              ))}
                            </div>
                          )}
                          
                          <div className="detail-section">
                            <h4>Metadata</h4>
                            <div className="metadata-grid">
                              {Object.entries(optimizedPrompt.metadata).map(([key, value]) => (
                                <div key={key} className="metadata-item">
                                  <span className="metadata-label">{key.replace(/_/g, ' ')}</span>
                                  <span className="metadata-value">
                                    {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : value}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                          
                          <div className="prompt-actions">
                            <button 
                              className="action-button-small"
                              onClick={() => downloadText(optimizedPrompt.prompt, `prompt-${optimizedPrompt.id}.txt`)}
                            >
                              <Download size={14} />
                              Export Prompt
                            </button>
                            <button 
                              className="action-button-small"
                              onClick={() => downloadJson(optimizedPrompt, `optimized-prompt-${optimizedPrompt.id}.json`)}
                            >
                              <Download size={14} />
                              Export All
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
          <div className="agents-tab">
            <div className="tab-actions">
              <button 
                className="action-button"
                onClick={() => setShowAgentForm(!showAgentForm)}
              >
                <Settings size={16} />
                {showAgentForm ? 'Cancel' : 'Generate Agent Spec'}
              </button>
            </div>
            
            {showAgentForm && (
              <div className="agent-form-container">
                <h3>Generate Agent Specification</h3>
                <form onSubmit={handleGenerateAgentSpec}>
                  <div className="form-group">
                    <label htmlFor="agentModel">Model</label>
                    <select
                      id="agentModel"
                      value={agentModel}
                      onChange={(e) => setAgentModel(e.target.value)}
                      required
                    >
                      {supportedModels.map((modelName) => (
                        <option key={modelName} value={modelName}>{modelName}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="projectNeeds">Project Needs (JSON)</label>
                    <textarea
                      id="projectNeeds"
                      value={projectNeedsValue}
                      onChange={(e) => setProjectNeedsValue(e.target.value)}
                      placeholder='{"project_type": "web_app", "project_goals": ["user_auth", "data_visualization"], "team_size": 3}'
                      rows={5}
                      required
                    />
                  </div>
                  
                  <div className="form-actions">
                    <button 
                      type="button" 
                      className="cancel-button"
                      onClick={() => setShowAgentForm(false)}
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit" 
                      className="submit-button"
                      disabled={isGeneratingAgent}
                    >
                      {isGeneratingAgent ? (
                        <>
                          <div className="spinner"></div>
                          Generating...
                        </>
                      ) : (
                        <>
                          <Settings size={14} />
                          Generate Agent Spec
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            )}
            
            <div className="agents-list">
              <h3>Agent Specifications ({agentSpecs.length})</h3>
              
              {agentSpecs.length === 0 ? (
                <div className="empty-state">
                  <p>No agent specifications have been generated yet.</p>
                  <button 
                    className="action-button"
                    onClick={() => setShowAgentForm(true)}
                  >
                    <Settings size={16} />
                    Generate First Agent Spec
                  </button>
                </div>
              ) : (
                <>
                  {agentSpecs.map((agentSpec) => (
                    <div 
                      key={agentSpec.id} 
                      className={`agent-item ${expandedAgents.includes(agentSpec.id) ? 'expanded' : ''}`}
                    >
                      <div 
                        className="agent-header"
                        onClick={() => toggleAgentExpand(agentSpec.id)}
                      >
                        <div className="agent-title">
                          <span className="agent-name">{agentSpec.name}</span>
                          <span className="agent-role">{agentSpec.role}</span>
                        </div>
                        <div className="agent-meta">
                          <span className="agent-time">{formatTimestamp(agentSpec.timestamp)}</span>
                          <button className="expand-button">
                            {expandedAgents.includes(agentSpec.id) ? (
                              <ChevronUp size={16} />
                            ) : (
                              <ChevronDown size={16} />
                            )}
                          </button>
                        </div>
                      </div>
                      
                      {expandedAgents.includes(agentSpec.id) && (
                        <div className="agent-details">
                          <div className="detail-section">
                            <h4>Description</h4>
                            <p>{agentSpec.description}</p>
                          </div>
                          
                          {agentSpec.backstory && (
                            <div className="detail-section">
                              <h4>Backstory</h4>
                              <p>{agentSpec.backstory}</p>
                            </div>
                          )}
                          
                          <div className="detail-section">
                            <h4>Capabilities</h4>
                            <ul>
                              {agentSpec.capabilities.map((capability, index) => (
                                <li key={index}>{capability}</li>
                              ))}
                            </ul>
                          </div>
                          
                          <div className="detail-section">
                            <h4>Constraints</h4>
                            <ul>
                              {agentSpec.constraints.map((constraint, index) => (
                                <li key={index}>{constraint}</li>
                              ))}
                            </ul>
                          </div>
                          
                          {agentSpec.tools && agentSpec.tools.length > 0 && (
                            <div className="detail-section">
                              <h4>Tools</h4>
                              <ul>
                                {agentSpec.tools.map((tool, index) => (
                                  <li key={index}>{tool}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          
                          <div className="detail-section">
                            <h4>Metadata</h4>
                            <div className="metadata-grid">
                              {Object.entries(agentSpec.metadata).map(([key, value]) => (
                                <div key={key} className="metadata-item">
                                  <span className="metadata-label">{key.replace(/_/g, ' ')}</span>
                                  <span className="metadata-value">{value}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                          
                          <div className="agent-actions">
                            <button 
                              className="action-button-small"
                              onClick={() => downloadJson(agentSpec, `agent-spec-${agentSpec.id}.json`)}
                            >
                              <Download size={14} />
                              Export Spec
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