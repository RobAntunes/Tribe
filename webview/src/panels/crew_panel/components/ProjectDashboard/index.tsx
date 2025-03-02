import React, { useEffect, useState } from "react";
import { getVsCodeApi } from "../../../../vscode";
import { Agent } from "../../types";
import {
  AlertCircle,
  Calendar,
  CheckSquare,
  Clipboard,
  Clock,
  Filter,
  Plus,
  Search,
  X,
} from "lucide-react";
import "./styles.css";

// Initialize VS Code API
const vscode = getVsCodeApi();

interface Task {
  id: string;
  title: string;
  description: string;
  assignedTo: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  priority: number;
  createdAt: string;
  dueDate?: string;
  dependencies?: string[];
}

interface ProjectDashboardProps {
  agents: Agent[];
  systemEnabled: boolean;
  onToggleSystem: (enabled: boolean) => void;
  projectState?: any;
  learningSystemEnabled?: boolean;
}

export const ProjectDashboard: React.FC<ProjectDashboardProps> = ({
  agents,
  systemEnabled,
  onToggleSystem,
}) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeView, setActiveView] = useState<"list" | "board">("board");
  const [filter, setFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showAddTaskForm, setShowAddTaskForm] = useState<boolean>(false);
  const [newTask, setNewTask] = useState<Partial<Task>>({
    title: "",
    description: "",
    assignedTo: "",
    priority: 1,
    status: "pending",
  });

  // Fetch tasks when component mounts
  useEffect(() => {
    if (systemEnabled) {
      fetchTasks();
    }
  }, [systemEnabled]);

  const fetchTasks = () => {
    setLoading(true);

    // Simulate API call to get tasks
    // In a real implementation, this would be a message to the extension
    setTimeout(() => {
      const dummyTasks: Task[] = [
        {
          id: "1",
          title: "Setup project structure",
          description:
            "Create the initial folder structure and configuration files",
          assignedTo: agents[0]?.id || "",
          status: "completed",
          priority: 1,
          createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
        },
        {
          id: "2",
          title: "Implement authentication",
          description: "Create user authentication system with login/signup",
          assignedTo: agents[1]?.id || "",
          status: "in_progress",
          priority: 2,
          createdAt: new Date(Date.now() - 86400000).toISOString(),
          dependencies: ["1"],
        },
        {
          id: "3",
          title: "Design database schema",
          description: "Create the database schema for the application",
          assignedTo: agents[0]?.id || "",
          status: "pending",
          priority: 1,
          createdAt: new Date().toISOString(),
          dependencies: ["1"],
        },
      ];

      setTasks(dummyTasks);
      setLoading(false);
    }, 1000);
  };

  const handleToggleSystem = () => {
    onToggleSystem(!systemEnabled);

    // Notify the extension
    vscode.postMessage({
      type: "TOGGLE_PROJECT_MANAGEMENT",
      payload: {
        enabled: !systemEnabled,
      },
    });

    if (!systemEnabled) {
      fetchTasks();
    }
  };

  const handleCreateTask = () => {
    if (!newTask.title || !newTask.description) return;

    vscode.postMessage({
      type: "CREATE_TASK",
      payload: {
        title: newTask.title,
        description: newTask.description,
        assignedTo: newTask.assignedTo || agents[0]?.id || "",
        priority: newTask.priority || 1,
        status: newTask.status || "pending",
      },
    });

    // In a real implementation, we would wait for a response
    // For now, simulate adding the task
    const taskId = `new-${Date.now()}`;
    const newTaskObj: Task = {
      id: taskId,
      title: newTask.title,
      description: newTask.description,
      assignedTo: newTask.assignedTo || agents[0]?.id || "",
      priority: newTask.priority || 1,
      status: newTask.status as
        | "pending"
        | "in_progress"
        | "completed"
        | "failed",
      createdAt: new Date().toISOString(),
      dueDate: newTask.dueDate,
      dependencies: newTask.dependencies,
    };

    setTasks([...tasks, newTaskObj]);

    // Reset form
    setNewTask({
      title: "",
      description: "",
      assignedTo: "",
      priority: 1,
      status: "pending",
    });
    setShowAddTaskForm(false);
  };

  const handleUpdateTaskStatus = (
    taskId: string,
    newStatus: "pending" | "in_progress" | "completed" | "failed",
  ) => {
    vscode.postMessage({
      type: "UPDATE_TASK_STATUS",
      payload: {
        taskId,
        status: newStatus,
      },
    });

    // Update local state
    setTasks(
      tasks.map((task) =>
        task.id === taskId ? { ...task, status: newStatus } : task
      ),
    );
  };

  const getAgentName = (agentId: string) => {
    const agent = agents.find((a) => a.id === agentId);
    return agent ? (agent.name || agent.role) : "Unassigned";
  };

  const getAgentDescription = (agentId: string) => {
    const agent = agents.find((a) => a.id === agentId);
    return agent ? (agent.short_description || agent.role) : "";
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "var(--tribe-warning)";
      case "in_progress":
        return "var(--tribe-info)";
      case "completed":
        return "var(--tribe-success)";
      case "failed":
        return "var(--tribe-error)";
      default:
        return "var(--tribe-secondary)";
    }
  };

  const filteredTasks = tasks.filter((task) => {
    const matchesStatus = filter === "all" || task.status === filter;
    const matchesSearch = searchQuery === "" ||
      task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="project-dashboard">
      <div className="project-dashboard-header">
        <div className="project-title">
          <Clipboard size={20} />
          <h3>Project Management</h3>
        </div>

        <div className="project-system-toggle">
          <span>System Status:</span>
          <div
            className={`toggle-switch ${systemEnabled ? "active" : ""}`}
            onClick={handleToggleSystem}
          >
            <div className="toggle-slider"></div>
          </div>
        </div>
      </div>

      {systemEnabled
        ? (
          <div className="project-dashboard-content">
            <div className="project-toolbar">
              <div className="project-toolbar-left">
                <div className="filter-dropdown-container">
                  <div className="filter-dropdown">
                    <Filter size={14} />
                    <select
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                    >
                      <option value="all">All Tasks</option>
                      <option value="pending">Pending</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                      <option value="failed">Failed</option>
                    </select>
                  </div>
                </div>
                <div className="view-toggle">
                  <button
                    className={`view-button ${
                      activeView === "list" ? "active" : ""
                    }`}
                    onClick={() => setActiveView("list")}
                  >
                    List
                  </button>
                  <button
                    className={`view-button ${
                      activeView === "board" ? "active" : ""
                    }`}
                    onClick={() => setActiveView("board")}
                  >
                    Board
                  </button>
                </div>
              </div>

              <div className="search-filter-container">
                <div className="search-input">
                  <Search size={14} />
                  <input
                    type="text"
                    placeholder="Search tasks..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  {searchQuery && (
                    <button
                      className="clear-search"
                      onClick={() => setSearchQuery("")}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>

              <button
                className="create-task-button"
                onClick={() => setShowAddTaskForm(true)}
              >
                <Plus size={14} />
                New Task
              </button>
            </div>

            {loading
              ? <div className="loading-indicator">Loading tasks...</div>
              : (
                <>
                  {showAddTaskForm && (
                    <div className="add-task-form">
                      <h4>Create New Task</h4>
                      <div className="form-group">
                        <label>Title</label>
                        <input
                          type="text"
                          value={newTask.title}
                          onChange={(e) =>
                            setNewTask({ ...newTask, title: e.target.value })}
                          placeholder="Task title"
                        />
                      </div>
                      <div className="form-group">
                        <label>Description</label>
                        <textarea
                          value={newTask.description}
                          onChange={(e) =>
                            setNewTask({
                              ...newTask,
                              description: e.target.value,
                            })}
                          placeholder="Task description"
                        />
                      </div>
                      <div className="form-group">
                        <label>Assigned To</label>
                        <select
                          value={newTask.assignedTo}
                          onChange={(e) =>
                            setNewTask({
                              ...newTask,
                              assignedTo: e.target.value,
                            })}
                        >
                          <option value="">Select Agent</option>
                          {agents.map((agent) => (
                            <option key={agent.id} value={agent.id}>
                              {agent.name || agent.role} -{" "}
                              {agent.short_description || agent.role}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Priority</label>
                        <select
                          value={newTask.priority}
                          onChange={(e) =>
                            setNewTask({
                              ...newTask,
                              priority: parseInt(e.target.value),
                            })}
                        >
                          <option value="1">P1 - High</option>
                          <option value="2">P2 - Medium</option>
                          <option value="3">P3 - Low</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Due Date</label>
                        <div className="date-input">
                          <Calendar size={14} />
                          <input
                            type="date"
                            value={newTask.dueDate
                              ? new Date(newTask.dueDate).toISOString().split(
                                "T",
                              )[0]
                              : ""}
                            onChange={(e) =>
                              setNewTask({
                                ...newTask,
                                dueDate: e.target.value
                                  ? new Date(e.target.value).toISOString()
                                  : undefined,
                              })}
                          />
                        </div>
                      </div>
                      <div className="form-actions">
                        <button
                          className="cancel-button"
                          onClick={() => setShowAddTaskForm(false)}
                        >
                          Cancel
                        </button>
                        <button
                          className="save-button"
                          onClick={handleCreateTask}
                          disabled={!newTask.title || !newTask.description}
                        >
                          Create Task
                        </button>
                      </div>
                    </div>
                  )}

                  {selectedTask && (
                    <div className="task-details-modal">
                      <div className="task-details-content">
                        <div className="task-details-header">
                          <h4>{selectedTask.title}</h4>
                          <button
                            className="close-details-button"
                            onClick={() => setSelectedTask(null)}
                          >
                            <X size={18} />
                          </button>
                        </div>
                        <div className="task-details-body">
                          <div className="task-detail">
                            <span className="detail-label">Status:</span>
                            <span
                              className="task-status"
                              style={{
                                backgroundColor: getStatusColor(
                                  selectedTask.status,
                                ),
                              }}
                            >
                              {selectedTask.status.replace("_", " ")}
                            </span>
                          </div>
                          <div className="task-detail">
                            <span className="detail-label">Assigned To:</span>
                            <span>{getAgentName(selectedTask.assignedTo)}</span>
                          </div>
                          <div className="task-detail">
                            <span className="detail-label">Priority:</span>
                            <span>P{selectedTask.priority}</span>
                          </div>
                          <div className="task-detail">
                            <span className="detail-label">Created:</span>
                            <span>
                              {new Date(selectedTask.createdAt)
                                .toLocaleDateString()}
                            </span>
                          </div>
                          {selectedTask.dueDate && (
                            <div className="task-detail">
                              <span className="detail-label">Due Date:</span>
                              <span>
                                {new Date(selectedTask.dueDate)
                                  .toLocaleDateString()}
                              </span>
                            </div>
                          )}
                          <div className="task-description">
                            <h5>Description:</h5>
                            <p>{selectedTask.description}</p>
                          </div>
                          {selectedTask.dependencies &&
                            selectedTask.dependencies.length > 0 && (
                            <div className="task-dependencies">
                              <h5>Dependencies:</h5>
                              <ul>
                                {selectedTask.dependencies.map((depId) => {
                                  const depTask = tasks.find((t) =>
                                    t.id === depId
                                  );
                                  return (
                                    <li key={depId}>
                                      {depTask
                                        ? depTask.title
                                        : `Task #${depId}`}
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                          )}
                        </div>
                        <div className="task-details-actions">
                          <div className="status-actions">
                            <button
                              className={`status-button pending ${
                                selectedTask.status === "pending"
                                  ? "active"
                                  : ""
                              }`}
                              onClick={() =>
                                handleUpdateTaskStatus(
                                  selectedTask.id,
                                  "pending",
                                )}
                              disabled={selectedTask.status === "pending"}
                            >
                              Pending
                            </button>
                            <button
                              className={`status-button in-progress ${
                                selectedTask.status === "in_progress"
                                  ? "active"
                                  : ""
                              }`}
                              onClick={() =>
                                handleUpdateTaskStatus(
                                  selectedTask.id,
                                  "in_progress",
                                )}
                              disabled={selectedTask.status === "in_progress"}
                            >
                              In Progress
                            </button>
                            <button
                              className={`status-button completed ${
                                selectedTask.status === "completed"
                                  ? "active"
                                  : ""
                              }`}
                              onClick={() =>
                                handleUpdateTaskStatus(
                                  selectedTask.id,
                                  "completed",
                                )}
                              disabled={selectedTask.status === "completed"}
                            >
                              Completed
                            </button>
                            <button
                              className={`status-button failed ${
                                selectedTask.status === "failed" ? "active" : ""
                              }`}
                              onClick={() =>
                                handleUpdateTaskStatus(
                                  selectedTask.id,
                                  "failed",
                                )}
                              disabled={selectedTask.status === "failed"}
                            >
                              Failed
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeView === "list"
                    ? (
                      <div className="task-list-view">
                        <table className="task-table">
                          <thead>
                            <tr>
                              <th>Title</th>
                              <th>Assigned To</th>
                              <th>Status</th>
                              <th>Priority</th>
                              <th>Created</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredTasks.map((task) => (
                              <tr
                                key={task.id}
                                className="task-row"
                                onClick={() => setSelectedTask(task)}
                              >
                                <td className="task-title">{task.title}</td>
                                <td>{getAgentName(task.assignedTo)}</td>
                                <td>
                                  <span
                                    className="task-status"
                                    style={{
                                      backgroundColor: getStatusColor(
                                        task.status,
                                      ),
                                    }}
                                  >
                                    {task.status.replace("_", " ")}
                                  </span>
                                </td>
                                <td>P{task.priority}</td>
                                <td>
                                  {new Date(task.createdAt)
                                    .toLocaleDateString()}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )
                    : (
                      <div className="task-board-view">
                        <div className="task-columns">
                          <div className="task-column pending-column">
                            <div className="column-header">
                              <h4>Pending</h4>
                              <span className="task-count">
                                {tasks.filter((t) => t.status === "pending")
                                  .length}
                              </span>
                            </div>
                            <div className="column-tasks">
                              {filteredTasks
                                .filter((t) => t.status === "pending")
                                .map((task) => (
                                  <div
                                    key={task.id}
                                    className="task-card"
                                    onClick={() => setSelectedTask(task)}
                                  >
                                    <div className="task-card-header">
                                      <span className="task-priority">
                                        P{task.priority}
                                      </span>
                                      <span className="task-id">
                                        #{task.id}
                                      </span>
                                    </div>
                                    <h4 className="task-card-title">
                                      {task.title}
                                    </h4>
                                    <p className="task-card-description">
                                      {task.description}
                                    </p>
                                    <div className="task-card-footer">
                                      <div
                                        className="task-assignee"
                                        title={getAgentDescription(
                                          task.assignedTo,
                                        )}
                                      >
                                        <div className="assignee-avatar">
                                          {getAgentName(task.assignedTo)
                                            ?.substring(0, 2) || "NA"}
                                        </div>
                                        <span>
                                          {getAgentName(task.assignedTo)}
                                        </span>
                                      </div>
                                      <div className="task-date">
                                        <Clock size={12} />
                                        <span>
                                          {new Date(task.createdAt)
                                            .toLocaleDateString()}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                            </div>
                          </div>

                          <div className="task-column progress-column">
                            <div className="column-header">
                              <h4>In Progress</h4>
                              <span className="task-count">
                                {tasks.filter((t) => t.status === "in_progress")
                                  .length}
                              </span>
                            </div>
                            <div className="column-tasks">
                              {filteredTasks
                                .filter((t) => t.status === "in_progress")
                                .map((task) => (
                                  <div
                                    key={task.id}
                                    className="task-card"
                                    onClick={() => setSelectedTask(task)}
                                  >
                                    <div className="task-card-header">
                                      <span className="task-priority">
                                        P{task.priority}
                                      </span>
                                      <span className="task-id">
                                        #{task.id}
                                      </span>
                                    </div>
                                    <h4 className="task-card-title">
                                      {task.title}
                                    </h4>
                                    <p className="task-card-description">
                                      {task.description}
                                    </p>
                                    <div className="task-card-footer">
                                      <div
                                        className="task-assignee"
                                        title={getAgentDescription(
                                          task.assignedTo,
                                        )}
                                      >
                                        <div className="assignee-avatar">
                                          {getAgentName(task.assignedTo)
                                            ?.substring(0, 2) || "NA"}
                                        </div>
                                        <span>
                                          {getAgentName(task.assignedTo)}
                                        </span>
                                      </div>
                                      <div className="task-date">
                                        <Clock size={12} />
                                        <span>
                                          {new Date(task.createdAt)
                                            .toLocaleDateString()}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                            </div>
                          </div>

                          <div className="task-column completed-column">
                            <div className="column-header">
                              <h4>Completed</h4>
                              <span className="task-count">
                                {tasks.filter((t) => t.status === "completed")
                                  .length}
                              </span>
                            </div>
                            <div className="column-tasks">
                              {filteredTasks
                                .filter((t) => t.status === "completed")
                                .map((task) => (
                                  <div
                                    key={task.id}
                                    className="task-card"
                                    onClick={() => setSelectedTask(task)}
                                  >
                                    <div className="task-card-header">
                                      <span className="task-priority">
                                        P{task.priority}
                                      </span>
                                      <span className="task-id">
                                        #{task.id}
                                      </span>
                                    </div>
                                    <h4 className="task-card-title">
                                      {task.title}
                                    </h4>
                                    <p className="task-card-description">
                                      {task.description}
                                    </p>
                                    <div className="task-card-footer">
                                      <div
                                        className="task-assignee"
                                        title={getAgentDescription(
                                          task.assignedTo,
                                        )}
                                      >
                                        <div className="assignee-avatar">
                                          {getAgentName(task.assignedTo)
                                            ?.substring(0, 2) || "NA"}
                                        </div>
                                        <span>
                                          {getAgentName(task.assignedTo)}
                                        </span>
                                      </div>
                                      <div className="task-date">
                                        <Clock size={12} />
                                        <span>
                                          {new Date(task.createdAt)
                                            .toLocaleDateString()}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                            </div>
                          </div>

                          <div className="task-column failed-column">
                            <div className="column-header">
                              <h4>Failed</h4>
                              <span className="task-count">
                                {tasks.filter((t) => t.status === "failed")
                                  .length}
                              </span>
                            </div>
                            <div className="column-tasks">
                              {filteredTasks
                                .filter((t) => t.status === "failed")
                                .map((task) => (
                                  <div
                                    key={task.id}
                                    className="task-card"
                                    onClick={() => setSelectedTask(task)}
                                  >
                                    <div className="task-card-header">
                                      <span className="task-priority">
                                        P{task.priority}
                                      </span>
                                      <span className="task-id">
                                        #{task.id}
                                      </span>
                                    </div>
                                    <h4 className="task-card-title">
                                      {task.title}
                                    </h4>
                                    <p className="task-card-description">
                                      {task.description}
                                    </p>
                                    <div className="task-card-footer">
                                      <div
                                        className="task-assignee"
                                        title={getAgentDescription(
                                          task.assignedTo,
                                        )}
                                      >
                                        <div className="assignee-avatar">
                                          {getAgentName(task.assignedTo)
                                            ?.substring(0, 2) || "NA"}
                                        </div>
                                        <span>
                                          {getAgentName(task.assignedTo)}
                                        </span>
                                      </div>
                                      <div className="task-date">
                                        <Clock size={12} />
                                        <span>
                                          {new Date(task.createdAt)
                                            .toLocaleDateString()}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                </>
              )}
          </div>
        )
        : (
          <div className="project-system-disabled">
            <Clipboard size={48} />
            <h4>Project Management System is Disabled</h4>
            <p>
              Enable the project management system to track tasks, assign work
              to agents, and monitor progress.
            </p>
            <button
              className="enable-project-button"
              onClick={handleToggleSystem}
            >
              Enable Project Management
            </button>
          </div>
        )}
    </div>
  );
};