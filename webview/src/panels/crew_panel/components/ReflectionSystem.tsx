/** @jsx React.createElement */
/** @jsxRuntime classic */

import React, { useState } from 'react';
import { IterationCcw, Lightbulb, ListChecks, Target, Plus, X, Clipboard, Files } from 'lucide-react';
import './ReflectionSystem.css';

interface ReflectionSystemProps {
  agents: Array<{ id: string; name: string }>;
  onCreateReflection: (
    agents: string[],
    focus: string,
    reflectionAgent: string
  ) => Promise<any>;
  onExtractInsights: (
    agentId: string,
    reflectionTypes: string[]
  ) => Promise<any>;
  onCreateImprovementPlan: (
    agentId: string,
    opportunities: string[]
  ) => Promise<any>;
}

export const ReflectionSystem: React.FC<ReflectionSystemProps> = ({
  agents,
  onCreateReflection,
  onExtractInsights,
  onCreateImprovementPlan
}) => {
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [focusTopic, setFocusTopic] = useState<string>('');
  const [reflectionAgent, setReflectionAgent] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'reflect' | 'insights' | 'plan'>('reflect');
  const [insightAgent, setInsightAgent] = useState<string>('');
  const [reflectionTypes, setReflectionTypes] = useState<string[]>(['process', 'outcome']);
  const [improvementAgent, setImprovementAgent] = useState<string>('');
  const [opportunities, setOpportunities] = useState<string[]>(['']);

  const reflectionTypeOptions = [
    { value: 'process', label: 'Process' },
    { value: 'outcome', label: 'Outcome' },
    { value: 'decision', label: 'Decision' },
    { value: 'generic', label: 'Generic' }
  ];

  const toggleAgentSelection = (agentId: string) => {
    if (selectedAgents.includes(agentId)) {
      setSelectedAgents(selectedAgents.filter(id => id !== agentId));
    } else {
      setSelectedAgents([...selectedAgents, agentId]);
    }
  };

  const toggleReflectionType = (type: string) => {
    if (reflectionTypes.includes(type)) {
      setReflectionTypes(reflectionTypes.filter(t => t !== type));
    } else {
      setReflectionTypes([...reflectionTypes, type]);
    }
  };

  const handleCreateReflection = async () => {
    if (selectedAgents.length === 0 || !focusTopic || !reflectionAgent) {
      return;
    }

    setLoading(true);
    setSuccessMessage('');

    try {
      await onCreateReflection(selectedAgents, focusTopic, reflectionAgent);
      setSuccessMessage('Reflection created successfully');
      
      // Reset form after successful submission
      setFocusTopic('');
    } catch (error) {
      console.error('Error creating reflection:', error);
      setSuccessMessage('Failed to create reflection');
    } finally {
      setLoading(false);
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);
    }
  };

  const handleExtractInsights = async () => {
    if (!insightAgent || reflectionTypes.length === 0) {
      return;
    }

    setLoading(true);
    setSuccessMessage('');

    try {
      await onExtractInsights(insightAgent, reflectionTypes);
      setSuccessMessage('Insights extracted successfully');
    } catch (error) {
      console.error('Error extracting insights:', error);
      setSuccessMessage('Failed to extract insights');
    } finally {
      setLoading(false);
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);
    }
  };

  const handleCreateImprovementPlan = async () => {
    if (!improvementAgent || opportunities.filter(o => o.trim() !== '').length === 0) {
      return;
    }

    setLoading(true);
    setSuccessMessage('');

    try {
      // Filter out empty opportunities
      const validOpportunities = opportunities.filter(o => o.trim() !== '');
      await onCreateImprovementPlan(improvementAgent, validOpportunities);
      setSuccessMessage('Improvement plan created successfully');
    } catch (error) {
      console.error('Error creating improvement plan:', error);
      setSuccessMessage('Failed to create improvement plan');
    } finally {
      setLoading(false);
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);
    }
  };

  const addOpportunity = () => {
    setOpportunities([...opportunities, '']);
  };

  const removeOpportunity = (index: number) => {
    const newOpportunities = [...opportunities];
    newOpportunities.splice(index, 1);
    setOpportunities(newOpportunities);
  };

  const updateOpportunity = (index: number, value: string) => {
    const newOpportunities = [...opportunities];
    newOpportunities[index] = value;
    setOpportunities(newOpportunities);
  };

  return (
    <div className="reflection-system">
      <div className="reflection-header">
        <div className="reflection-title">
          <IterationCcw className="reflection-icon" size={24} />
          <h2>Reflection System</h2>
        </div>
        <div className="reflection-tabs">
          <button 
            className={`reflection-tab ${activeTab === 'reflect' ? 'active' : ''}`}
            onClick={() => setActiveTab('reflect')}
          >
            <IterationCcw size={16} />
            <span>Create Reflection</span>
          </button>
          <button 
            className={`reflection-tab ${activeTab === 'insights' ? 'active' : ''}`}
            onClick={() => setActiveTab('insights')}
          >
            <Lightbulb size={16} />
            <span>Extract Insights</span>
          </button>
          <button 
            className={`reflection-tab ${activeTab === 'plan' ? 'active' : ''}`}
            onClick={() => setActiveTab('plan')}
          >
            <ListChecks size={16} />
            <span>Improvement Plan</span>
          </button>
        </div>
      </div>

      <div className="reflection-content">
        {activeTab === 'reflect' && (
          <div className="create-reflection">
            <div className="form-group">
              <label htmlFor="reflectionAgent">Agent Creating the Reflection</label>
              <select 
                id="reflectionAgent" 
                value={reflectionAgent}
                onChange={(e) => setReflectionAgent(e.target.value)}
              >
                <option value="">Select an agent</option>
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>{agent.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Agents to Reflect On</label>
              <div className="agent-selection">
                {agents.map((agent) => (
                  <button
                    key={agent.id}
                    type="button"
                    className={`agent-chip ${selectedAgents.includes(agent.id) ? 'active' : ''}`}
                    onClick={() => toggleAgentSelection(agent.id)}
                  >
                    {agent.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="focusTopic">Focus Topic</label>
              <input
                id="focusTopic"
                type="text"
                placeholder="What should the reflection focus on?"
                value={focusTopic}
                onChange={(e) => setFocusTopic(e.target.value)}
              />
            </div>

            <button 
              className="create-button" 
              onClick={handleCreateReflection}
              disabled={loading || selectedAgents.length === 0 || !focusTopic || !reflectionAgent}
            >
              {loading ? 'Creating...' : 'Create Reflection'}
            </button>
          </div>
        )}

        {activeTab === 'insights' && (
          <div className="extract-insights">
            <div className="form-group">
              <label htmlFor="insightAgent">Select Agent</label>
              <select 
                id="insightAgent" 
                value={insightAgent}
                onChange={(e) => setInsightAgent(e.target.value)}
              >
                <option value="">Select an agent</option>
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>{agent.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Reflection Types</label>
              <div className="type-selection">
                {reflectionTypeOptions.map((type) => (
                  <button
                    key={type.value}
                    type="button"
                    className={`type-chip ${reflectionTypes.includes(type.value) ? 'active' : ''}`}
                    onClick={() => toggleReflectionType(type.value)}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            <button 
              className="extract-button" 
              onClick={handleExtractInsights}
              disabled={loading || !insightAgent || reflectionTypes.length === 0}
            >
              {loading ? 'Extracting...' : 'Extract Insights'}
            </button>
          </div>
        )}

        {activeTab === 'plan' && (
          <div className="create-plan">
            <div className="form-group">
              <label htmlFor="improvementAgent">Select Agent</label>
              <select 
                id="improvementAgent" 
                value={improvementAgent}
                onChange={(e) => setImprovementAgent(e.target.value)}
              >
                <option value="">Select an agent</option>
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>{agent.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Improvement Opportunities</label>
              <div className="opportunities-list">
                {opportunities.map((opportunity, index) => (
                  <div key={index} className="opportunity-item">
                    <input
                      type="text"
                      value={opportunity}
                      onChange={(e) => updateOpportunity(index, e.target.value)}
                      placeholder="Describe an improvement opportunity"
                    />
                    {opportunities.length > 1 && (
                      <button 
                        type="button" 
                        className="remove-opportunity"
                        onClick={() => removeOpportunity(index)}
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                ))}
                <button 
                  type="button" 
                  className="add-opportunity"
                  onClick={addOpportunity}
                >
                  <Plus size={14} /> Add Opportunity
                </button>
              </div>
            </div>

            <button 
              className="plan-button" 
              onClick={handleCreateImprovementPlan}
              disabled={loading || !improvementAgent || opportunities.filter(o => o.trim() !== '').length === 0}
            >
              {loading ? 'Creating...' : 'Create Improvement Plan'}
            </button>
          </div>
        )}

        {successMessage && (
          <div className="success-message">
            {successMessage}
          </div>
        )}
      </div>

      <div className="reflection-info">
        <div className="info-card">
          <IterationCcw size={20} />
          <div className="info-content">
            <h3>Reflective Analysis</h3>
            <p>Learn from experiences</p>
          </div>
        </div>
        <div className="info-card">
          <Clipboard size={20} />
          <div className="info-content">
            <h3>Insight Collection</h3>
            <p>Organize learnings</p>
          </div>
        </div>
        <div className="info-card">
          <Target size={20} />
          <div className="info-content">
            <h3>Implementation Plans</h3>
            <p>Turn insights into action</p>
          </div>
        </div>
      </div>
    </div>
  );
};