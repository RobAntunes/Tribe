/** @jsx React.createElement */
/** @jsxRuntime classic */

import React, { useState } from 'react';
import { MessageSquare, Star, BarChart2, Filter, Send } from 'lucide-react';
import './FeedbackSystem.css';

interface FeedbackSubmission {
  sourceId: string;
  targetId: string;
  feedbackType: string;
  content: {
    rating: number;
    message: string;
    areas?: string[];
  };
}

interface FeedbackAnalysisRequest {
  targetId: string;
  feedbackTypes: string[];
}

interface FeedbackSystemProps {
  agents: Array<{ id: string; name: string }>;
  onSubmitFeedback?: (feedback: FeedbackSubmission) => Promise<any>;
  onAnalyzeFeedback?: (request: FeedbackAnalysisRequest) => Promise<any>;
  userId?: string;
}

export const FeedbackSystem: React.FC<FeedbackSystemProps> = ({
  agents,
  onSubmitFeedback,
  onAnalyzeFeedback,
  userId = 'user'
}) => {
  const [selectedAgent, setSelectedAgent] = useState<string>('');
  const [feedbackType, setFeedbackType] = useState<string>('performance');
  const [rating, setRating] = useState<number>(3);
  const [message, setMessage] = useState<string>('');
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [analysisTargetId, setAnalysisTargetId] = useState<string>('');
  const [analysisTypes, setAnalysisTypes] = useState<string[]>(['performance', 'quality']);
  const [activeTab, setActiveTab] = useState<'submit' | 'analyze'>('submit');

  const feedbackTypes = [
    { value: 'performance', label: 'Performance' },
    { value: 'quality', label: 'Output Quality' },
    { value: 'communication', label: 'Communication' },
    { value: 'collaboration', label: 'Collaboration' },
    { value: 'technical', label: 'Technical Skills' }
  ];

  const feedbackAreas = [
    { value: 'speed', label: 'Speed' },
    { value: 'accuracy', label: 'Accuracy' },
    { value: 'thoroughness', label: 'Thoroughness' },
    { value: 'creativity', label: 'Creativity' },
    { value: 'clarity', label: 'Clarity' },
    { value: 'documentation', label: 'Documentation' }
  ];

  const handleSubmitFeedback = async () => {
    if (!selectedAgent || !message) {
      return;
    }

    setLoading(true);
    setSuccessMessage('');

    try {
      const feedback: FeedbackSubmission = {
        sourceId: userId,
        targetId: selectedAgent,
        feedbackType,
        content: {
          rating,
          message,
          areas: selectedAreas
        }
      };

      if (onSubmitFeedback) {
        await onSubmitFeedback(feedback);
        setSuccessMessage('Feedback submitted successfully');
        
        // Reset form after successful submission
        setMessage('');
        setRating(3);
        setSelectedAreas([]);
      }
    } catch (error) {
      console.error('Error submitting feedback:', error);
      setSuccessMessage('Failed to submit feedback');
    } finally {
      setLoading(false);
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);
    }
  };

  const handleAnalyzeFeedback = async () => {
    if (!analysisTargetId) {
      return;
    }

    setLoading(true);
    setSuccessMessage('');

    try {
      const request: FeedbackAnalysisRequest = {
        targetId: analysisTargetId,
        feedbackTypes: analysisTypes
      };

      if (onAnalyzeFeedback) {
        await onAnalyzeFeedback(request);
        setSuccessMessage('Feedback analysis requested successfully');
      }
    } catch (error) {
      console.error('Error analyzing feedback:', error);
      setSuccessMessage('Failed to analyze feedback');
    } finally {
      setLoading(false);
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);
    }
  };

  const toggleArea = (area: string) => {
    if (selectedAreas.includes(area)) {
      setSelectedAreas(selectedAreas.filter(a => a !== area));
    } else {
      setSelectedAreas([...selectedAreas, area]);
    }
  };

  const toggleAnalysisType = (type: string) => {
    if (analysisTypes.includes(type)) {
      setAnalysisTypes(analysisTypes.filter(t => t !== type));
    } else {
      setAnalysisTypes([...analysisTypes, type]);
    }
  };

  return (
    <div className="feedback-system">
      <div className="feedback-header">
        <div className="feedback-title">
          <MessageSquare className="feedback-icon" size={24} />
          <h2>Feedback System</h2>
        </div>
        <div className="feedback-tabs">
          <button 
            className={`feedback-tab ${activeTab === 'submit' ? 'active' : ''}`}
            onClick={() => setActiveTab('submit')}
          >
            <Send size={16} />
            <span>Submit Feedback</span>
          </button>
          <button 
            className={`feedback-tab ${activeTab === 'analyze' ? 'active' : ''}`}
            onClick={() => setActiveTab('analyze')}
          >
            <BarChart2 size={16} />
            <span>Analyze Feedback</span>
          </button>
        </div>
      </div>

      <div className="feedback-content">
        {activeTab === 'submit' ? (
          <div className="submit-feedback">
            <div className="form-group">
              <label htmlFor="agent">Select Agent</label>
              <select 
                id="agent" 
                value={selectedAgent}
                onChange={(e) => setSelectedAgent(e.target.value)}
              >
                <option value="">Select an agent</option>
                {agents.map((agent) => (
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
              >
                {feedbackTypes.map((type) => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Rating</label>
              <div className="rating-container">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={`rating-star ${value <= rating ? 'active' : ''}`}
                    onClick={() => setRating(value)}
                  >
                    <Star size={20} />
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label>Areas of Focus</label>
              <div className="areas-container">
                {feedbackAreas.map((area) => (
                  <button
                    key={area.value}
                    type="button"
                    className={`area-tag ${selectedAreas.includes(area.value) ? 'active' : ''}`}
                    onClick={() => toggleArea(area.value)}
                  >
                    {area.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="message">Feedback Message</label>
              <textarea
                id="message"
                placeholder="Provide detailed feedback..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>

            <button 
              className="submit-button" 
              onClick={handleSubmitFeedback}
              disabled={loading || !selectedAgent || !message}
            >
              {loading ? 'Submitting...' : 'Submit Feedback'}
            </button>
          </div>
        ) : (
          <div className="analyze-feedback">
            <div className="form-group">
              <label htmlFor="analysisTarget">Select Target Agent</label>
              <select 
                id="analysisTarget" 
                value={analysisTargetId}
                onChange={(e) => setAnalysisTargetId(e.target.value)}
              >
                <option value="">Select an agent</option>
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>{agent.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Feedback Types to Analyze</label>
              <div className="areas-container">
                {feedbackTypes.map((type) => (
                  <button
                    key={type.value}
                    type="button"
                    className={`area-tag ${analysisTypes.includes(type.value) ? 'active' : ''}`}
                    onClick={() => toggleAnalysisType(type.value)}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            <button 
              className="analyze-button" 
              onClick={handleAnalyzeFeedback}
              disabled={loading || !analysisTargetId || analysisTypes.length === 0}
            >
              {loading ? 'Analyzing...' : 'Analyze Feedback'}
            </button>
          </div>
        )}

        {successMessage && (
          <div className="success-message">
            {successMessage}
          </div>
        )}
      </div>

      <div className="feedback-info">
        <div className="info-card">
          <MessageSquare size={20} />
          <div className="info-content">
            <h3>Feedback Collection</h3>
            <p>From users and other agents</p>
          </div>
        </div>
        <div className="info-card">
          <Filter size={20} />
          <div className="info-content">
            <h3>Pattern Analysis</h3>
            <p>Identify improvement areas</p>
          </div>
        </div>
        <div className="info-card">
          <BarChart2 size={20} />
          <div className="info-content">
            <h3>Performance Tracking</h3>
            <p>Track improvement over time</p>
          </div>
        </div>
      </div>
    </div>
  );
};