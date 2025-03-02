import React, { useState, useEffect } from 'react';
import { 
  Briefcase, 
  Calendar, 
  CheckSquare, 
  Clock, 
  Users, 
  Plus, 
  ChevronDown, 
  ChevronUp, 
  Download, 
  Edit, 
  Trash2, 
  Play,
  Pause,
  BarChart2,
  Filter,
  Search
} from 'lucide-react';
import './ProjectManagementSystem.css';

// Define interfaces for our data structures
interface Task {
  id: string;
  title: string;
  description: string;
  status: 'todo' | 'in_progress' | 'review' | 'done';
  priority: 'low' | 'medium' | 'high' | 'critical';
  assignee?: string;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
  dependencies?: string[];
  tags?: string[];
  estimatedHours?: number;
  actualHours?: number;
  progress?: number;
}

interface Project {
  id: string;
  name: string;
  description: string;
  status: 'planning' | 'active' | 'on_hold' | 'completed';
  startDate: string;
  endDate?: string;
  tasks: Task[];
  team: string[];
  createdAt: string;
  updatedAt: string;
}

interface Team {
  id: string;
  name: string;
  members: string[];
  createdAt: string;
  updatedAt: string;
}

interface ProjectManagementSystemProps {
  agents: Array<{ id: string; name: string }>;
  onCreateTask: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Task>;
  onUpdateTask: (taskId: string, updates: Partial<Task>) => Promise<Task>;
  onDeleteTask: (taskId: string) => Promise<boolean>;
  onCreateProject: (project: Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'tasks'>) => Promise<Project>;
  onUpdateProject: (projectId: string, updates: Partial<Project>) => Promise<Project>;
  onDeleteProject: (projectId: string) => Promise<boolean>;
  projects?: Project[];
  teams?: Team[];
}

export const ProjectManagementSystem: React.FC<ProjectManagementSystemProps> = ({
  agents,
  onCreateTask,
  onUpdateTask,
  onDeleteTask,
  onCreateProject,
  onUpdateProject,
  onDeleteProject,
  projects = [],
  teams = []
}) => {
  // Tab navigation
  const [activeTab, setActiveTab] = useState<'projects' | 'tasks' | 'teams'>('projects');
  
  // Project state
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [showCreateProjectForm, setShowCreateProjectForm] = useState(false);
  const [expandedProjects, setExpandedProjects] = useState<string[]>([]);
  
  // Task state
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [showCreateTaskForm, setShowCreateTaskForm] = useState(false);
  const [taskFilter, setTaskFilter] = useState<{
    status?: string;
    priority?: string;
    assignee?: string;
    search?: string;
  }>({});
  
  // Define newTask state here before it's used
  const [newTask, setNewTask] = useState<Omit<Task, 'id' | 'createdAt' | 'updatedAt'> & { projectId?: string }>({
    title: '',
    description: '',
    status: 'todo',
    priority: 'medium',
    projectId: selectedProject || undefined
  });
  
  // Define handleCreateTask function before it's used
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newTask.title) {
      alert('Please enter a task title');
      return;
    }
    
    if (newTask.projectId) {
      try {
        const createdTask = await onCreateTask({
          ...newTask,
          assignee: newTask.assignee || '',
          dueDate: newTask.dueDate || '',
        });
        
        console.log('Task created:', createdTask);
        setShowCreateTaskForm(false);
        resetNewTask();
      } catch (error) {
        console.error('Error creating task:', error);
        alert('Failed to create task');
      }
    } else {
      alert('Please select a project for this task');
    }
  };
  
  // Team state
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  
  // Loading states
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [isUpdatingProject, setIsUpdatingProject] = useState(false);
  const [isUpdatingTask, setIsUpdatingTask] = useState(false);
  
  // Toggle expanded state for projects
  const toggleProjectExpand = (projectId: string) => {
    setExpandedProjects(prev => 
      prev.includes(projectId) ? prev.filter(id => id !== projectId) : [...prev, projectId]
    );
  };
  
  // Get all tasks across all projects
  const allTasks = projects.flatMap(project => project.tasks);
  
  // Filter tasks based on current filter
  const filteredTasks = allTasks.filter(task => {
    if (taskFilter.status && task.status !== taskFilter.status) return false;
    if (taskFilter.priority && task.priority !== taskFilter.priority) return false;
    if (taskFilter.assignee && task.assignee !== taskFilter.assignee) return false;
    if (taskFilter.search && !task.title.toLowerCase().includes(taskFilter.search.toLowerCase())) return false;
    return true;
  });
  
  // Get agent name by ID
  const getAgentName = (agentId: string) => {
    const agent = agents.find(a => a.id === agentId);
    return agent ? agent.name : agentId;
  };
  
  // Initialize new project state
  const [newProject, setNewProject] = useState<Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'tasks'>>({
    name: '',
    description: '',
    status: 'planning',
    startDate: new Date().toISOString().split('T')[0],
    team: []
  });
  
  // Reset new project form
  const resetNewProject = () => {
    setNewProject({
      name: '',
      description: '',
      status: 'planning',
      startDate: new Date().toISOString().split('T')[0],
      team: []
    });
  };
  
  // Handle project creation
  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingProject(true);
    
    try {
      await onCreateProject(newProject);
      setShowCreateProjectForm(false);
      resetNewProject();
    } catch (error) {
      console.error('Error creating project:', error);
    } finally {
      setIsCreatingProject(false);
    }
  };
  
  // Handle project editing
  const handleEditProject = (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    
    // Implement project editing logic
    console.log('Edit project:', projectId);
  };
  
  // Handle project deletion
  const handleDeleteProject = async (projectId: string) => {
    if (window.confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
      try {
        await onDeleteProject(projectId);
      } catch (error) {
        console.error('Error deleting project:', error);
      }
    }
  };
  
  return (
    <div className="project-management-system tribe-card">
      <div className="project-management-header">
        <div className="project-management-icon">
          <Briefcase size={24} />
        </div>
        <h2>Project Management System</h2>
      </div>
      
      <div className="project-management-tabs">
        <button 
          className={`project-management-tab ${activeTab === 'projects' ? 'active' : ''}`}
          onClick={() => setActiveTab('projects')}
        >
          <Briefcase size={16} />
          <span>Projects</span>
        </button>
        <button 
          className={`project-management-tab ${activeTab === 'tasks' ? 'active' : ''}`}
          onClick={() => setActiveTab('tasks')}
        >
          <CheckSquare size={16} />
          <span>Tasks</span>
        </button>
        <button 
          className={`project-management-tab ${activeTab === 'teams' ? 'active' : ''}`}
          onClick={() => setActiveTab('teams')}
        >
          <Users size={16} />
          <span>Teams</span>
        </button>
      </div>
      
      <div className="project-management-content">
        {activeTab === 'projects' ? (
          <div className="projects-tab">
            <div className="tab-actions">
              <button 
                className="action-button"
                onClick={() => setShowCreateProjectForm(!showCreateProjectForm)}
              >
                <Plus size={16} />
                {showCreateProjectForm ? 'Cancel' : 'Create Project'}
              </button>
            </div>
            
            {showCreateProjectForm && (
              <div className="create-form-container">
                <h3>Create New Project</h3>
                <form onSubmit={handleCreateProject}>
                  <div className="form-group">
                    <label htmlFor="projectName">Project Name</label>
                    <input
                      type="text"
                      id="projectName"
                      value={newProject.name}
                      onChange={(e) => setNewProject({...newProject, name: e.target.value})}
                      required
                    />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="projectDescription">Description</label>
                    <textarea
                      id="projectDescription"
                      value={newProject.description}
                      onChange={(e) => setNewProject({...newProject, description: e.target.value})}
                      rows={3}
                      required
                    />
                  </div>
                  
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="projectStatus">Status</label>
                      <select
                        id="projectStatus"
                        value={newProject.status}
                        onChange={(e) => setNewProject({...newProject, status: e.target.value as any})}
                        required
                      >
                        <option value="planning">Planning</option>
                        <option value="active">Active</option>
                        <option value="on_hold">On Hold</option>
                        <option value="completed">Completed</option>
                      </select>
                    </div>
                    
                    <div className="form-group">
                      <label htmlFor="projectStartDate">Start Date</label>
                      <input
                        type="date"
                        id="projectStartDate"
                        value={newProject.startDate}
                        onChange={(e) => setNewProject({...newProject, startDate: e.target.value})}
                        required
                      />
                    </div>
                    
                    <div className="form-group">
                      <label htmlFor="projectEndDate">End Date (Optional)</label>
                      <input
                        type="date"
                        id="projectEndDate"
                        value={newProject.endDate || ''}
                        onChange={(e) => setNewProject({...newProject, endDate: e.target.value})}
                      />
                    </div>
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="projectTeam">Team Members</label>
                    <div className="checkbox-group">
                      {agents.map(agent => (
                        <div key={agent.id} className="checkbox-item">
                          <input
                            type="checkbox"
                            id={`team-member-${agent.id}`}
                            checked={newProject.team.includes(agent.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setNewProject({...newProject, team: [...newProject.team, agent.id]});
                              } else {
                                setNewProject({...newProject, team: newProject.team.filter(id => id !== agent.id)});
                              }
                            }}
                          />
                          <label htmlFor={`team-member-${agent.id}`}>{agent.name}</label>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="form-actions">
                    <button 
                      type="button" 
                      className="cancel-button"
                      onClick={() => {
                        setShowCreateProjectForm(false);
                        resetNewProject();
                      }}
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit" 
                      className="submit-button"
                      disabled={isCreatingProject}
                    >
                      {isCreatingProject ? (
                        <>
                          <div className="spinner"></div>
                          Creating...
                        </>
                      ) : (
                        <>
                          <Plus size={14} />
                          Create Project
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            )}
            
            <div className="projects-list">
              <h3>Projects ({projects.length})</h3>
              
              {projects.length === 0 ? (
                <div className="empty-state">
                  <p>No projects created yet.</p>
                  <button 
                    className="action-button"
                    onClick={() => setShowCreateProjectForm(true)}
                  >
                    <Plus size={16} />
                    Create First Project
                  </button>
                </div>
              ) : (
                <>
                  {projects.map((project) => (
                    <div 
                      key={project.id} 
                      className={`project-item ${expandedProjects.includes(project.id) ? 'expanded' : ''} status-${project.status}`}
                    >
                      <div 
                        className="project-header"
                        onClick={() => toggleProjectExpand(project.id)}
                      >
                        <div className="project-title">
                          <span className="project-name">{project.name}</span>
                          <span className={`project-status status-${project.status}`}>
                            {project.status.replace('_', ' ')}
                          </span>
                        </div>
                        <div className="project-meta">
                          <span className="project-dates">
                            <Calendar size={14} />
                            {new Date(project.startDate).toLocaleDateString()} 
                            {project.endDate && ` - ${new Date(project.endDate).toLocaleDateString()}`}
                          </span>
                          <span className="project-team-count">
                            <Users size={14} />
                            {project.team.length} member{project.team.length !== 1 ? 's' : ''}
                          </span>
                          <button className="expand-button">
                            {expandedProjects.includes(project.id) ? (
                              <ChevronUp size={16} />
                            ) : (
                              <ChevronDown size={16} />
                            )}
                          </button>
                        </div>
                      </div>
                      
                      {expandedProjects.includes(project.id) && (
                        <div className="project-details">
                          <div className="detail-section">
                            <h4>Description</h4>
                            <p>{project.description}</p>
                          </div>
                          
                          <div className="detail-section">
                            <h4>Team Members</h4>
                            <div className="team-members-list">
                              {project.team.map(memberId => (
                                <span key={memberId} className="team-member-tag">
                                  {getAgentName(memberId)}
                                </span>
                              ))}
                            </div>
                          </div>
                          
                          <div className="detail-section">
                            <div className="section-header">
                              <h4>Tasks ({project.tasks.length})</h4>
                              <button 
                                className="action-button-small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedProject(project.id);
                                  setShowCreateTaskForm(true);
                                  setActiveTab('tasks');
                                }}
                              >
                                <Plus size={14} />
                                Add Task
                              </button>
                            </div>
                            
                            {project.tasks.length === 0 ? (
                              <p className="no-tasks-message">No tasks created for this project yet.</p>
                            ) : (
                              <div className="tasks-summary">
                                <div className="task-status-counts">
                                  <div className="task-status-count status-todo">
                                    <span className="count">{project.tasks.filter(t => t.status === 'todo').length}</span>
                                    <span className="label">To Do</span>
                                  </div>
                                  <div className="task-status-count status-in_progress">
                                    <span className="count">{project.tasks.filter(t => t.status === 'in_progress').length}</span>
                                    <span className="label">In Progress</span>
                                  </div>
                                  <div className="task-status-count status-review">
                                    <span className="count">{project.tasks.filter(t => t.status === 'review').length}</span>
                                    <span className="label">Review</span>
                                  </div>
                                  <div className="task-status-count status-done">
                                    <span className="count">{project.tasks.filter(t => t.status === 'done').length}</span>
                                    <span className="label">Done</span>
                                  </div>
                                </div>
                                
                                <div className="task-progress-bar">
                                  <div 
                                    className="progress-fill" 
                                    style={{ 
                                      width: `${(project.tasks.filter(t => t.status === 'done').length / project.tasks.length) * 100}%` 
                                    }}
                                  ></div>
                                </div>
                              </div>
                            )}
                          </div>
                          
                          <div className="project-actions">
                            <button 
                              className="action-button-small"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditProject(project.id);
                              }}
                            >
                              <Edit size={14} />
                              Edit
                            </button>
                            <button 
                              className="action-button-small"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteProject(project.id);
                              }}
                            >
                              <Trash2 size={14} />
                              Delete
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
        ) : activeTab === 'tasks' ? (
          <div className="tasks-tab">
            <div className="tab-actions">
              <button 
                className="action-button"
                onClick={() => setShowCreateTaskForm(!showCreateTaskForm)}
              >
                <Plus size={16} />
                {showCreateTaskForm ? 'Cancel' : 'Create Task'}
              </button>
            </div>
            
            {showCreateTaskForm && (
              <div className="create-form-container">
                <h3>Create New Task</h3>
                <form onSubmit={handleCreateTask}>
                  <div className="form-group">
                    <label htmlFor="taskProject">Project</label>
                    <select
                      id="taskProject"
                      value={newTask.projectId || ''}
                      onChange={(e) => setNewTask({...newTask, projectId: e.target.value})}
                      required
                    >
                      <option value="">Select a project</option>
                      {projects.map(project => (
                        <option key={project.id} value={project.id}>{project.name}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="taskTitle">Task Title</label>
                    <input
                      type="text"
                      id="taskTitle"
                      value={newTask.title}
                      onChange={(e) => setNewTask({...newTask, title: e.target.value})}
                      required
                    />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="taskDescription">Description</label>
                    <textarea
                      id="taskDescription"
                      value={newTask.description}
                      onChange={(e) => setNewTask({...newTask, description: e.target.value})}
                      rows={3}
                      required
                    />
                  </div>
                  
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="taskStatus">Status</label>
                      <select
                        id="taskStatus"
                        value={newTask.status}
                        onChange={(e) => setNewTask({...newTask, status: e.target.value as any})}
                        required
                      >
                        <option value="todo">To Do</option>
                        <option value="in_progress">In Progress</option>
                        <option value="review">Review</option>
                        <option value="done">Done</option>
                      </select>
                    </div>
                    
                    <div className="form-group">
                      <label htmlFor="taskPriority">Priority</label>
                      <select
                        id="taskPriority"
                        value={newTask.priority}
                        onChange={(e) => setNewTask({...newTask, priority: e.target.value as any})}
                        required
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="critical">Critical</option>
                      </select>
                    </div>
                  </div>
                  
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="taskAssignee">Assignee</label>
                      <select
                        id="taskAssignee"
                        value={newTask.assignee || ''}
                        onChange={(e) => setNewTask({...newTask, assignee: e.target.value || undefined})}
                      >
                        <option value="">Unassigned</option>
                        {agents.map(agent => (
                          <option key={agent.id} value={agent.id}>{agent.name}</option>
                        ))}
                      </select>
                    </div>
                    
                    <div className="form-group">
                      <label htmlFor="taskDueDate">Due Date (Optional)</label>
                      <input
                        type="date"
                        id="taskDueDate"
                        value={newTask.dueDate || ''}
                        onChange={(e) => setNewTask({...newTask, dueDate: e.target.value || undefined})}
                      />
                    </div>
                  </div>
                  
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="taskEstimatedHours">Estimated Hours (Optional)</label>
                      <input
                        type="number"
                        id="taskEstimatedHours"
                        min="0"
                        step="0.5"
                        value={newTask.estimatedHours || ''}
                        onChange={(e) => setNewTask({...newTask, estimatedHours: e.target.value ? parseFloat(e.target.value) : undefined})}
                      />
                    </div>
                    
                    <div className="form-group">
                      <label htmlFor="taskTags">Tags (Comma-separated, Optional)</label>
                      <input
                        type="text"
                        id="taskTags"
                        value={newTask.tags ? newTask.tags.join(', ') : ''}
                        onChange={(e) => {
                          const tagsArray = e.target.value.split(',').map(tag => tag.trim()).filter(Boolean);
                          setNewTask({...newTask, tags: tagsArray.length > 0 ? tagsArray : undefined});
                        }}
                      />
                    </div>
                  </div>
                  
                  <div className="form-actions">
                    <button 
                      type="button" 
                      className="cancel-button"
                      onClick={() => {
                        setShowCreateTaskForm(false);
                        resetNewTask();
                      }}
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit" 
                      className="submit-button"
                      disabled={isCreatingTask}
                    >
                      {isCreatingTask ? (
                        <>
                          <div className="spinner"></div>
                          Creating...
                        </>
                      ) : (
                        <>
                          <Plus size={14} />
                          Create Task
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            )}
            
            <div className="task-filters">
              <div className="filter-group">
                <label>Status</label>
                <select
                  value={taskFilter.status || ''}
                  onChange={(e) => setTaskFilter({...taskFilter, status: e.target.value || undefined})}
                >
                  <option value="">All</option>
                  <option value="todo">To Do</option>
                  <option value="in_progress">In Progress</option>
                  <option value="review">Review</option>
                  <option value="done">Done</option>
                </select>
              </div>
              
              <div className="filter-group">
                <label>Priority</label>
                <select
                  value={taskFilter.priority || ''}
                  onChange={(e) => setTaskFilter({...taskFilter, priority: e.target.value || undefined})}
                >
                  <option value="">All</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              
              <div className="filter-group">
                <label>Assignee</label>
                <select
                  value={taskFilter.assignee || ''}
                  onChange={(e) => setTaskFilter({...taskFilter, assignee: e.target.value || undefined})}
                >
                  <option value="">All</option>
                  <option value="unassigned">Unassigned</option>
                  {agents.map(agent => (
                    <option key={agent.id} value={agent.id}>{agent.name}</option>
                  ))}
                </select>
              </div>
              
              <div className="filter-group search-group">
                <label>Search</label>
                <div className="search-input-container">
                  <input
                    type="text"
                    placeholder="Search tasks..."
                    value={taskFilter.search || ''}
                    onChange={(e) => setTaskFilter({...taskFilter, search: e.target.value || undefined})}
                  />
                  <Search size={16} />
                </div>
              </div>
              
              <button 
                className="clear-filters-button"
                onClick={() => setTaskFilter({})}
              >
                Clear Filters
              </button>
            </div>
            
            <div className="tasks-list">
              <h3>Tasks ({filteredTasks.length})</h3>
              
              {filteredTasks.length === 0 ? (
                <div className="empty-state">
                  <p>No tasks found matching your filters.</p>
                  <button 
                    className="action-button"
                    onClick={() => {
                      setTaskFilter({});
                      setShowCreateTaskForm(true);
                    }}
                  >
                    <Plus size={16} />
                    Create New Task
                  </button>
                </div>
              ) : (
                <div className="tasks-grid">
                  {filteredTasks.map((task) => {
                    const project = projects.find(p => p.tasks.some(t => t.id === task.id));
                    
                    return (
                      <div 
                        key={task.id} 
                        className={`task-card priority-${task.priority} status-${task.status}`}
                        onClick={() => handleTaskClick(task.id)}
                      >
                        <div className="task-card-header">
                          <div className="task-card-project">
                            {project ? project.name : 'No Project'}
                          </div>
                          <div className={`task-card-priority priority-${task.priority}`}>
                            {task.priority}
                          </div>
                        </div>
                        
                        <h4 className="task-card-title">{task.title}</h4>
                        
                        <div className="task-card-description">
                          {task.description.length > 100 
                            ? `${task.description.substring(0, 100)}...` 
                            : task.description}
                        </div>
                        
                        <div className="task-card-meta">
                          <div className="task-card-assignee">
                            {task.assignee 
                              ? <span className="assignee-name">{getAgentName(task.assignee)}</span>
                              : <span className="unassigned">Unassigned</span>
                            }
                          </div>
                          
                          {task.dueDate && (
                            <div className="task-card-due-date">
                              <Calendar size={14} />
                              {new Date(task.dueDate).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                        
                        <div className="task-card-footer">
                          <div className={`task-card-status status-${task.status}`}>
                            {task.status.replace('_', ' ')}
                          </div>
                          
                          <div className="task-card-actions">
                            <button 
                              className="task-action-button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditTask(task.id);
                              }}
                            >
                              <Edit size={14} />
                            </button>
                            <button 
                              className="task-action-button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteTask(task.id);
                              }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="teams-tab">
            <div className="teams-list">
              <h3>Teams ({teams.length})</h3>
              
              {teams.length === 0 ? (
                <div className="empty-state">
                  <p>No teams created yet.</p>
                  <p className="secondary-message">Teams are automatically created when you add members to projects.</p>
                </div>
              ) : (
                <>
                  {teams.map((team) => (
                    <div 
                      key={team.id} 
                      className="team-item"
                    >
                      <div className="team-header">
                        <div className="team-title">
                          <Users size={18} />
                          <h4>{team.name}</h4>
                        </div>
                        <div className="team-meta">
                          <span className="team-member-count">
                            {team.members.length} member{team.members.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>
                      
                      <div className="team-members">
                        {team.members.map(memberId => (
                          <div key={memberId} className="team-member">
                            <div className="member-avatar">
                              {getAgentName(memberId).charAt(0)}
                            </div>
                            <div className="member-name">
                              {getAgentName(memberId)}
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      <div className="team-projects">
                        <h5>Projects</h5>
                        <div className="team-projects-list">
                          {projects
                            .filter(project => project.team.some(memberId => team.members.includes(memberId)))
                            .map(project => (
                              <div 
                                key={project.id} 
                                className="team-project-item"
                                onClick={() => {
                                  setSelectedProject(project.id);
                                  setActiveTab('projects');
                                  setExpandedProjects(prev => 
                                    prev.includes(project.id) ? prev : [...prev, project.id]
                                  );
                                }}
                              >
                                <Briefcase size={14} />
                                <span>{project.name}</span>
                              </div>
                            ))}
                            
                          {projects.filter(project => 
                            project.team.some(memberId => team.members.includes(memberId))
                          ).length === 0 && (
                            <p className="no-projects-message">No projects assigned to this team yet.</p>
                          )}
                        </div>
                      </div>
                      
                      <div className="team-stats">
                        <div className="team-stat">
                          <div className="stat-label">Active Tasks</div>
                          <div className="stat-value">
                            {projects
                              .filter(project => project.team.some(memberId => team.members.includes(memberId)))
                              .flatMap(project => project.tasks)
                              .filter(task => task.status !== 'done').length}
                          </div>
                        </div>
                        <div className="team-stat">
                          <div className="stat-label">Completed Tasks</div>
                          <div className="stat-value">
                            {projects
                              .filter(project => project.team.some(memberId => team.members.includes(memberId)))
                              .flatMap(project => project.tasks)
                              .filter(task => task.status === 'done').length}
                          </div>
                        </div>
                        <div className="team-stat">
                          <div className="stat-label">Projects</div>
                          <div className="stat-value">
                            {projects
                              .filter(project => project.team.some(memberId => team.members.includes(memberId)))
                              .length}
                          </div>
                        </div>
                      </div>
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
  
  // Reset new task form
  const resetNewTask = () => {
    setNewTask({
      title: '',
      description: '',
      status: 'todo',
      priority: 'medium',
      projectId: selectedProject || undefined
    });
  };
  
  // Handle task click
  const handleTaskClick = (taskId: string) => {
    // Implement task details view
    console.log('View task details:', taskId);
  };
  
  // Handle task editing
  const handleEditTask = (taskId: string) => {
    // Find the task
    const task = allTasks.find(t => t.id === taskId);
    if (!task) return;
    
    // Implement task editing logic
    console.log('Edit task:', taskId);
  };
  
  // Handle task deletion
  const handleDeleteTask = async (taskId: string) => {
    if (window.confirm('Are you sure you want to delete this task? This action cannot be undone.')) {
      try {
        // Find which project contains this task
        const project = projects.find(p => p.tasks.some(t => t.id === taskId));
        if (!project) return;
        
        // Delete the task
        await onDeleteTask(taskId);
        
        // Update the project to remove the task
        await onUpdateProject(project.id, {
          tasks: project.tasks.filter(t => t.id !== taskId)
        });
      } catch (error) {
        console.error('Error deleting task:', error);
      }
    }
  };
}; 