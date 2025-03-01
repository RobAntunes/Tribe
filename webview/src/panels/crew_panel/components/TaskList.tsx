import React from 'react';
import './TaskList.css';

interface Task {
    id: string;
    title: string;
    description: string;
    status: 'pending' | 'in-progress' | 'completed' | 'blocked';
    assignedTo: string;
    crew: string;
    priority: 'high' | 'medium' | 'low';
}

interface TaskListProps {
    tasks: Task[];
}

export const TaskList: React.FC<TaskListProps> = ({ tasks }) => {
    // Group tasks by crew
    const tasksByCrew = tasks.reduce((acc, task) => {
        if (!acc[task.crew]) {
            acc[task.crew] = {};
        }
        if (!acc[task.crew][task.assignedTo]) {
            acc[task.crew][task.assignedTo] = [];
        }
        acc[task.crew][task.assignedTo].push(task);
        return acc;
    }, {} as Record<string, Record<string, Task[]>>);

    return (
        <div className="task-list">
            {Object.entries(tasksByCrew).map(([crew, agentTasks]) => (
                <div key={crew} className="crew-section">
                    <h2 className="crew-header">{crew}</h2>
                    {Object.entries(agentTasks).map(([agent, tasks]) => (
                        <div key={agent} className="agent-tasks">
                            <h3 className="agent-header">{agent}</h3>
                            <div className="tasks">
                                {tasks.map(task => (
                                    <div key={task.id} className={`task-card ${task.status}`}>
                                        <div className="task-header">
                                            <h4>{task.title}</h4>
                                            <span className={`priority-badge ${task.priority}`}>
                                                {task.priority}
                                            </span>
                                        </div>
                                        <p className="task-description">{task.description}</p>
                                        <div className="task-footer">
                                            <span className={`status-badge ${task.status}`}>
                                                {task.status}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
};
