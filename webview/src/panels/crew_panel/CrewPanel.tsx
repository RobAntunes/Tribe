/** @jsx React.createElement */
/** @jsxRuntime classic */

import React, { MouseEventHandler, ReactNode, useState, useEffect, useRef, Suspense } from "react";
import { TabContent } from './components/TabContent';
import { getVsCodeApi } from '../../vscode';
import {
	Brain,
	MessageSquare,
	Users,
	Send,
	ChevronRight,
	ChevronDown,
	Activity,
	ChevronsUp,
	ChevronsDown,
	Rocket,
	Code,
	GitMerge,
	Clipboard,
	Wrench,
	Layers,
	Bolt,
	IterationCcw,
	Flag
} from "lucide-react";
import { GetStarted } from './components/GetStarted';
import './styles.css';
import { ActionPanel } from './components/ActionPanel';
import { AgentCard } from './components/AgentCard';
import { ChatWindow } from './components/ChatWindow';
import { DecisionPanel } from './components/DecisionPanel/index';
import { TaskList } from './components/TaskList';
import { Message, Agent, ProjectState } from './types';
import { DiffNavigationPortal } from './components/DiffNavigationPortal/index';
import { ChangeCheckpoints } from './components/ChangeCheckpoints/index';
import { TribeDashboard } from './components/TribeDashboard';
import { ProjectDashboard } from './components/ProjectDashboard/index';
import { ToolsPanel } from './components/ToolsPanel/index';
import { LearningDashboard } from './components/LearningDashboard/index';
import { ConsolidatedDashboard } from './components/ConsolidatedDashboard/index';
import { ProjectManagementSystem } from './components/ProjectManagementSystem';
import { ReflectionSystem } from './components/ReflectionSystem';
import { LearningSystem } from './components/LearningSystem';
import { FeedbackSystem } from './components/FeedbackSystem';
import { AgentAutonomyPanel } from './components/AgentAutonomyPanel';
import { QuickActionsPanel } from './components/QuickActionsPanel/index';

// Define interfaces for Project Management System
interface PMSTask {
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

interface PMSProject {
	id: string;
	name: string;
	description: string;
	startDate: string;
	endDate?: string;
	status: 'planning' | 'active' | 'on_hold' | 'completed';
	tasks: PMSTask[];
	members: string[];
	metadata: Record<string, any>;
}

interface PMSTaskFilter {
	status?: string[];
	priority?: string[];
	assignee?: string[];
	tags?: string[];
	dueDate?: {
		from?: string;
		to?: string;
	};
}

type AgentRole = 'pm' | 'dev' | 'specialist' | 'architect' | 'designer' | 'tester' | 'researcher' | 'custom';

interface AgentSpec {
	id?: string;
	name: string;
	role: AgentRole | string;
	skills: string[];
	description: string;
	responsibilities: string[];
	tools?: string[];
	autonomyLevel?: number;
	customAttributes?: Record<string, any>;
}

// Interfaces for Reflection System
interface Reflection {
	id: string;
	type: 'process' | 'outcome' | 'decision' | 'generic';
	context: {
		task?: string;
		project?: string;
		agents: string[];
		timestamp: string;
	};
	content: {
		summary: string;
		strengths: string[];
		weaknesses: string[];
		insights: string[];
		nextSteps?: string[];
	};
	metadata: Record<string, any>;
}

interface InsightGroup {
	topic: string;
	insights: string[];
	frequency: number;
	impact: 'high' | 'medium' | 'low';
}

interface ImprovementPlan {
	id: string;
	target: {
		agent?: string;
		team?: string;
		process?: string;
	};
	insights: string[];
	actions: {
		description: string;
		priority: 'high' | 'medium' | 'low';
		status: 'pending' | 'in_progress' | 'completed';
	}[];
	metrics: {
		name: string;
		baseline: number;
		target: number;
	}[];
	createdAt: string;
	completedAt?: string;
}

interface CodeAction {
	name: string;
	description: string;
	handler: () => void;
}

interface FolderStructure {
	name: string;
	children: (FolderStructure | string)[];
}

interface ProjectChange {
	id: string;
	type: 'feature' | 'bugfix' | 'improvement' | 'refactor' | 'documentation';
	title: string;
	description: string;
	files: {
		path: string;
		changeType: 'add' | 'modify' | 'delete';
		diff?: string;
	}[];
	author: string;
	timestamp: string;
	status: 'proposed' | 'pending' | 'approved' | 'rejected' | 'implemented';
}

interface Checkpoint {
	id: string;
	title: string;
	description: string;
	timestamp: string;
	changes: string[];
	metadata: {
		commitHash?: string;
		branch?: string;
		tags?: string[];
	};
}

interface WorkflowTemplate {
	id: string;
	name: string;
	description: string;
	steps: {
		id: string;
		name: string;
		description: string;
		assignedRole: string;
		estimatedDuration: number;
		dependencies: string[];
	}[];
	metadata: Record<string, any>;
}

interface Notification {
	id: string;
	type: 'info' | 'warning' | 'error' | 'success';
	title: string;
	message: string;
	timestamp: string;
	read: boolean;
	source: 'system' | 'agent' | 'user';
	context?: {
		entityType?: string;
		entityId?: string;
	};
}

interface WorkspaceStats {
	files: number;
	directories: number;
	languages: Record<string, number>;
	totalLines: number;
	lastModified: string;
}

// Define our tab types
type TabType = 'get-started' | 'main-dashboard' | 'development-hub' | 'collaboration-center' | 'learning-improvement';

interface Dependency {
	name: string;
	version: string;
	type: 'runtime' | 'development' | 'peer' | 'optional';
	custom?: boolean;
}

interface ProjectDependencies {
	direct: Dependency[];
	indirect: Dependency[];
	vulnerable: Dependency[];
}

interface ToolDefinition {
	name: string;
	description: string;
	usage: string;
	examples: string[];
	parameters: {
		name: string;
		type: string;
		description: string;
		required: boolean;
		default?: any;
	}[];
	returns: {
		type: string;
		description: string;
	};
	category: 'file' | 'code' | 'data' | 'communication' | 'system' | 'custom';
	enabled: boolean;
}

interface AgentDeploymentConfig {
	id: string;
	name: string;
	environment: 'development' | 'staging' | 'production' | 'custom';
	resources: {
		cpu: number;
		memory: number;
		storage: number;
	};
	scaling: {
		minInstances: number;
		maxInstances: number;
		targetCpuUtilization: number;
	};
	security: {
		permissions: string[];
		networkAccess: boolean;
		isolationLevel: 'none' | 'container' | 'vm';
	};
	logging: {
		level: 'debug' | 'info' | 'warn' | 'error';
		retention: number;
	};
}

interface CollaborationSession {
	id: string;
	title: string;
	description: string;
	participants: {
		id: string;
		name: string;
		type: 'human' | 'agent';
		role: string;
	}[];
	status: 'scheduled' | 'active' | 'completed';
	scheduledAt?: string;
	startedAt?: string;
	endedAt?: string;
	artifacts: {
		id: string;
		type: string;
		name: string;
		url?: string;
	}[];
}

interface PendingDecision {
	id: string;
	title: string;
	description: string;
	options: {
		id: string;
		title: string;
		description: string;
		pros: string[];
		cons: string[];
		confidence: number;
	}[];
	context: {
		requestor: string;
		priority: 'low' | 'medium' | 'high' | 'critical';
		dueBy?: string;
		tags: string[];
	};
	status: 'open' | 'in_progress' | 'resolved' | 'cancelled';
	createdAt: string;
	updatedAt: string;
	resolvedAt?: string;
	resolution?: {
		selectedOption: string;
		rationale: string;
		additionalNotes?: string;
	};
}

export interface CrewPanelProps {
	activeFlow?: any;
	suggestedFlows?: any[];
}

// Main component
export const CrewPanel: React.FC<CrewPanelProps> = ({ activeFlow, suggestedFlows }) => {
	// Get vscode API
	const vscode = getVsCodeApi();
	const messageListRef = useRef<HTMLDivElement>(null);
	
	// Set up state
	const [activeTab, setActiveTab] = useState<TabType>('get-started');
	const [currentMessages, setCurrentMessages] = useState<Message[]>([]);
	const [targetAgentId, setTargetAgentId] = useState<string | null>(null);
	const [newMessageContent, setNewMessageContent] = useState('');
	const [sendingMessage, setSendingMessage] = useState(false);
	
	// Combine project state with default values for predictable rendering
	const defaultProjectState: ProjectState = {
		initialized: false,
		vision: '',
		currentPhase: '',
		activeAgents: [],
		agents: [],
		pendingDecisions: [],
		tasks: [],
		notifications: [],
		teams: []
	};
	
	const [projectState, setProjectState] = useState<ProjectState>(defaultProjectState);
	const [isAgentPanelOpen, setIsAgentPanelOpen] = useState(false);
	const [isAgentPanelExpanded, setIsAgentPanelExpanded] = useState(false);
	const [learningSystemEnabled, setLearningSystemEnabled] = useState(true);

	// Tab configuration
	const tabOrder: TabType[] = projectState.initialized
		? ['main-dashboard', 'development-hub', 'collaboration-center', 'learning-improvement']
		: ['get-started'];
		
	// Define state variables for subtabs
	const [developmentSubTab, setDevelopmentSubTab] = useState<'tasks' | 'actions' | 'changes' | 'checkpoints'>('tasks');
	const [collaborationSubTab, setCollaborationSubTab] = useState<'messages' | 'agents' | 'decisions'>('messages');
	const [learningSubTab, setLearningSubTab] = useState<'feedback' | 'learning' | 'reflection'>('feedback');

	// Add debugging logs
	useEffect(() => {
		console.log('Project state initialized:', projectState.initialized);
		console.log('Tab order:', tabOrder);
		console.log('Active tab:', activeTab);
	}, [projectState.initialized, tabOrder, activeTab]);

	const tabConfig: Record<TabType, {
		icon: ReactNode;
		label: string;
		onClick: () => void;
		count?: number;
		disabled?: boolean;
	}> = {
		'get-started': {
			icon: <Rocket size={20} />,
			label: 'Get Started',
			onClick: () => setActiveTab('get-started'),
			disabled: projectState.initialized
		},
		'main-dashboard': {
			icon: <Activity size={20} />,
			label: 'Dashboard',
			onClick: () => setActiveTab('main-dashboard'),
			disabled: !projectState.initialized
		},
		'development-hub': {
			icon: <Code size={20} />,
			label: 'Development',
			onClick: () => setActiveTab('development-hub'),
			count: projectState.tasks.length,
			disabled: !projectState.initialized
		},
		'collaboration-center': {
			icon: <Users size={20} />,
			label: 'Collaboration',
			onClick: () => setActiveTab('collaboration-center'),
			count: projectState.activeAgents.length,
			disabled: !projectState.initialized
		},
		'learning-improvement': {
			icon: <Brain size={20} />,
			label: 'Learning',
			onClick: () => setActiveTab('learning-improvement'),
			disabled: !projectState.initialized
		}
	};

	useEffect(() => {
		// On mount, tell the extension we're ready
		vscode.postMessage({ type: 'WEBVIEW_READY', });
		
		// Set up event listener for messages from extension
		const messageListener = (event: MessageEvent) => {
			const message = event.data;
			handleIncomingMessage(message);
		};
		
		window.addEventListener('message', messageListener);
		
		// Clean up event listener on unmount
		return () => {
			window.removeEventListener('message', messageListener);
		};
	}, []);

	// Effect to scroll to bottom of message list when new messages arrive
	useEffect(() => {
		if (messageListRef.current) {
			messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
		}
	}, [currentMessages]);

	// Effect to update active tab based on project state
	useEffect(() => {
		if (projectState.initialized && activeTab === 'get-started') {
			setActiveTab('main-dashboard');
		}
	}, [projectState.initialized, activeTab]);

	const handleIncomingMessage = (message: any) => {
		console.log('Received message from extension:', message);
		
		switch(message.type) {
			case 'PROJECT_STATE':
				setProjectState(prevState => ({
					...prevState,
					...message.payload
				}));
				break;
			case 'AGENT_MESSAGE':
				handleNewAgentMessage(message.payload);
				break;
			case 'AGENT_MESSAGE_UPDATE':
				handleAgentMessageUpdate(message.payload);
				break;
			case 'AGENT_ERROR':
				handleAgentError(message.payload);
				break;
			case 'PROJECT_INITIALIZED':
				setProjectState(prevState => ({
					...prevState,
					initialized: true,
					vision: message.payload.vision,
					currentPhase: message.payload.currentPhase
				}));
				setActiveTab('main-dashboard');
				break;
			case 'NEW_AGENT_ADDED':
				setProjectState(prevState => ({
					...prevState,
					agents: [...prevState.agents, message.payload.agent],
					activeAgents: message.payload.active 
						? [...prevState.activeAgents, message.payload.agent]
						: prevState.activeAgents
				}));
				break;
			case 'AGENT_ACTIVATED':
				const agentToActivate = projectState.agents.find(a => a.id === message.payload.agentId);
				if (agentToActivate && !projectState.activeAgents.some(a => a.id === agentToActivate.id)) {
					setProjectState(prevState => ({
						...prevState,
						activeAgents: [...prevState.activeAgents, agentToActivate]
					}));
				}
				break;
			case 'AGENT_DEACTIVATED':
				setProjectState(prevState => ({
					...prevState,
					activeAgents: prevState.activeAgents.filter(a => a.id !== message.payload.agentId)
				}));
				break;
			case 'NEW_TASK_ADDED':
				setProjectState(prevState => ({
					...prevState,
					tasks: [...prevState.tasks, message.payload.task]
				}));
				break;
			case 'TASK_UPDATED':
				setProjectState(prevState => ({
					...prevState,
					tasks: prevState.tasks.map(t => 
						t.id === message.payload.task.id ? message.payload.task : t
					)
				}));
				break;
			case 'TASK_REMOVED':
				setProjectState(prevState => ({
					...prevState,
					tasks: prevState.tasks.filter(t => t.id !== message.payload.taskId)
				}));
				break;
			case 'NEW_DECISION_ADDED':
				setProjectState(prevState => ({
					...prevState,
					pendingDecisions: [...prevState.pendingDecisions, message.payload.decision]
				}));
				break;
			case 'DECISION_UPDATED':
				setProjectState(prevState => ({
					...prevState,
					pendingDecisions: prevState.pendingDecisions.map(d => 
						d.id === message.payload.decision.id ? message.payload.decision : d
					)
				}));
				break;
			case 'DECISION_REMOVED':
				setProjectState(prevState => ({
					...prevState,
					pendingDecisions: prevState.pendingDecisions.filter(d => d.id !== message.payload.decisionId)
				}));
				break;
			case 'NEW_NOTIFICATION':
				setProjectState(prevState => ({
					...prevState,
					notifications: [...prevState.notifications, message.payload.notification]
				}));
				break;
			case 'NOTIFICATION_READ':
				setProjectState(prevState => ({
					...prevState,
					notifications: prevState.notifications.map(n => 
						n.id === message.payload.notificationId ? {...n, read: true} : n
					)
				}));
				break;
			case 'CLEAR_NOTIFICATIONS':
				setProjectState(prevState => ({
					...prevState,
					notifications: prevState.notifications.filter(n => !n.read)
				}));
				break;
			case 'AGENT_STATUS_UPDATED':
				setProjectState(prevState => ({
					...prevState,
					agents: prevState.agents.map(a => 
						a.id === message.payload.agentId 
							? {...a, status: message.payload.status} 
							: a
					),
					activeAgents: prevState.activeAgents.map(a => 
						a.id === message.payload.agentId 
							? {...a, status: message.payload.status} 
							: a
					)
				}));
				break;
			case 'PROJECT_PHASE_UPDATED':
				setProjectState(prevState => ({
					...prevState,
					currentPhase: message.payload.phase
				}));
				break;
			case 'AGENT_AUTONOMY_UPDATED':
				setProjectState(prevState => ({
					...prevState,
					agents: prevState.agents.map(a => 
						a.id === message.payload.agentId 
							? {...a, autonomyState: message.payload.autonomyState} 
							: a
					),
					activeAgents: prevState.activeAgents.map(a => 
						a.id === message.payload.agentId 
							? {...a, autonomyState: message.payload.autonomyState} 
							: a
					)
				}));
				break;
			case 'LEARNING_SYSTEM_TOGGLED':
				setLearningSystemEnabled(message.payload.enabled);
				break;
			default:
				console.log('Unknown message type:', message.type);
		}
	};

	// Helper function to determine which tab had an error
	const getTabTypeFromError = (error: string): TabType | null => {
		const errorText = error.toLowerCase();
		
		// Map errors to main tabs
		if (errorText.includes('get started') || errorText.includes('team') || errorText.includes('initialize')) {
			return 'get-started';
		}
		
		if (errorText.includes('dashboard') || errorText.includes('overview') || errorText.includes('project')) {
			return 'main-dashboard';
		}
		
		if (errorText.includes('task') || errorText.includes('action') || errorText.includes('change') || 
			errorText.includes('code') || errorText.includes('development')) {
			return 'development-hub';
		}
		
		if (errorText.includes('agent') || errorText.includes('team') || errorText.includes('message') || 
			errorText.includes('collaboration') || errorText.includes('decision')) {
			return 'collaboration-center';
		}
		
		if (errorText.includes('learning') || errorText.includes('improve') || 
			errorText.includes('feedback') || errorText.includes('reflection')) {
			return 'learning-improvement';
		}
		
		return null;
	};

	const handleAgentError = (payload: any) => {
		// Create an error message
		const errorMessage: Message = {
			id: `error-${Date.now()}`,
			sender: payload.agentId || 'system',
			content: `Error: ${payload.error}`,
			timestamp: new Date().toISOString(),
			type: 'system',
			isError: true
		};
		
		setCurrentMessages(prevMessages => [...prevMessages, errorMessage]);
		
		// Navigate to the right tab if we can determine it
		const relevantTab = getTabTypeFromError(payload.error);
		if (relevantTab) {
			setActiveTab(relevantTab);
		}
	};

	const handleNewAgentMessage = (payload: any) => {
		// Determine if this is a loading message
		const isLoading = payload.status === 'loading';
		
		// Create the message object
		const message: Message = {
			id: payload.id || `msg-${Date.now()}`,
			sender: payload.sender,
			content: payload.content || '',
			timestamp: payload.timestamp || new Date().toISOString(),
			type: payload.type || 'agent',
			targetAgent: payload.targetAgent,
			teamId: payload.teamId,
			isManagerResponse: payload.isManagerResponse,
			isVPResponse: payload.isVPResponse,
			isTeamMessage: payload.isTeamMessage,
			status: payload.status,
			isLoading,
			originalResponses: payload.originalResponses
		};
		
		// If we have a loading message with the same ID, replace it
		if (payload.id) {
			setCurrentMessages(prevMessages => {
				const existingMessageIndex = prevMessages.findIndex(m => m.id === payload.id);
				if (existingMessageIndex >= 0) {
					const updatedMessages = [...prevMessages];
					updatedMessages[existingMessageIndex] = message;
					return updatedMessages;
				}
				return [...prevMessages, message];
			});
		} else {
			// Otherwise just add the new message
			setCurrentMessages(prevMessages => [...prevMessages, message]);
		}
	};

	const handleAgentMessageUpdate = (payload: any) => {
		// Update an existing message
		setCurrentMessages(prevMessages => {
			return prevMessages.map(message => {
				if (message.id === payload.id) {
					return {
						...message,
						content: payload.content || message.content,
						status: payload.status || message.status,
						isLoading: payload.status === 'loading',
						isError: payload.status === 'error',
					};
				}
				return message;
			});
		});
	};

	const sendMessage = () => {
		if (!newMessageContent.trim()) return;
		
		// Create user message
		const userMessage: Message = {
			id: `user-${Date.now()}`,
			sender: 'user',
			content: newMessageContent,
			timestamp: new Date().toISOString(),
			type: 'user',
			targetAgent: targetAgentId || undefined
		};
		
		// Add to messages state
		setCurrentMessages(prevMessages => [...prevMessages, userMessage]);
		
		// Create loading message for agent response
		const loadingMessage: Message = {
			id: `agent-${Date.now()}`,
			sender: targetAgentId || 'agent',
			content: '',
			timestamp: new Date().toISOString(),
			type: 'agent',
			targetAgent: targetAgentId || undefined,
			isLoading: true,
			status: 'loading'
		};
		
		// Add loading message
		setCurrentMessages(prevMessages => [...prevMessages, loadingMessage]);
		
		// Send message to extension
		vscode.postMessage({
			type: 'SEND_MESSAGE',
			payload: {
				content: newMessageContent,
				targetAgent: targetAgentId,
				loadingMessageId: loadingMessage.id
			}
		});
		
		// Clear input
		setNewMessageContent('');
		setSendingMessage(false);
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			sendMessage();
		}
	};

	const handleAgentSelect = (agent: Agent) => {
		setTargetAgentId(agent.id);
		setIsAgentPanelOpen(false);
	};

	const handleInitializeProject = (projectData: any) => {
		vscode.postMessage({
			type: 'INITIALIZE_PROJECT',
			payload: projectData
		});
	};

	const handleToggleAgentPanel = () => {
		setIsAgentPanelOpen(!isAgentPanelOpen);
	};

	const handleExpandAgentPanel = () => {
		setIsAgentPanelExpanded(!isAgentPanelExpanded);
	};

	const handleCreateTeam = (teamData: any) => {
		vscode.postMessage({
			type: 'CREATE_TEAM',
			payload: teamData
		});
	};

	const handleAddAgent = (agentData: any) => {
		vscode.postMessage({
			type: 'ADD_AGENT',
			payload: agentData
		});
	};

	const handleActivateAgent = (agentId: string) => {
		vscode.postMessage({
			type: 'ACTIVATE_AGENT',
			payload: { agentId }
		});
	};

	const handleDeactivateAgent = (agentId: string) => {
		vscode.postMessage({
			type: 'DEACTIVATE_AGENT',
			payload: { agentId }
		});
	};

	const handleSubmitTask = (taskData: any) => {
		vscode.postMessage({
			type: 'ADD_TASK',
			payload: { task: taskData }
		});
	};

	const handleUpdateTask = (taskId: string, updates: any) => {
		vscode.postMessage({
			type: 'UPDATE_TASK',
			payload: { taskId, updates }
		});
	};

	const handleSubmitDecision = (decisionData: any) => {
		vscode.postMessage({
			type: 'ADD_DECISION',
			payload: { decision: decisionData }
		});
	};

	const handleResolveDecision = (decisionId: string, resolution: any) => {
		vscode.postMessage({
			type: 'RESOLVE_DECISION',
			payload: { decisionId, resolution }
		});
	};

	const handleAcceptChange = (changeId: string) => {
		vscode.postMessage({
			type: 'ACCEPT_CHANGE',
			payload: { changeId }
		});
	};

	const handleRejectChange = (changeId: string) => {
		vscode.postMessage({
			type: 'REJECT_CHANGE',
			payload: { changeId }
		});
	};

	const handleCreateCheckpoint = (checkpointData: any) => {
		vscode.postMessage({
			type: 'CREATE_CHECKPOINT',
			payload: checkpointData
		});
	};

	const handleRestoreCheckpoint = (checkpointId: string) => {
		vscode.postMessage({
			type: 'RESTORE_CHECKPOINT',
			payload: { checkpointId }
		});
	};

	const handleSelectWorkflowTemplate = (templateId: string) => {
		vscode.postMessage({
			type: 'SELECT_WORKFLOW_TEMPLATE',
			payload: { templateId }
		});
	};

	const handleExecuteWorkflow = (workflowData: any) => {
		vscode.postMessage({
			type: 'EXECUTE_WORKFLOW',
			payload: workflowData
		});
	};

	const handleModifyAgentAutonomy = (agentId: string, autonomyData: any) => {
		vscode.postMessage({
			type: 'MODIFY_AGENT_AUTONOMY',
			payload: { agentId, ...autonomyData }
		});
	};

	const handleToggleLearningSystem = (enabled: boolean) => {
		setLearningSystemEnabled(enabled);
		// Notify the extension
		vscode.postMessage({
			type: 'TOGGLE_LEARNING_SYSTEM',
			payload: {
				enabled
			}
		});
	};

	const renderHeader = () => (
		<div className="sticky top-0 z-10 backdrop-blur-lg backdrop-filter border-b border-gray-700/30 p-2">
			<div className="flex items-center justify-between">
				<div className="flex items-center space-x-3">
					<div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
						<svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
						</svg>
					</div>
					<h1 className="text-base font-semibold text-white">Tribe</h1>
				</div>
				<button 
					className="p-1 rounded-md hover:bg-gray-700/30 transition-colors" 
					onClick={() => {
						// Skip confirmation
						{
							vscode.postMessage({
								type: 'RESET_TRIBE',
								payload: {}
							});
						}
					}}
					title="Reset Tribe"
				>
					<svg className="w-5 h-5 text-gray-300 hover:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
					</svg>
				</button>
			</div>
			<div className="tab-container">
				{tabOrder.map((tab) => (
					<button
						key={tab}
						className={`tab-button ${activeTab === tab ? 'active' : ''} ${tabConfig[tab].disabled ? 'disabled' : ''}`}
						onClick={tabConfig[tab].onClick}
						disabled={tabConfig[tab].disabled}
					>
						{tabConfig[tab].icon}
						<span>{tabConfig[tab].label}</span>
						{tabConfig[tab].count !== undefined && tabConfig[tab].count > 0 && (
							<span className="tab-badge">{tabConfig[tab].count}</span>
						)}
					</button>
				))}
			</div>
		</div>
	);

	const renderSubTabs = (
		tabType: 'development' | 'collaboration' | 'learning',
		activeSubTab: string,
		setActiveSubTab: React.Dispatch<React.SetStateAction<any>>,
		subTabs: { value: string; label: string; icon: ReactNode }[]
	) => (
		<div className="subtab-container">
			{subTabs.map((subTab) => (
				<button
					key={subTab.value}
					className={`subtab-button ${activeSubTab === subTab.value ? 'active' : ''}`}
					onClick={() => setActiveSubTab(subTab.value as any)}
				>
					{subTab.icon}
					<span>{subTab.label}</span>
				</button>
			))}
		</div>
	);

	const renderTabContent = () => {
		// Get Started tab
		if (activeTab === 'get-started') {
			return (
				<GetStarted
					onInitialize={handleInitializeProject}
					onCreateTeam={handleCreateTeam}
					onAddAgent={handleAddAgent}
				/>
			);
		}

		// Require initialization for all other tabs
		if (!projectState.initialized) {
			return (
				<div className="not-initialized">
					<h2>Not Initialized</h2>
					<p>Please initialize the project in the Get Started tab.</p>
				</div>
			);
		}

		// Main Dashboard
		if (activeTab === 'main-dashboard') {
			return (
				<div className="dashboard-container">
					<div className="top-section">
						<ConsolidatedDashboard 
							agents={projectState.activeAgents}
							selectedAgent={null}
							projectSystemEnabled={true}
							toolsSystemEnabled={true}
							learningSystemEnabled={learningSystemEnabled}
							onToggleProjectSystem={() => {}}
							onToggleToolsSystem={() => {}}
							onToggleLearningSystem={handleToggleLearningSystem}
							tasks={projectState.tasks}
							pendingDecisions={projectState.pendingDecisions}
							notifications={projectState.notifications}
							currentPhase={projectState.currentPhase}
							vision={projectState.vision}
						/>
						<div className="overview-content">
							<div className="card">
								<h2>Project Vision</h2>
								<p>{projectState.vision || 'No vision set'}</p>
								<h3>Current Phase</h3>
								<div className="badge">
									{projectState.currentPhase || 'Not started'}
								</div>
							</div>
							<div className="overview-section">
								<h3>Active Agents</h3>
								<div className="overview-agents">
									{projectState.activeAgents.map((agent) => (
										<div key={agent.id} className="overview-agent-compact">
											<div className="overview-agent-avatar">
												{agent.name?.substring(0, 2) || agent.role.substring(0, 2)}
											</div>
											<div className="overview-agent-info">
												<div className="overview-agent-name">{agent.name || agent.role}</div>
												<div className="overview-agent-role">{agent.role}</div>
											</div>
										</div>
									))}
								</div>
							</div>
						</div>
					</div>
					<div className="bottom-section">
						<ProjectDashboard 
							projectState={projectState}
							learningSystemEnabled={learningSystemEnabled}
							agents={projectState.activeAgents}
							systemEnabled={true}
							onToggleSystem={() => {}}
						/>
					</div>
				</div>
			);
		}

		// Development Hub
		if (activeTab === 'development-hub') {
			const developmentSubTabs = [
				{ value: 'tasks', label: 'Tasks', icon: <Clipboard size={16} /> },
				{ value: 'actions', label: 'Actions', icon: <Wrench size={16} /> },
				{ value: 'changes', label: 'Changes', icon: <GitMerge size={16} /> },
				{ value: 'checkpoints', label: 'Checkpoints', icon: <Flag size={16} /> }
			];

			return (
				<div className="development-container">
					{renderSubTabs('development', developmentSubTab, setDevelopmentSubTab, developmentSubTabs)}
					
					<div className="development-content">
						{developmentSubTab === 'tasks' && (
							<TaskList tasks={projectState.tasks.map(task => ({
								id: task.id,
								title: task.title,
								description: task.description,
								status: task.status as any,
								assignedTo: task.assignee || 'Unassigned',
								crew: 'Development Team', // This would come from proper team data
								priority: task.priority as any
							}))} />
						)}
						
						{developmentSubTab === 'actions' && (
							<ActionPanel 
								projectState={projectState}
								onExecuteAction={(action) => {
									vscode.postMessage({
										type: 'EXECUTE_ACTION',
										payload: { action }
									});
								}}
								onCreateAgent={(description) => {}}
								onCreateTask={(description) => {}}
								onCreateFlow={(description) => {}}
								onCreateTool={(description) => {}}
							/>
						)}
						
						{developmentSubTab === 'changes' && (
							<DiffNavigationPortal 
								changeGroups={[]} // This would come from actual change data
								onAcceptGroup={(groupId) => handleAcceptChange(groupId)}
								onRejectGroup={(groupId) => handleRejectChange(groupId)}
								onAcceptFile={(groupId, filePath, type) => {
									vscode.postMessage({
										type: 'ACCEPT_FILE_CHANGE',
										payload: { groupId, filePath, type }
									});
								}}
								onRejectFile={(groupId, filePath, type) => {
									vscode.postMessage({
										type: 'REJECT_FILE_CHANGE',
										payload: { groupId, filePath, type }
									});
								}}
								onModifyChange={(groupId, filePath, newContent) => {
									vscode.postMessage({
										type: 'MODIFY_FILE_CHANGE',
										payload: { groupId, filePath, newContent }
									});
								}}
								onRequestExplanation={(groupId, filePath) => {
									vscode.postMessage({
										type: 'REQUEST_CHANGE_EXPLANATION',
										payload: { groupId, filePath }
									});
								}}
							/>
						)}
						
						{developmentSubTab === 'checkpoints' && (
							<ChangeCheckpoints 
								checkpoints={[]} // This would come from actual checkpoint data
								onCreateCheckpoint={handleCreateCheckpoint}
								onRestoreCheckpoint={handleRestoreCheckpoint}
								onDeleteCheckpoint={(checkpointId) => {}}
								onViewCheckpointDiff={(checkpointId) => {}}
							/>
						)}
					</div>
				</div>
			);
		}

		// Collaboration Center
		if (activeTab === 'collaboration-center') {
			const collaborationSubTabs = [
				{ value: 'messages', label: 'Messages', icon: <MessageSquare size={16} /> },
				{ value: 'agents', label: 'Agents', icon: <Users size={16} /> },
				{ value: 'decisions', label: 'Decisions', icon: <Bolt size={16} /> }
			];

			return (
				<div className="collaboration-container">
					{renderSubTabs('collaboration', collaborationSubTab, setCollaborationSubTab, collaborationSubTabs)}
					
					<div className="collaboration-content">
						{collaborationSubTab === 'messages' && (
							<div className="chat-container">
								<div className="sidebar">
									<div className="sidebar-header">
										<h3>Active Agents</h3>
										<button 
											className="toggle-button"
											onClick={handleToggleAgentPanel}
											aria-label="Toggle agent panel"
										>
											{isAgentPanelOpen ? <ChevronRight size={16} /> : <ChevronRight size={16} />}
										</button>
									</div>
									{isAgentPanelOpen && (
										<div className={`agent-list ${isAgentPanelExpanded ? 'expanded' : ''}`}>
											<div className="agent-list-header">
												<h4>Agents</h4>
												<button 
													className="expand-button"
													onClick={handleExpandAgentPanel}
													aria-label="Expand agent panel"
												>
													{isAgentPanelExpanded ? <ChevronsDown size={16} /> : <ChevronsUp size={16} />}
												</button>
											</div>
											{projectState.activeAgents.map((agent) => (
												<AgentCard 
													key={agent.id}
													agent={agent}
													isSelected={targetAgentId === agent.id}
													onClick={() => handleAgentSelect(agent)}
													expanded={isAgentPanelExpanded}
												/>
											))}
										</div>
									)}
								</div>
								
								<div className="main-content">
									<ChatWindow 
										messages={currentMessages}
										currentAgentId={targetAgentId}
										agents={projectState.activeAgents}
										messageListRef={messageListRef}
									/>
									
									<div className="message-input-container">
										<textarea
											className="message-input"
											value={newMessageContent}
											onChange={(e) => setNewMessageContent(e.target.value)}
											onKeyDown={handleKeyDown}
											placeholder={`Message ${targetAgentId ? projectState.activeAgents.find(a => a.id === targetAgentId)?.name || 'selected agent' : 'all agents'}...`}
											disabled={sendingMessage}
										/>
										<button 
											className="send-button"
											onClick={sendMessage}
											disabled={!newMessageContent.trim() || sendingMessage}
										>
											<Send size={16} />
										</button>
									</div>
								</div>
							</div>
						)}
						
						{collaborationSubTab === 'agents' && (
							<div className="agents-grid">
								{projectState.activeAgents.map((agent) => (
									<div key={agent.id} className="agent-card">
										<AgentCard 
											agent={agent}
											expanded={true}
											showControls={true}
											onActivate={() => handleActivateAgent(agent.id)}
											onDeactivate={() => handleDeactivateAgent(agent.id)}
										/>
									</div>
								))}
							</div>
						)}
						
						{collaborationSubTab === 'decisions' && (
							<DecisionPanel 
								decisions={projectState.pendingDecisions}
								agents={projectState.activeAgents}
								onResolveDecision={handleResolveDecision}
								onSubmitDecision={handleSubmitDecision}
							/>
						)}
					</div>
				</div>
			);
		}

		// Learning & Improvement
		if (activeTab === 'learning-improvement') {
			const learningSubTabs = [
				{ value: 'feedback', label: 'Feedback', icon: <MessageSquare size={16} /> },
				{ value: 'learning', label: 'Learning', icon: <Brain size={16} /> },
				{ value: 'reflection', label: 'Reflection', icon: <IterationCcw size={16} /> }
			];

			return (
				<div className="learning-container">
					{renderSubTabs('learning', learningSubTab, setLearningSubTab, learningSubTabs)}
					
					<div className="learning-content">
						{learningSubTab === 'feedback' && (
							<FeedbackSystem
								agents={projectState.activeAgents.map(agent => ({ id: agent.id, name: agent.name || agent.role }))}
								onSubmitFeedback={(feedback) => {
									return new Promise((resolve) => {
										vscode.postMessage({
											type: 'COLLECT_FEEDBACK',
											payload: { 
												sourceId: feedback.sourceId, 
												targetId: feedback.targetId, 
												feedbackType: feedback.feedbackType, 
												content: feedback.content 
											}
										});
										resolve({ success: true });
									});
								}}
								onAnalyzeFeedback={(request) => {
									return new Promise((resolve) => {
										vscode.postMessage({
											type: 'ANALYZE_FEEDBACK',
											payload: { 
												targetId: request.targetId, 
												feedbackTypes: request.feedbackTypes 
											}
										});
										resolve({ success: true });
									});
								}}
							/>
						)}
						
						{learningSubTab === 'learning' && (
							<LearningSystem
										onCaptureExperience={(experience) => {
											return new Promise((resolve) => {
												vscode.postMessage({
													type: 'CAPTURE_EXPERIENCE',
													payload: { 
														agentId: experience.agent_id, 
														context: experience.context, 
														decision: experience.decision, 
														outcome: experience.outcome 
													}
												});
												resolve({ success: true });
											});
										}}
										onExtractPatterns={(agentId, topic) => {
											return new Promise((resolve) => {
												vscode.postMessage({
													type: 'EXTRACT_PATTERNS',
													payload: { agentId, topic }
												});
												resolve({ success: true });
											});
										}}
										agentNames={projectState.activeAgents.reduce((acc: Record<string, string>, agent) => {
											acc[agent.id] = agent.name || agent.role;
											return acc;
										}, {})}
									/>
						)}
						{learningSubTab === 'reflection' && (
							<ReflectionSystem
								onCreateReflection={(agents, focus, reflectionAgent) => {
									return new Promise((resolve) => {
										vscode.postMessage({
											type: 'CREATE_REFLECTION',
											payload: { agents, focus, reflectionAgent }
										});
										resolve({ success: true });
									});
								}}
								onExtractInsights={(agentId, reflectionTypes) => {
									return new Promise((resolve) => {
										vscode.postMessage({
											type: 'EXTRACT_INSIGHTS',
											payload: { agentId, reflectionTypes }
										});
										resolve({ success: true });
									});
								}}
								onCreateImprovementPlan={(agentId, opportunities) => {
									return new Promise((resolve) => {
										vscode.postMessage({
											type: 'CREATE_IMPROVEMENT_PLAN',
											payload: { agentId, opportunities }
										});
										resolve({ success: true });
									});
								}}
								agents={projectState.activeAgents.map(agent => ({ id: agent.id, name: agent.name || agent.role }))}
							/>
						)}
					</div>
				</div>
			);
		}

		return null;
	};

	return (
		<div className="crew-panel">
			{renderHeader()}
			<TabContent>
				{renderTabContent()}
			</TabContent>
		</div>
	);
};

// Add default export
export default CrewPanel;