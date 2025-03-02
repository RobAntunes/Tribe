import React, { useState } from 'react';
import {
  Clock,
  Calendar,
  ArrowRight,
  GitBranch,
  Users,
  UserPlus,
  UserMinus,
  RefreshCw,
  Zap,
  Wrench,
  Award,
  Check,
  X
} from 'lucide-react';
import './styles.css';

export interface HistoryEvent {
  id: string;
  type: 'team_created' | 'agent_added' | 'agent_removed' | 'team_optimized' | 'learning_milestone' | 'tool_added' | 'performance_improvement';
  timestamp: string;
  details: {
    title: string;
    description: string;
    metadata?: Record<string, any>;
  };
}

interface HistoryTrackerProps {
  events: HistoryEvent[];
}

export const HistoryTracker: React.FC<HistoryTrackerProps> = ({ events }) => {
  const [filterType, setFilterType] = useState<string>('all');
  const [timeframe, setTimeframe] = useState<'all' | 'day' | 'week' | 'month'>('all');
  
  // Filter events by type and timeframe
  const filteredEvents = events.filter(event => {
    const typeMatch = filterType === 'all' || event.type === filterType;
    
    if (!typeMatch) return false;
    
    if (timeframe === 'all') return true;
    
    const eventDate = new Date(event.timestamp);
    const now = new Date();
    
    if (timeframe === 'day') {
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      return eventDate >= yesterday;
    }
    
    if (timeframe === 'week') {
      const lastWeek = new Date(now);
      lastWeek.setDate(now.getDate() - 7);
      return eventDate >= lastWeek;
    }
    
    if (timeframe === 'month') {
      const lastMonth = new Date(now);
      lastMonth.setMonth(now.getMonth() - 1);
      return eventDate >= lastMonth;
    }
    
    return true;
  });
  
  // Sort events by timestamp (newest first)
  const sortedEvents = [...filteredEvents].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
  
  // Render event icon based on type
  const renderEventIcon = (type: string) => {
    switch (type) {
      case 'team_created':
        return <Users size={16} />;
      case 'agent_added':
        return <UserPlus size={16} />;
      case 'agent_removed':
        return <UserMinus size={16} />;
      case 'team_optimized':
        return <RefreshCw size={16} />;
      case 'learning_milestone':
        return <Zap size={16} />;
      case 'tool_added':
        return <Wrench size={16} />;
      case 'performance_improvement':
        return <Award size={16} />;
      default:
        return <Clock size={16} />;
    }
  };
  
  return (
    <div className="history-tracker">
      <div className="history-header">
        <h3>Team Evolution History</h3>
        <div className="history-filters">
          <div className="filter-group">
            <label>Event Type:</label>
            <select 
              value={filterType} 
              onChange={(e) => setFilterType(e.target.value)}
              className="filter-select"
            >
              <option value="all">All Events</option>
              <option value="team_created">Team Creation</option>
              <option value="agent_added">Agent Added</option>
              <option value="agent_removed">Agent Removed</option>
              <option value="team_optimized">Team Optimization</option>
              <option value="learning_milestone">Learning Milestone</option>
              <option value="tool_added">Tool Added</option>
              <option value="performance_improvement">Performance Improvement</option>
            </select>
          </div>
          
          <div className="filter-group">
            <label>Timeframe:</label>
            <select 
              value={timeframe} 
              onChange={(e) => setTimeframe(e.target.value as any)}
              className="filter-select"
            >
              <option value="all">All Time</option>
              <option value="day">Last 24 Hours</option>
              <option value="week">Last Week</option>
              <option value="month">Last Month</option>
            </select>
          </div>
        </div>
      </div>
      
      <div className="timeline">
        {sortedEvents.length > 0 ? (
          sortedEvents.map((event) => (
            <div key={event.id} className={`timeline-event ${event.type}`}>
              <div className="event-icon">
                {renderEventIcon(event.type)}
              </div>
              
              <div className="event-content">
                <div className="event-header">
                  <span className="event-title">{event.details.title}</span>
                  <span className="event-time">
                    {new Date(event.timestamp).toLocaleString()}
                  </span>
                </div>
                <p className="event-description">{event.details.description}</p>
                
                {event.details.metadata && (
                  <div className="event-metadata">
                    {Object.entries(event.details.metadata).map(([key, value]) => (
                      <div key={key} className="metadata-item">
                        <span className="metadata-key">{key}:</span>
                        <span className="metadata-value">
                          {typeof value === 'boolean' 
                            ? (value ? <Check size={14} className="success" /> : <X size={14} className="error" />)
                            : value}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="empty-timeline">
            <Calendar size={32} />
            <p>No history events found with the current filters.</p>
          </div>
        )}
      </div>
    </div>
  );
};