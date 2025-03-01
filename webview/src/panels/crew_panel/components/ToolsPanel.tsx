import React, { useState, useEffect } from 'react';
import { getVsCodeApi } from '../../../vscode';
import { Agent } from '../types';
import { Wrench, Search, Plus, X, Settings, Download, Upload, RefreshCw, Filter, Rocket } from 'lucide-react';
import './ToolsPanel.css';

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
    parameters: []
  });
  
  // Fetch tools when component mounts
  useEffect(() => {
    if (systemEnabled) {
      fetchTools();
    }
  }, [systemEnabled]);
  
  const fetchTools = () => {
    setLoading(true);
    
    // Simulate API call to get tools
    // In a real implementation, this would be a message to the extension
    setTimeout(() => {
      const dummyTools: Tool[] = [
        {
          id: '1',
          name: 'Python Linter',
          description: 'Lint Python code for errors and style issues',
          category: 'python',
          usage: {
            successRate: 98,
            lastUsed: new Date(Date.now() - 86400000).toISOString(),
            timesUsed: 42
          }
        },
        {
          id: '2',
          name: 'Python Formatter',
          description: 'Format Python code according to PEP 8 standards',
          category: 'python',
          usage: {
            successRate: 100,
            lastUsed: new Date(Date.now() - 43200000).toISOString(),
            timesUsed: 27
          }
        },
        {
          id: '3',
          name: 'Code Search',
          description: 'Search for code patterns across the codebase',
          category: 'utility',
          parameters: [
            {
              name: 'query',
              type: 'string',
              description: 'The search query',
              required: true
            },
            {
              name: 'file_pattern',
              type: 'string',
              description: 'File pattern to search in',
              required: false
            }
          ],
          usage: {
            successRate: 95,
            lastUsed: new Date().toISOString(),
            timesUsed: 18
          }
        },
        {
          id: '4',
          name: 'TypeScript Type Generator',
          description: 'Generate TypeScript types from JSON data',
          category: 'typescript',
          usage: {
            successRate: 92,
            lastUsed: new Date(Date.now() - 172800000).toISOString(),
            timesUsed: 15
          }
        },
        {
          id: '5',
          name: 'API Client Generator',
          description: 'Generate API client code from OpenAPI specifications',
          category: 'api',
          usage: {
            successRate: 88,
            lastUsed: new Date(Date.now() - 259200000).toISOString(),
            timesUsed: 8
          }
        },
        {
          id: '6',
          name: 'Database Schema Analyzer',
          description: 'Analyze and optimize database schemas',
          category: 'database',
          usage: {
            successRate: 97,
            lastUsed: new Date(Date.now() - 345600000).toISOString(),
            timesUsed: 12
          }
        }
      ];
      
      setTools(dummyTools);
      setLoading(false);
    }, 1000);
  };
  
  const handleToggleSystem = () => {
    onToggleSystem(!systemEnabled);
    
    // Notify the extension
    vscode.postMessage({
      type: 'TOGGLE_TOOLS_SYSTEM',
      payload: {
        enabled: !systemEnabled
      }
    });
    
    if (!systemEnabled) {
      fetchTools();
    }
  };
  
  const handleAssignTool = (toolId: string) => {
    if (!selectedAgent) return;
    
    vscode.postMessage({
      type: 'ASSIGN_TOOL',
      payload: {
        agentId: selectedAgent.id,
        toolId
      }
    });
  };
  
  const handleRemoveTool = (toolId: string) => {
    if (!selectedAgent) return;
    
    vscode.postMessage({
      type: 'REMOVE_TOOL',
      payload: {
        agentId: selectedAgent.id,
        toolId
      }
    });
  };

  const handleRunTool = (toolId: string) => {
    vscode.postMessage({
      type: 'RUN_TOOL',
      payload: {
        toolId,
        agentId: selectedAgent?.id
      }
    });
  };

  const handleConfigureTool = (toolId: string) => {
    vscode.postMessage({
      type: 'CONFIGURE_TOOL',
      payload: {
        toolId
      }
    });
  };

  const handleImportTools = () => {
    vscode.postMessage({
      type: 'IMPORT_TOOLS'
    });
  };

  const handleExportTools = () => {
    vscode.postMessage({
      type: 'EXPORT_TOOLS',
      payload: {
        tools
      }
    });
  };
  
  const getCategories = () => {
    const categories = new Set<string>();
    tools.forEach(tool => categories.add(tool.category));
    return Array.from(categories);
  };
  
  const filteredTools = tools.filter(tool => {
    const matchesSearch = tool.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         tool.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || tool.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });
  
  const isToolAssigned = (toolId: string) => {
    if (!selectedAgent || !selectedAgent.tools) return false;
    
    return selectedAgent.tools.some(tool => {
      if (typeof tool === 'string') {
        return tool === toolId;
      } else {
        return (tool as any).id === toolId || tool.name === toolId;
      }
    });
  };

  const handleAddTool = () => {
    if (!newTool.name || !newTool.description || !newTool.category) return;

    vscode.postMessage({
      type: 'ADD_TOOL',
      payload: {
        tool: newTool
      }
    });

    // In a real implementation, we would wait for a response
    // For now, simulate adding the tool
    const toolId = `new-${Date.now()}`;
    setTools([...tools, { 
      id: toolId, 
      name: newTool.name, 
      description: newTool.description, 
      category: newTool.category,
      parameters: newTool.parameters,
      usage: {
        successRate: 0,
        timesUsed: 0
      }
    }]);

    // Reset form
    setNewTool({
      name: '',
      description: '',
      category: '',
      parameters: []
    });
    setShowAddToolForm(false);
  };

  const handleAddParameter = () => {
    setNewTool(prev => ({
      ...prev,
      parameters: [
        ...(prev.parameters || []),
        {
          name: '',
          type: 'string',
          description: '',
          required: false
        }
      ]
    }));
  };

  const handleUpdateParameter = (index: number, field: string, value: any) => {
    setNewTool(prev => {
      const parameters = [...(prev.parameters || [])];
      parameters[index] = {
        ...parameters[index],
        [field]: value
      };
      return {
        ...prev,
        parameters
      };
    });
  };

  const handleRemoveParameter = (index: number) => {
    setNewTool(prev => ({
      ...prev,
      parameters: (prev.parameters || []).filter((_, i) => i !== index)
    }));
  };
  
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
              <div className="search-input">
                <Search size={14} />
                <input
                  type="text"
                  placeholder="Search tools..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button 
                    className="clear-search"
                    onClick={() => setSearchQuery('')}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              
              <div className="category-filter">
                <Filter size={14} />
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                >
                  <option value="all">All Categories</option>
                  {getCategories().map(category => (
                    <option key={category} value={category}>
                      {category.charAt(0).toUpperCase() + category.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="tools-actions">
              <button 
                className="view-toggle-button"
                onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                title={viewMode === 'grid' ? 'Switch to list view' : 'Switch to grid view'}
              >
                {viewMode === 'grid' ? 'List' : 'Grid'}
              </button>
              
              <button 
                className="add-tool-button"
                onClick={() => setShowAddToolForm(true)}
                title="Add new tool"
              >
                <Plus size={14} />
                Add Tool
              </button>
              
              <button 
                className="import-tools-button"
                onClick={handleImportTools}
                title="Import tools"
              >
                <Download size={14} />
              </button>
              
              <button 
                className="export-tools-button"
                onClick={handleExportTools}
                title="Export tools"
              >
                <Upload size={14} />
              </button>
              
              <button 
                className="refresh-tools-button"
                onClick={fetchTools}
                title="Refresh tools"
              >
                <RefreshCw size={14} />
              </button>
            </div>
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
                      onChange={(e) => setNewTool({...newTool, name: e.target.value})}
                      placeholder="Tool name"
                    />
                  </div>
                  <div className="form-group">
                    <label>Description</label>
                    <textarea 
                      value={newTool.description}
                      onChange={(e) => setNewTool({...newTool, description: e.target.value})}
                      placeholder="Tool description"
                    />
                  </div>
                  <div className="form-group">
                    <label>Category</label>
                    <input 
                      type="text" 
                      value={newTool.category}
                      onChange={(e) => setNewTool({...newTool, category: e.target.value})}
                      placeholder="Tool category"
                      list="categories"
                    />
                    <datalist id="categories">
                      {getCategories().map(category => (
                        <option key={category} value={category} />
                      ))}
                    </datalist>
                  </div>
                  
                  <div className="form-group">
                    <label>Parameters</label>
                    {(newTool.parameters || []).map((param, index) => (
                      <div key={index} className="parameter-item">
                        <input 
                          type="text" 
                          value={param.name}
                          onChange={(e) => handleUpdateParameter(index, 'name', e.target.value)}
                          placeholder="Parameter name"
                        />
                        <select 
                          value={param.type}
                          onChange={(e) => handleUpdateParameter(index, 'type', e.target.value)}
                        >
                          <option value="string">String</option>
                          <option value="number">Number</option>
                          <option value="boolean">Boolean</option>
                          <option value="object">Object</option>
                          <option value="array">Array</option>
                        </select>
                        <input 
                          type="text" 
                          value={param.description}
                          onChange={(e) => handleUpdateParameter(index, 'description', e.target.value)}
                          placeholder="Description"
                        />
                        <label>
                          <input 
                            type="checkbox" 
                            checked={param.required}
                            onChange={(e) => handleUpdateParameter(index, 'required', e.target.checked)}
                          />
                          Required
                        </label>
                        <button 
                          className="remove-param-button"
                          onClick={() => handleRemoveParameter(index)}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                    <button 
                      className="add-param-button"
                      onClick={handleAddParameter}
                    >
                      <Plus size={14} />
                      Add Parameter
                    </button>
                  </div>
                  
                  <div className="form-actions">
                    <button 
                      className="cancel-button"
                      onClick={() => setShowAddToolForm(false)}
                    >
                      Cancel
                    </button>
                    <button 
                      className="save-button"
                      onClick={handleAddTool}
                      disabled={!newTool.name || !newTool.description || !newTool.category}
                    >
                      Save Tool
                    </button>
                  </div>
                </div>
              )}
              
              <div className={`tools-list ${viewMode}`}>
                {filteredTools.length === 0 ? (
                  <div className="no-tools">
                    <p>No tools found matching your criteria.</p>
                  </div>
                ) : (
                  filteredTools.map(tool => (
                    <div key={tool.id} className="tool-card">
                      <div className="tool-info">
                        <h4 className="tool-name">{tool.name}</h4>
                        <span className="tool-category">{tool.category}</span>
                        <p className="tool-description">{tool.description}</p>
                        
                        {tool.parameters && tool.parameters.length > 0 && (
                          <div className="tool-parameters">
                            <h5>Parameters:</h5>
                            <ul>
                              {tool.parameters.map(param => (
                                <li key={param.name}>
                                  <span className="param-name">{param.name}</span>
                                  <span className="param-type">{param.type}</span>
                                  {param.required && <span className="param-required">Required</span>}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        
                        {tool.usage && (
                          <div className="tool-usage">
                            <div className="usage-stat">
                              <span className="stat-label">Success Rate:</span>
                              <span className="stat-value">{tool.usage.successRate}%</span>
                            </div>
                            <div className="usage-stat">
                              <span className="stat-label">Times Used:</span>
                              <span className="stat-value">{tool.usage.timesUsed}</span>
                            </div>
                            {tool.usage.lastUsed && (
                              <div className="usage-stat">
                                <span className="stat-label">Last Used:</span>
                                <span className="stat-value">{new Date(tool.usage.lastUsed).toLocaleDateString()}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      
                      <div className="tool-actions">
                        {selectedAgent ? (
                          isToolAssigned(tool.id) ? (
                            <button 
                              className="remove-tool-button"
                              onClick={() => handleRemoveTool(tool.id)}
                            >
                              <X size={14} />
                              Remove
                            </button>
                          ) : (
                            <button 
                              className="assign-tool-button"
                              onClick={() => handleAssignTool(tool.id)}
                            >
                              <Plus size={14} />
                              Assign
                            </button>
                          )
                        ) : (
                          <div className="no-agent-selected">
                            <span>Select an agent to assign tools</span>
                          </div>
                        )}
                        
                        <button 
                          className="run-tool-button"
                          onClick={() => handleRunTool(tool.id)}
                        >
                          <Rocket size={14} />
                          Run
                        </button>
                        
                        <button 
                          className="configure-tool-button"
                          onClick={() => handleConfigureTool(tool.id)}
                        >
                          <Settings size={14} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="tools-system-disabled">
          <Wrench size={48} />
          <h4>Tools Management System is Disabled</h4>
          <p>Enable the tools management system to assign tools to agents, configure tool parameters, and track tool usage.</p>
          <button 
            className="enable-tools-button"
            onClick={handleToggleSystem}
          >
            Enable Tools Management
          </button>
        </div>
      )}
    </div>
  );
}; 