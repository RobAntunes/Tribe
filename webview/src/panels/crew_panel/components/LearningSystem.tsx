/** @jsx React.createElement */
/** @jsxRuntime classic */

import React, { useState, useEffect } from 'react';
import { Brain, Database, BarChart2, Upload, Search, List, TrendingUp, Award } from 'lucide-react';
import './LearningSystem.css';

interface Experience {
  agent_id: string;
  context: Record<string, any>;
  decision: string;
  outcome: Record<string, any>;
}

interface LearningProgress {
  experiences: number;
  patterns: number;
  applications: number;
  improvements: number;
}

interface AgentLearningStats {
  id: string;
  name: string;
  progress: LearningProgress;
  topPattern?: string;
  improvementRate?: number;
}

interface LearningSystemProps {
  onCaptureExperience: (experience: Experience) => Promise<any>;
  onExtractPatterns: (agentId: string, topic: string) => Promise<any>;
  agentNames: Record<string, string>;
}

export const LearningSystem: React.FC<LearningSystemProps> = ({
  onCaptureExperience,
  onExtractPatterns,
  agentNames
}) => {
  const [selectedAgent, setSelectedAgent] = useState<string>('');
  const [context, setContext] = useState<string>('');
  const [decision, setDecision] = useState<string>('');
  const [outcome, setOutcome] = useState<string>('');
  const [topic, setTopic] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'capture' | 'extract' | 'metrics'>('capture');
  const [learningStats, setLearningStats] = useState<AgentLearningStats[]>([]);
  const [captureProgress, setCaptureProgress] = useState<number>(0);
  const [extractProgress, setExtractProgress] = useState<number>(0);

  // Generate mock learning stats
  useEffect(() => {
    const mockStats: AgentLearningStats[] = Object.entries(agentNames).map(([id, name]) => ({
      id,
      name,
      progress: {
        experiences: Math.floor(Math.random() * 30),
        patterns: Math.floor(Math.random() * 15),
        applications: Math.floor(Math.random() * 50),
        improvements: Math.floor(Math.random() * 10)
      },
      topPattern: ['Context switching', 'Error handling', 'Task prioritization', 'Code optimization'][Math.floor(Math.random() * 4)],
      improvementRate: Math.floor(Math.random() * 30) + 10
    }));
    
    setLearningStats(mockStats);
  }, [agentNames]);

  const handleCaptureExperience = async () => {
    if (!selectedAgent || !context || !decision || !outcome) {
      return;
    }

    setLoading(true);
    setSuccessMessage('');
    setCaptureProgress(0);
    
    // Simulate progress updates
    const progressInterval = setInterval(() => {
      setCaptureProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return prev;
        }
        return prev + Math.floor(Math.random() * 15);
      });
    }, 300);

    try {
      let contextObj: Record<string, any>;
      let outcomeObj: Record<string, any>;

      try {
        contextObj = JSON.parse(context);
      } catch (e) {
        contextObj = { description: context };
      }

      try {
        outcomeObj = JSON.parse(outcome);
      } catch (e) {
        outcomeObj = { result: outcome };
      }

      const experience: Experience = {
        agent_id: selectedAgent,
        context: contextObj,
        decision,
        outcome: outcomeObj
      };

      await onCaptureExperience(experience);
      
      // Update the learning stats for this agent
      setLearningStats(prev => 
        prev.map(stat => 
          stat.id === selectedAgent 
            ? {
                ...stat, 
                progress: {
                  ...stat.progress,
                  experiences: stat.progress.experiences + 1
                }
              } 
            : stat
        )
      );
      
      setCaptureProgress(100);
      setSuccessMessage('Experience captured successfully');
      
      // Reset form after successful submission
      setContext('');
      setDecision('');
      setOutcome('');
    } catch (error) {
      console.error('Error capturing experience:', error);
      setSuccessMessage('Failed to capture experience');
    } finally {
      clearInterval(progressInterval);
      setLoading(false);
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccessMessage('');
        setCaptureProgress(0);
      }, 3000);
    }
  };

  const handleExtractPatterns = async () => {
    if (!selectedAgent || !topic) {
      return;
    }

    setLoading(true);
    setSuccessMessage('');
    setExtractProgress(0);
    
    // Simulate progress updates
    const progressInterval = setInterval(() => {
      setExtractProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return prev;
        }
        return prev + Math.floor(Math.random() * 10);
      });
    }, 200);

    try {
      await onExtractPatterns(selectedAgent, topic);
      
      // Update the learning stats for this agent
      setLearningStats(prev => 
        prev.map(stat => 
          stat.id === selectedAgent 
            ? {
                ...stat, 
                progress: {
                  ...stat.progress,
                  patterns: stat.progress.patterns + 1
                },
                topPattern: topic
              } 
            : stat
        )
      );
      
      setExtractProgress(100);
      setSuccessMessage('Patterns extracted successfully');
      
      // Reset topic after successful extraction
      setTopic('');
    } catch (error) {
      console.error('Error extracting patterns:', error);
      setSuccessMessage('Failed to extract patterns');
    } finally {
      clearInterval(progressInterval);
      setLoading(false);
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccessMessage('');
        setExtractProgress(0);
      }, 3000);
    }
  };
  
  // Render progress bar
  const renderProgressBar = (progress: number) => {
    return (
      <div className="progress-container">
        <div className="progress-bar">
          <div 
            className="progress-fill" 
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="progress-text">{progress}%</span>
      </div>
    );
  };

  return (
    <div className="learning-system">
      <div className="learning-header">
        <div className="learning-title">
          <Brain className="learning-icon" size={24} />
          <h2>Learning System</h2>
        </div>
        <div className="learning-tabs">
          <button 
            className={`learning-tab ${activeTab === 'capture' ? 'active' : ''}`}
            onClick={() => setActiveTab('capture')}
          >
            <Upload size={16} />
            <span>Capture Experience</span>
          </button>
          <button 
            className={`learning-tab ${activeTab === 'extract' ? 'active' : ''}`}
            onClick={() => setActiveTab('extract')}
          >
            <Search size={16} />
            <span>Extract Patterns</span>
          </button>
          <button 
            className={`learning-tab ${activeTab === 'metrics' ? 'active' : ''}`}
            onClick={() => setActiveTab('metrics')}
          >
            <TrendingUp size={16} />
            <span>Learning Metrics</span>
          </button>
        </div>
      </div>

      <div className="learning-content">
        {activeTab === 'capture' ? (
          <div className="capture-experience">
            <div className="form-group">
              <label htmlFor="agent">Select Agent</label>
              <select 
                id="agent" 
                value={selectedAgent}
                onChange={(e) => setSelectedAgent(e.target.value)}
              >
                <option value="">Select an agent</option>
                {Object.entries(agentNames).map(([id, name]) => (
                  <option key={id} value={id}>{name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="context">Context</label>
              <textarea
                id="context"
                placeholder="Describe the situation or provide a JSON object"
                value={context}
                onChange={(e) => setContext(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label htmlFor="decision">Decision</label>
              <input
                id="decision"
                type="text"
                placeholder="What was decided?"
                value={decision}
                onChange={(e) => setDecision(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label htmlFor="outcome">Outcome</label>
              <textarea
                id="outcome"
                placeholder="What happened as a result? (text or JSON)"
                value={outcome}
                onChange={(e) => setOutcome(e.target.value)}
              />
            </div>

            <button 
              className="capture-button" 
              onClick={handleCaptureExperience}
              disabled={loading || !selectedAgent || !context || !decision || !outcome}
            >
              {loading ? 'Capturing...' : 'Capture Experience'}
            </button>
            
            {captureProgress > 0 && renderProgressBar(captureProgress)}
          </div>
        ) : activeTab === 'extract' ? (
          <div className="extract-patterns">
            <div className="form-group">
              <label htmlFor="extractAgent">Select Agent</label>
              <select 
                id="extractAgent" 
                value={selectedAgent}
                onChange={(e) => setSelectedAgent(e.target.value)}
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
                id="topic"
                type="text"
                placeholder="Which area to analyze? (e.g., coding, debugging, design)"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
              />
            </div>

            <button 
              className="extract-button" 
              onClick={handleExtractPatterns}
              disabled={loading || !selectedAgent || !topic}
            >
              {loading ? 'Extracting...' : 'Extract Patterns'}
            </button>
            
            {extractProgress > 0 && renderProgressBar(extractProgress)}
          </div>
        ) : (
          <div className="learning-metrics">
            <h3 className="metrics-title">Agent Learning Progress</h3>
            
            <div className="agent-stats-container">
              {learningStats.map(stat => (
                <div key={stat.id} className="agent-stat-card">
                  <div className="agent-stat-header">
                    <h4>{stat.name}</h4>
                    {stat.improvementRate && (
                      <div className="improvement-rate">
                        <TrendingUp size={14} />
                        <span>{stat.improvementRate}%</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="stat-progress-bars">
                    <div className="stat-item">
                      <label>Experiences</label>
                      <div className="stat-bar-container">
                        <div 
                          className="stat-bar-fill" 
                          style={{ width: `${Math.min(100, stat.progress.experiences * 3.3)}%` }}
                        />
                        <span className="stat-value">{stat.progress.experiences}</span>
                      </div>
                    </div>
                    
                    <div className="stat-item">
                      <label>Patterns</label>
                      <div className="stat-bar-container">
                        <div 
                          className="stat-bar-fill patterns-fill" 
                          style={{ width: `${Math.min(100, stat.progress.patterns * 6.6)}%` }}
                        />
                        <span className="stat-value">{stat.progress.patterns}</span>
                      </div>
                    </div>
                    
                    <div className="stat-item">
                      <label>Applications</label>
                      <div className="stat-bar-container">
                        <div 
                          className="stat-bar-fill applications-fill" 
                          style={{ width: `${Math.min(100, stat.progress.applications * 2)}%` }}
                        />
                        <span className="stat-value">{stat.progress.applications}</span>
                      </div>
                    </div>
                  </div>
                  
                  {stat.topPattern && (
                    <div className="top-pattern">
                      <Award size={14} />
                      <span>Top Pattern: {stat.topPattern}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {successMessage && (
          <div className="success-message">
            {successMessage}
          </div>
        )}
      </div>

      <div className="learning-info">
        <div className="info-card">
          <Database size={20} />
          <div className="info-content">
            <h3>Experience Database</h3>
            <p>Stores agent experiences</p>
          </div>
        </div>
        <div className="info-card">
          <List size={20} />
          <div className="info-content">
            <h3>Pattern Library</h3>
            <p>Organizes learned patterns</p>
          </div>
        </div>
        <div className="info-card">
          <BarChart2 size={20} />
          <div className="info-content">
            <h3>Learning Metrics</h3>
            <p>Tracks improvement</p>
          </div>
        </div>
      </div>
    </div>
  );
};