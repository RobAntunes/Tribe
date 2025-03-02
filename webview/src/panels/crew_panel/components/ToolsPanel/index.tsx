import React, { useState, useEffect } from 'react';
import { getVsCodeApi } from '../../../../vscode';
import { Agent } from '../../types';
import { Wrench, Search, Plus, X, Settings, Download, Upload, RefreshCw, Filter, Rocket } from 'lucide-react';
import './styles.css';

// Initialize VS Code API
const vscode = getVsCodeApi();

interface Tool {
  id: string;
  name: string;
  description: string;
  category: string;
  parameters?: {
    name: string;
    type: string;
    description: string;
    required: boolean;
  }[];
  usage?: {
    successRate: number;
    lastUsed?: string;
    timesUsed: number;
  };
}

interface ToolsPanelProps {
  agents: Agent[];
  selectedAgent: Agent | null;
  systemEnabled: boolean;
  onToggleSystem: (enabled: boolean) => void;
}

export const ToolsPanel: React.FC<ToolsPanelProps> = ({
  agents,
  selectedAgent,
  systemEnabled,
  onToggleSystem
}) => {
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showAddToolForm, setShowAddToolForm] = useState<boolean>(false);
  const [newTool, setNewTool] = useState<Partial<Tool>>({
    name: '',
    description: '',
    category: '',
  });
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  const [agentTools, setAgentTools] = useState<{[agentId: string]: string[]}>({});

  // Fetch tools when component mounts
  useEffect(() => {
    if (systemEnabled) {
      fetchTools();
      fetchAgentTools();
    }
  }, [systemEnabled]);

  const fetchTools = () => {
    setLoading(true);

    // In a real implementation, this would be a message to the extension
    // For now, use dummy data
    setTimeout(() => {
      const dummyTools: Tool[] = [
        {
          id: '1',
          name: 'Code Generator',
          description: 'Generates code snippets based on descriptions',
          category: 'Development',
          parameters: [
            { name: 'language', type: 'string', description: 'Programming language', required: true },
            { name: 'description', type: 'string', description: 'What to generate', required: true },
          ],
          usage: {
            successRate: 0.85,
            lastUsed: new Date(Date.now() - 86400000).toISOString(),
            timesUsed: 42
          }
        },
        {
          id: '2',
          name: 'Data Analyzer',
          description: 'Analyzes data sets and provides insights',
          category: 'Data',
          parameters: [
            { name: 'data', type: 'object', description: 'Data to analyze', required: true },
            { name: 'type', type: 'string', description: 'Type of analysis', required: false },
          ],
          usage: {
            successRate: 0.92,
            lastUsed: new Date().toISOString(),
            timesUsed: 17
          }
        },
        {
          id: '3',
          name: 'Documentation Generator',
          description: 'Generates documentation for code',
          category: 'Development',
          parameters: [
            { name: 'code', type: 'string', description: 'Code to document', required: true },
            { name: 'format', type: 'string', description: 'Output format', required: false },
          ],
          usage: {
            successRate: 0.78,
            lastUsed: new Date(Date.now() - 172800000).toISOString(),
            timesUsed: 23
          }
        },
        {
          id: '4',
          name: 'Task Scheduler',
          description: 'Schedules and manages tasks',
          category: 'Project Management',
          parameters: [
            { name: 'task', type: 'object', description: 'Task details', required: true },
            { name: 'priority', type: 'number', description: 'Task priority', required: false },
          ],
          usage: {
            successRate: 0.96,
            lastUsed: new Date(Date.now() - 43200000).toISOString(),
            timesUsed: 31
          }
        },
        {
          id: '5',
          name: 'Web Searcher',
          description: 'Searches the web for information',
          category: 'Research',
          parameters: [
            { name: 'query', type: 'string', description: 'Search query', required: true },
            { name: 'limit', type: 'number', description: 'Result limit', required: false },
          ],
          usage: {
            successRate: 0.88,
            lastUsed: new Date(Date.now() - 21600000).toISOString(),
            timesUsed: 56
          }
        }
      ];

      setTools(dummyTools);
      setLoading(false);
    }, 1000);
  };

  const fetchAgentTools = () => {
    // In a real implementation, this would be a message to the extension
    // For now, use dummy data
    const dummyAgentTools: {[agentId: string]: string[]} = {};
    
    agents.forEach(agent => {
      dummyAgentTools[agent.id] = ['1', '3', '5']; // Assign some tools to agents
    });

    setAgentTools(dummyAgentTools);
  };

  const handleToggleSystem = () => {
    onToggleSystem(!systemEnabled);

    // Notify the extension
    vscode.postMessage({
      type: 'TOGGLE_TOOLS_SYSTEM',
      payload: {
        enabled: !systemEnabled,
      },
    });

    if (!systemEnabled) {
      fetchTools();
      fetchAgentTools();
    }
  };

  const handleAddTool = () => {
    if (!newTool.name || !newTool.description || !newTool.category) return;

    vscode.postMessage({
      type: 'ADD_TOOL',
      payload: {
        name: newTool.name,
        description: newTool.description,
        category: newTool.category,
        parameters: newTool.parameters || []
      },
    });

    // In a real implementation, we would wait for a response
    // For now, simulate adding the tool
    const toolId = `new-${Date.now()}`;
    const newToolObj: Tool = {
      id: toolId,
      name: newTool.name,
      description: newTool.description,
      category: newTool.category,
      parameters: newTool.parameters,
      usage: {
        successRate: 0,
        lastUsed: new Date().toISOString(),
        timesUsed: 0
      }
    };

    setTools([...tools, newToolObj]);

    // Reset form
    setNewTool({
      name: '',
      description: '',
      category: '',
    });
    setShowAddToolForm(false);
  };

  const handleAssignToolToAgent = (toolId: string, agentId: string) => {
    vscode.postMessage({
      type: 'ASSIGN_TOOL_TO_AGENT',
      payload: {
        toolId,
        agentId
      },
    });

    // Update local state
    setAgentTools({
      ...agentTools,
      [agentId]: [...(agentTools[agentId] || []), toolId]
    });
  };

  const handleRemoveToolFromAgent = (toolId: string, agentId: string) => {
    vscode.postMessage({
      type: 'REMOVE_TOOL_FROM_AGENT',
      payload: {
        toolId,
        agentId
      },
    });

    // Update local state
    setAgentTools({
      ...agentTools,
      [agentId]: (agentTools[agentId] || []).filter(id => id !== toolId)
    });
  };

  const getAgentName = (agentId: string) => {
    const agent = agents.find(a => a.id === agentId);
    return agent ? agent.name || agent.role : 'Unknown Agent';
  };

  const filteredTools = tools.filter(tool => {
    const matchesCategory = selectedCategory === 'all' || tool.category === selectedCategory;
    const matchesSearch = searchQuery === '' ||
      tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const categories = ['all', ...Array.from(new Set(tools.map(tool => tool.category)))];

  return (
    <div className="tools-panel">
      <div className="tools-panel-header">
        <div className="tools-title">
          <Wrench size={20} />
          <h3>Tools Management</h3>
        </div>

        <div className="tools-system-toggle">
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
        <div className="tools-panel-content">
          <div className="tools-toolbar">
            <div className="tools-search">
              <Search size={14} />
              <input
                type="text"
                placeholder="Search tools..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button className="clear-search" onClick={() => setSearchQuery('')}>
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="tools-categories">
              <Filter size={14} />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                {categories.map(category => (
                  <option key={category} value={category}>
                    {category === 'all' ? 'All Categories' : category}
                  </option>
                ))}
              </select>
            </div>

            <div className="tools-view-toggle">
              <button
                className={`view-button ${viewMode === 'grid' ? 'active' : ''}`}
                onClick={() => setViewMode('grid')}
                title="Grid View"
              >
                Grid
              </button>
              <button
                className={`view-button ${viewMode === 'list' ? 'active' : ''}`}
                onClick={() => setViewMode('list')}
                title="List View"
              >
                List
              </button>
            </div>

            <button className="add-tool-button" onClick={() => setShowAddToolForm(true)}>
              <Plus size={14} />
              Add Tool
            </button>
          </div>

          {loading ? (
            <div className="loading-indicator">Loading tools...</div>
          ) : (
            <>
              {showAddToolForm && (
                <div className="add-tool-form">
                  <h4>Add New Tool</h4>
                  <div className="form-group">
                    <label>Name</label>
                    <input
                      type="text"
                      value={newTool.name}
                      onChange={(e) => setNewTool({ ...newTool, name: e.target.value })}
                      placeholder="Tool Name"
                    />
                  </div>
                  <div className="form-group">
                    <label>Description</label>
                    <textarea
                      value={newTool.description}
                      onChange={(e) => setNewTool({ ...newTool, description: e.target.value })}
                      placeholder="Tool Description"
                    />
                  </div>
                  <div className="form-group">
                    <label>Category</label>
                    <input
                      type="text"
                      value={newTool.category}
                      onChange={(e) => setNewTool({ ...newTool, category: e.target.value })}
                      placeholder="Tool Category"
                      list="categories"
                    />
                    <datalist id="categories">
                      {categories.filter(c => c !== 'all').map(category => (
                        <option key={category} value={category} />
                      ))}
                    </datalist>
                  </div>
                  <div className="form-actions">
                    <button className="cancel-button" onClick={() => setShowAddToolForm(false)}>
                      Cancel
                    </button>
                    <button
                      className="save-button"
                      onClick={handleAddTool}
                      disabled={!newTool.name || !newTool.description || !newTool.category}
                    >
                      Add Tool
                    </button>
                  </div>
                </div>
              )}

              {selectedTool && (
                <div className="tool-details-modal">
                  <div className="tool-details-content">
                    <div className="tool-details-header">
                      <h4>{selectedTool.name}</h4>
                      <button className="close-details-button" onClick={() => setSelectedTool(null)}>
                        <X size={18} />
                      </button>
                    </div>
                    <div className="tool-details-body">
                      <div className="tool-detail">
                        <span className="detail-label">Category:</span>
                        <span className="category-badge">{selectedTool.category}</span>
                      </div>
                      <div className="tool-detail">
                        <span className="detail-label">Description:</span>
                        <p>{selectedTool.description}</p>
                      </div>
                      {selectedTool.parameters && selectedTool.parameters.length > 0 && (
                        <div className="tool-parameters">
                          <h5>Parameters:</h5>
                          <table className="parameters-table">
                            <thead>
                              <tr>
                                <th>Name</th>
                                <th>Type</th>
                                <th>Required</th>
                                <th>Description</th>
                              </tr>
                            </thead>
                            <tbody>
                              {selectedTool.parameters.map((param, index) => (
                                <tr key={index}>
                                  <td>{param.name}</td>
                                  <td>{param.type}</td>
                                  <td>{param.required ? 'Yes' : 'No'}</td>
                                  <td>{param.description}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                      {selectedTool.usage && (
                        <div className="tool-usage">
                          <h5>Usage Statistics:</h5>
                          <div className="usage-stats">
                            <div className="usage-stat">
                              <span className="stat-label">Success Rate:</span>
                              <span className="stat-value">{(selectedTool.usage.successRate * 100).toFixed(1)}%</span>
                            </div>
                            <div className="usage-stat">
                              <span className="stat-label">Times Used:</span>
                              <span className="stat-value">{selectedTool.usage.timesUsed}</span>
                            </div>
                            {selectedTool.usage.lastUsed && (
                              <div className="usage-stat">
                                <span className="stat-label">Last Used:</span>
                                <span className="stat-value">{new Date(selectedTool.usage.lastUsed).toLocaleDateString()}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      <div className="tool-agents">
                        <h5>Assigned Agents:</h5>
                        <div className="assigned-agents">
                          {Object.entries(agentTools).some(([agentId, toolIds]) => toolIds.includes(selectedTool.id)) ? (
                            <ul className="agent-list">
                              {Object.entries(agentTools)
                                .filter(([agentId, toolIds]) => toolIds.includes(selectedTool.id))
                                .map(([agentId]) => (
                                  <li key={agentId} className="agent-item">
                                    <span>{getAgentName(agentId)}</span>
                                    <button
                                      className="remove-agent-button"
                                      onClick={() => handleRemoveToolFromAgent(selectedTool.id, agentId)}
                                      title="Remove from agent"
                                    >
                                      <X size={14} />
                                    </button>
                                  </li>
                                ))}
                            </ul>
                          ) : (
                            <p className="no-agents">No agents are using this tool</p>
                          )}
                        </div>
                        <div className="assign-tool">
                          <h5>Assign to Agent:</h5>
                          <div className="assign-form">
                            <select
                              className="agent-select"
                              onChange={(e) => {
                                if (e.target.value) {
                                  handleAssignToolToAgent(selectedTool.id, e.target.value);
                                  e.target.value = '';
                                }
                              }}
                              value=""
                            >
                              <option value="" disabled>Select Agent</option>
                              {agents
                                .filter(agent => !agentTools[agent.id]?.includes(selectedTool.id))
                                .map(agent => (
                                  <option key={agent.id} value={agent.id}>
                                    {agent.name || agent.role}
                                  </option>
                                ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className={`tools-${viewMode}-view`}>
                {viewMode === 'grid' ? (
                  <div className="tools-grid">
                    {filteredTools.map(tool => (
                      <div key={tool.id} className="tool-card" onClick={() => setSelectedTool(tool)}>
                        <div className="tool-card-header">
                          <div className="tool-icon">
                            <Rocket size={20} />
                          </div>
                          <span className="tool-category">{tool.category}</span>
                        </div>
                        <h4 className="tool-name">{tool.name}</h4>
                        <p className="tool-description">{tool.description}</p>
                        <div className="tool-card-footer">
                          <div className="tool-usage-indicator">
                            {tool.usage && (
                              <>
                                <span className="usage-count">{tool.usage.timesUsed} uses</span>
                                <span className="usage-rate" style={{ width: `${tool.usage.successRate * 100}%` }}></span>
                              </>
                            )}
                          </div>
                          <div className="tool-agents-count">
                            {Object.values(agentTools).filter(tools => tools.includes(tool.id)).length} agents
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <table className="tools-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Category</th>
                        <th>Description</th>
                        <th>Usage</th>
                        <th>Agents</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTools.map(tool => (
                        <tr key={tool.id} className="tool-row" onClick={() => setSelectedTool(tool)}>
                          <td>{tool.name}</td>
                          <td><span className="category-badge">{tool.category}</span></td>
                          <td className="description-cell">{tool.description}</td>
                          <td>
                            {tool.usage && (
                              <div className="tool-usage-indicator list-view">
                                <span className="usage-count">{tool.usage.timesUsed} uses</span>
                                <div className="usage-bar">
                                  <span className="usage-rate" style={{ width: `${tool.usage.successRate * 100}%` }}></span>
                                </div>
                              </div>
                            )}
                          </td>
                          <td>{Object.values(agentTools).filter(tools => tools.includes(tool.id)).length}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="tools-system-disabled">
          <Wrench size={48} />
          <h4>Tools Management System is Disabled</h4>
          <p>
            Enable the tools management system to create, assign, and manage tools for your agents.
          </p>
          <button className="enable-tools-button" onClick={handleToggleSystem}>
            Enable Tools Management
          </button>
        </div>
      )}
    </div>
  );
};