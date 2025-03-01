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
import './CrewPanel.css';
import { ActionPanel } from './components/ActionPanel';
import { AgentCard } from './components/AgentCard';
import { ChatWindow } from './components/ChatWindow';
import { DecisionPanel } from './components/DecisionPanel';
import { TaskList } from './components/TaskList';
import { Message, Agent, ProjectState } from './types';
import { DiffNavigationPortal } from './components/DiffNavigationPortal';
import { ChangeCheckpoints } from './components/ChangeCheckpoints';
import { TribeDashboard } from './components/TribeDashboard';
import { ProjectDashboard } from './components/ProjectDashboard';
import { ToolsPanel } from './components/ToolsPanel';
import { LearningDashboard } from './components/LearningDashboard';
import { ConsolidatedDashboard } from './components/ConsolidatedDashboard';


// Initialize VS Code API only once
const vscode = getVsCodeApi();

interface AutonomyLevel {
	level: 'FULL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'MINIMAL';
	value: number;
	description: string;
}

interface DecisionCriteria {
	confidenceThreshold: number;
	riskTolerance: number;
	maxResourceUsage: number;
	requiredApprovals: number;
	timeoutSeconds: number;
}

interface TaskType {
	name: string;
	criteria: DecisionCriteria;
}

interface AutonomyState {
	level: AutonomyLevel;
	taskTypes: Record<string, DecisionCriteria>;
	performanceHistory: number[];
	adaptationHistory: Array<{
		type: 'increase' | 'decrease';
		from: number;
		to: number;
		reason: string;
		timestamp: string;
	}>;
}

interface PerformanceMetrics {
	successRate: number;
	taskCompletionTime: number;
	resourceUsage: number;
	errorRate: number;
}

interface FlowSuggestion {
	id: string;
	name: string;
	confidence: number;
	description: string;
	steps: string[];
	context: any;
}

interface FlowState {
	flowType: string;
	result: any;
	state: any;
	visualizations: any[];
	proposedChanges: {
		filesToModify: Array<{ path: string; content: string }>;
		filesToCreate: Array<{ path: string; content: string }>;
		filesToDelete: string[];
	};
	genesisAnalysis?: {
		suggestions: Array<{
			type: string;
			description: string;
			priority: 'high' | 'medium' | 'low';
			impact: string;
		}>;
		codebaseHealth: number;
	};
}

interface PendingInstruction {
	id: string;
	question: string;
	context: string;
	timestamp: string;
}

interface Task {
	id: string;
	title: string;
	description: string;
	status: 'pending' | 'in-progress' | 'completed' | 'blocked';
	assignedTo: string;
	crew: string;
	priority: 'high' | 'medium' | 'low';
}

interface TeamMessage extends Message {
	teamId: string;
	consolidatedResponse?: boolean;
}

interface FileChange {
	path: string;
	content: string;
	originalContent?: string;
	explanation?: string;
	hunks?: Array<{
		startLine: number;
		endLine: number;
		content: string;
		originalContent?: string;
	}>;
}

interface ChangeGroup {
	id: string;
	title: string;
	description: string;
	agentId: string;
	agentName: string;
	timestamp: string;
	files: {
		modify: FileChange[];
		create: FileChange[];
		delete: string[];
	};
}

interface Implementation {
	id: string;
	title: string;
	description: string;
	tradeoffs: {
		pros: string[];
		cons: string[];
	};
	files: {
		modify: FileChange[];
		create: FileChange[];
		delete: string[];
	};
}

interface Conflict {
	id: string;
	type: 'merge' | 'dependency' | 'logic' | 'other';
	description: string;
	status: 'pending' | 'resolving' | 'resolved' | 'failed';
	files: string[];
	agentId?: string;
	agentName?: string;
}

interface Annotation {
	id: string;
	content: string;
	author: {
		id: string;
		name: string;
		type: 'human' | 'agent';
	};
	timestamp: string;
	filePath?: string;
	lineStart?: number;
	lineEnd?: number;
	codeSnippet?: string;
	replies: Annotation[];
}

interface Checkpoint {
	id: string;
	timestamp: string;
	description: string;
	changes: {
		modified: number;
		created: number;
		deleted: number;
	};
}

interface CrewPanelState {
	changeGroups: ChangeGroup[];
	alternativeImplementations: Implementation[];
	conflicts: Conflict[];
	annotations: Annotation[];
	checkpoints: Checkpoint[];
	isResolvingConflicts: boolean;
	currentUser: {
		id: string;
		name: string;
	};
	agents: Array<{
		id: string;
		name: string;
	}>;
}

interface CrewPanelProps {
	activeFlow?: FlowState;
	suggestedFlows?: FlowSuggestion[];
}

// Utility components
const TabButton = ({
	active,
	onClick,
	icon,
	label,
	description,
	tabIndex = -1
}: {
	active: boolean;
	onClick: MouseEventHandler<HTMLButtonElement>;
	icon: ReactNode;
	label: string;
	description: string;
	tabIndex?: number;
}) => {
	const handleClick: MouseEventHandler<HTMLButtonElement> = (e) => {
		e.preventDefault();
		onClick(e);
	};

	const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			onClick(event as any);
		}
	};

	return (
		<button
			className={`tab-button ${active ? 'active' : ''}`}
			onClick={handleClick}
			onKeyDown={handleKeyDown}
			role="tab"
			aria-selected={active}
			aria-controls={`${label.toLowerCase()}-panel`}
			id={`${label.toLowerCase()}-tab`}
			tabIndex={active ? 0 : tabIndex}
		>
			<span className="tab-icon w-3 h-3" aria-hidden="true">{icon}</span>
			<div className="tab-content">
				<span className="tab-label">{label}</span>
				<span className="tab-description">{description}</span>
			</div>
			<span className="tab-indicator" aria-hidden="true">
				{active ? <ChevronsUp size={14} /> : <ChevronsDown size={14} />}
			</span>
		</button>
	);
};

const SectionHeader = ({
	title,
	isExpanded,
	onToggle,
	icon
}: {
	title: string;
	isExpanded: boolean;
	onToggle: () => void;
	icon: ReactNode;
}) => (
	<button
		className={`list-item ${isExpanded ? 'active' : ''}`}
		onClick={onToggle}
	>
		{isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
		{icon}
		<span>{title}</span>
	</button>
);

// Simple AgentsTab component
interface AgentsTabProps {
	agents: Agent[];
	onSelectTab?: (tabId: string) => void;
	onSetActiveAgent?: (agentId: string) => void;
}

const AgentsTab: React.FC<AgentsTabProps> = ({ agents, onSelectTab, onSetActiveAgent }) => {
	const handleDirectMessage = (agentId: string) => {
		// Set the active agent for messaging
		if (onSetActiveAgent) {
			onSetActiveAgent(agentId);
		}
		
		// Switch to the messages tab
		if (onSelectTab) {
			onSelectTab('messages' as any);
		}
	};

	return (
		<div className="agents-tab">
			{agents.length === 0 ? (
				<div className="no-agents">No agents created yet.</div>
			) : (
				agents.map((agent) => (
					<AgentCard 
						key={agent.id} 
						agent={agent}
						selected={false}
						onSelect={() => {}}
						onSendMessage={() => {}}
						messages={[]} 
						onDirectMessage={handleDirectMessage}
					/>
				))
			)}
		</div>
	);
};

// Add this function near the top of the file, after imports
function checkTabContentVisibility() {
	console.log('Checking tab content visibility...');
	
	// Check if the dashboard tab is properly configured
	const dashboardTab = document.querySelector('.tab-content-container');
	if (dashboardTab) {
		console.log('Dashboard tab found in DOM');
		
		// Check computed styles
		const computedStyle = window.getComputedStyle(dashboardTab);
		console.log('Dashboard tab computed styles:', {
			display: computedStyle.display,
			visibility: computedStyle.visibility,
			opacity: computedStyle.opacity,
			height: computedStyle.height,
			width: computedStyle.width,
			position: computedStyle.position,
			zIndex: computedStyle.zIndex,
			overflow: computedStyle.overflow
		});
		
		// Check parent elements
		let parent = dashboardTab.parentElement;
		let depth = 1;
		while (parent && depth <= 5) {
			console.log(`Parent ${depth} tag:`, parent.tagName);
			const parentStyle = window.getComputedStyle(parent);
			console.log(`Parent ${depth} computed styles:`, {
				display: parentStyle.display,
				visibility: parentStyle.visibility,
				opacity: parentStyle.opacity,
				height: parentStyle.height,
				width: parentStyle.width,
				position: parentStyle.position,
				zIndex: parentStyle.zIndex,
				overflow: parentStyle.overflow
			});
			parent = parent.parentElement;
			depth++;
		}
	} else {
		console.error('Dashboard tab NOT found in DOM');
	}
	
	// Check for the ConsolidatedDashboard component
	const consolidatedDashboard = document.querySelector('.consolidated-dashboard');
	if (consolidatedDashboard) {
		console.log('ConsolidatedDashboard found in DOM');
		const computedStyle = window.getComputedStyle(consolidatedDashboard);
		console.log('ConsolidatedDashboard computed styles:', {
			display: computedStyle.display,
			visibility: computedStyle.visibility,
			opacity: computedStyle.opacity,
			height: computedStyle.height,
			width: computedStyle.width,
			position: computedStyle.position,
			zIndex: computedStyle.zIndex,
			overflow: computedStyle.overflow
		});
	} else {
		console.error('ConsolidatedDashboard NOT found in DOM');
	}
	
	// Check for the dashboard content
	const dashboardContent = document.querySelector('.dashboard-content');
	if (dashboardContent) {
		console.log('Dashboard content found in DOM');
		const computedStyle = window.getComputedStyle(dashboardContent);
		console.log('Dashboard content computed styles:', {
			display: computedStyle.display,
			visibility: computedStyle.visibility,
			opacity: computedStyle.opacity,
			height: computedStyle.height,
			width: computedStyle.width,
			position: computedStyle.position,
			zIndex: computedStyle.zIndex,
			overflow: computedStyle.overflow
		});
	} else {
		console.error('Dashboard content NOT found in DOM');
	}
	
	// Check for the test component
	const testComponent = document.querySelector('.dashboard-content div');
	if (testComponent) {
		console.log('Test component found in DOM');
		const computedStyle = window.getComputedStyle(testComponent);
		console.log('Test component computed styles:', {
			display: computedStyle.display,
			visibility: computedStyle.visibility,
			opacity: computedStyle.opacity,
			height: computedStyle.height,
			width: computedStyle.width,
			position: computedStyle.position,
			zIndex: computedStyle.zIndex,
			overflow: computedStyle.overflow
		});
	} else {
		console.error('Test component NOT found in DOM');
	}
}

const CrewPanelComponent = ({ activeFlow: initialActiveFlow, suggestedFlows: initialSuggestedFlows }: CrewPanelProps = {}) => {
	// Tab configuration types
	type TabType = 'get-started' | 'overview' | 'agents' | 'messages' | 'tasks' | 'decisions' | 'actions' | 'changes' | 'checkpoints' | 'tribe' | 'dashboard';

	// Initialize VS Code state
	const initialState: { projectState: ProjectState; agents: Agent[]; messages: Message[] } = vscode.getState() || {
		projectState: {
			initialized: false,
			vision: '',
			currentPhase: '',
			activeAgents: [],
			agents: [],
			pendingDecisions: [],
			tasks: [],
			notifications: [],
			teams: []
		},
		agents: [],
		messages: []
	};

	// All state declarations
	const [loading, setLoading] = useState(false);
	const [projectState, setProjectState] = useState<ProjectState>(initialState.projectState);
	const [messages, setMessages] = useState<Message[]>(initialState.messages);
	const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
	const [tabLoadingStates, setTabLoadingStates] = useState<Record<TabType, boolean>>({
		'get-started': false,
		'overview': false,
		'agents': false,
		'messages': false,
		'tasks': false,
		'decisions': false,
		'actions': false,
		'changes': false,
		'checkpoints': false,
		'tribe': false,
		'dashboard': false
	});
	const [tabErrorStates, setTabErrorStates] = useState<Record<TabType, Error | null>>({} as Record<TabType, Error | null>);
	const [activeTab, setActiveTab] = useState<TabType | null>(projectState.initialized ? 'overview' : 'get-started');
	const [activeFlow, setActiveFlow] = useState<FlowState | null>(initialActiveFlow || null);
	const [suggestedFlows, setSuggestedFlows] = useState<FlowSuggestion[]>(initialSuggestedFlows || []);
	const [isAnalyzing, setIsAnalyzing] = useState(false);
	const [agents, setAgents] = useState<Agent[]>(initialState.agents || []);
	const [currentMessage, setCurrentMessage] = useState('');
	const [pendingInstructions, setPendingInstructions] = useState<PendingInstruction[]>([]);
	const [isPanelOpen, setIsPanelOpen] = useState(true);
	const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['agents']));
	const [currentMessageId, setCurrentMessageId] = useState('');
	const [teamMessages, setTeamMessages] = useState<Message[]>([]);
	const [directMessages, setDirectMessages] = useState<Record<string, Message[]>>({});
	const [loadingAgent, setLoadingAgent] = useState<string | undefined>(undefined);
	const [changeGroups, setChangeGroups] = useState<ChangeGroup[]>([]);
	const [state, setState] = useState<CrewPanelState>({
		changeGroups: [],
		alternativeImplementations: [],
		conflicts: [],
		annotations: [],
		checkpoints: [],
		isResolvingConflicts: false,
		currentUser: { id: 'user', name: 'You' },
		agents: []
	});

	// Add new system state variables
	const [projectSystemEnabled, setProjectSystemEnabled] = useState(true);
	const [toolsSystemEnabled, setToolsSystemEnabled] = useState(true);
	const [learningSystemEnabled, setLearningSystemEnabled] = useState(true);

	// Tab configuration
	const tabOrder: TabType[] = projectState.initialized
		? ['overview', 'agents', 'messages', 'tasks', 'decisions', 'actions', 'changes', 'checkpoints', 'tribe', 'dashboard']
		: ['get-started'];

	// Add debugging logs
	useEffect(() => {
		console.log('Project state initialized:', projectState.initialized);
		console.log('Tab order:', tabOrder);
		console.log('Active tab:', activeTab);
	}, [projectState.initialized, tabOrder, activeTab]);

	const tabConfig: Record<TabType, {
		icon: ReactNode;
		label: string;
		description: string;
		errorBoundary?: boolean;
	}> = {
		'get-started': {
			icon: <Rocket size={16} />,
			label: 'Get Started',
			description: 'Set up your project'
		},
		overview: {
			icon: <Activity size={16} />,
			label: 'Overview',
			description: 'Project overview'
		},
		agents: {
			icon: <Users size={16} />,
			label: 'Agents',
			description: 'Manage agents'
		},
		messages: {
			icon: <MessageSquare size={16} />,
			label: 'Messages',
			description: 'Agent messages'
		},
		tasks: {
			icon: <Activity size={16} />,
			label: 'Tasks',
			description: 'Manage tasks'
		},
		decisions: {
			icon: <GitMerge size={16} />,
			label: 'Decisions',
			description: 'Pending decisions'
		},
		actions: {
			icon: <Code size={16} />,
			label: 'Actions',
			description: 'Agent actions'
		},
		changes: {
			icon: <IterationCcw size={16} />,
			label: 'Changes',
			description: 'Code changes'
		},
		checkpoints: {
			icon: <Flag size={16} />,
			label: 'Checkpoints',
			description: 'Code checkpoints'
		},
		tribe: {
			icon: <Users size={16} />,
			label: 'Tribe',
			description: 'Tribe dashboard'
		},
		dashboard: {
			icon: <Layers size={16} />,
			label: 'Dashboard',
			description: 'Consolidated project dashboard'
		}
	};

	// Refs
	const messagesEndRef = useRef<HTMLDivElement>(null);

	// Message handling
	const handleMessage = (event: MessageEvent) => {
		const message = event.data;
		console.log('Webview received message:', message);

		switch (message.type) {
			case 'flow-update':
				setActiveFlow((prev: FlowState | null) => prev ? { ...prev, ...message.flow } : message.flow);
				setLoading(false);
				break;
			case 'agents-update':
			case 'AGENTS_LOADED':
				console.log('Updating agents:', message.payload || message.agents);
				const newAgents = (message.payload || message.agents || []).map((agent: any) => ({
					...agent,
					name: agent.name || agent.role || '',
					role: agent.role || '',
					short_description: agent.short_description || '',
					autonomyState: agent.autonomyState || {
						level: {
							level: 'MEDIUM',
							value: 0.5,
							description: 'Default autonomy level'
						},
						taskTypes: {},
						performanceHistory: [],
						adaptationHistory: []
					},
					performanceMetrics: agent.performanceMetrics || {
						successRate: 0,
						taskCompletionTime: 0,
						resourceUsage: 0,
						errorRate: 0
					},
					tools: agent.tools || [],
					collaborationPatterns: agent.collaborationPatterns || [],
					learningEnabled: agent.learningEnabled || true
				}));
				setAgents(newAgents);
				setProjectState((prev: ProjectState) => ({
					...prev,
					activeAgents: newAgents
				}));
				break;
			case 'message':
			case 'MESSAGE_RESPONSE':
				const newMessage = message.content || message.payload;
				if (message.error) {
					console.error('Message error:', message.error);
					setTabErrorStates(prev => ({
						...prev,
						messages: new Error(message.error)
					}));
					return;
				}
				
				if (newMessage.targetAgent) {
					// Handle direct message
					setDirectMessages(prev => ({
						...prev,
						[newMessage.targetAgent]: [
							...(prev[newMessage.targetAgent] || []),
							{ ...newMessage, read: false }
						]
					}));
				} else if (newMessage.teamId) {
					// Handle team message
					if (newMessage.isManagerResponse) {
						// This is a consolidated response from a manager
						setTeamMessages(prev => [...prev, {
							...newMessage,
							content: `[${newMessage.sender}] ${newMessage.content}`,
							originalResponses: newMessage.originalResponses,
							read: false
						}]);
					} else {
						setTeamMessages(prev => [...prev, { ...newMessage, read: false }]);
					}
				}
				setLoading(false);
				break;
			case 'MESSAGE_UPDATE':
				const updatedMessage = message.payload;
				console.log('Message update received:', updatedMessage);
				
				// If this is a completed message, clear the loading indicator
				if (updatedMessage.status === 'complete') {
					setLoadingAgent(undefined);
				}
				
				// Check if this is a VP response (team coordination)
				if (updatedMessage.isVPResponse) {
					// This is a response from VP of Engineering (team coordination)
					setTeamMessages(prev => {
						const existingMessageIndex = prev.findIndex(msg => msg.id === updatedMessage.id);
						
						if (existingMessageIndex >= 0) {
							// Update existing message
							return prev.map((msg, index) => 
								index === existingMessageIndex ? { ...msg, ...updatedMessage } : msg
							);
						} else {
							// Add new message
							return [...prev, { 
								...updatedMessage, 
								teamId: 'root', // Ensure team ID is set
								read: false 
							}];
						}
					});
				}
				// Check if this is a direct agent response
				else if (updatedMessage.targetAgent) {
					// Update direct message
					setDirectMessages(prev => {
						const agentMessages = prev[updatedMessage.targetAgent] || [];
						const existingMessageIndex = agentMessages.findIndex(msg => msg.id === updatedMessage.id);
						
						if (existingMessageIndex >= 0) {
							// Update existing message
							return {
								...prev,
								[updatedMessage.targetAgent]: agentMessages.map((msg, index) => 
									index === existingMessageIndex ? { ...msg, ...updatedMessage } : msg
								)
							};
						} else {
							// Add new message
							return {
								...prev,
								[updatedMessage.targetAgent]: [
									...agentMessages,
									{ ...updatedMessage, read: false }
								]
							};
						}
					});
				} 
				// Check if this is a team message
				else if (updatedMessage.teamId) {
					// Update team message
					setTeamMessages(prev => {
						const existingMessageIndex = prev.findIndex(msg => msg.id === updatedMessage.id);
						
						if (existingMessageIndex >= 0) {
							// Update existing message
							return prev.map((msg, index) => 
								index === existingMessageIndex ? { ...msg, ...updatedMessage } : msg
							);
						} else {
							// Add new message
							return [...prev, { ...updatedMessage, read: false }];
						}
					});
				} 
				// Regular message (not direct or team)
				else {
					// For backward compatibility, add to general messages
					setMessages(prev => {
						const existingMessageIndex = prev.findIndex(msg => msg.id === updatedMessage.id);
						
						if (existingMessageIndex >= 0) {
							// Update existing message
							return prev.map((msg, index) => 
								index === existingMessageIndex ? { ...msg, ...updatedMessage } : msg
							);
						} else {
							// Add new message
							return [...prev, { ...updatedMessage, read: false }];
						}
					});
				}
				break;
			case 'analysis-complete':
				setLoading(false);
				setSuggestedFlows(message.flows || []);
				setIsAnalyzing(false);
				break;
			case 'teamCreated':
				console.log('Team created:', message.payload);
				// Handle the team creation response
				const teamData = message.payload;
				const teamAgents = (teamData.agents || []).map((agent: { 
					id?: string;
					name?: string;
					role?: string;
					status?: string;
					backstory?: string;
					short_description?: string;
					autonomyState?: any;
					performanceMetrics?: any;
					tools?: any[];
					collaborationPatterns?: any[];
					learningEnabled?: boolean;
				}) => ({
					id: agent.id || '',
					name: agent.name || agent.role || '',
					role: agent.role || '',
					status: agent.status || 'active',
					backstory: agent.backstory || '',
					short_description: agent.short_description || '',
					autonomyState: agent.autonomyState || {
						level: {
							level: 'MEDIUM',
							value: 0.5,
							description: 'Default autonomy level'
						},
						taskTypes: {},
						performanceHistory: [],
						adaptationHistory: []
					},
					performanceMetrics: agent.performanceMetrics || {
						successRate: 0,
						taskCompletionTime: 0,
						resourceUsage: 0,
						errorRate: 0
					},
					tools: agent.tools || [],
					collaborationPatterns: agent.collaborationPatterns || [],
					learningEnabled: agent.learningEnabled || true
				}));
				
				// Find VP of Engineering in team agents
				const vpAgent = teamAgents.find((agent: Agent) => agent.role === 'VP of Engineering');
				
				setProjectState((prev: ProjectState) => ({
					...prev,
					initialized: true,
					vision: teamData.vision || prev.vision,
					currentPhase: 'Team Created',
					activeAgents: teamAgents,
					tasks: teamData.tasks || prev.tasks || [],
					vpAgent: vpAgent || null  // Set VP of Engineering state
				}));
				setAgents(teamAgents);
				setLoading(false);
				setActiveTab('overview');
				break;
			case 'PROJECT_INITIALIZED':
				console.log('Project initialized:', message.payload);
				const initData = message.payload;
				const initAgents = (initData.agents || []).map((agent: any) => ({
					...agent,
					name: agent.name || agent.role || '',
					role: agent.role || '',
					short_description: agent.short_description || '',
					autonomyState: agent.autonomyState || {
						level: {
							level: 'MEDIUM',
							value: 0.5,
							description: 'Default autonomy level'
						},
						taskTypes: {},
						performanceHistory: [],
						adaptationHistory: []
					},
					performanceMetrics: agent.performanceMetrics || {
						successRate: 0,
						taskCompletionTime: 0,
						resourceUsage: 0,
						errorRate: 0
					},
					tools: agent.tools || [],
					collaborationPatterns: agent.collaborationPatterns || [],
					learningEnabled: agent.learningEnabled || true
				}));
				
				// Find VP of Engineering in initialized agents
				const initializedVP = initAgents.find((agent: Agent) => agent.role === 'VP of Engineering');
				
				setProjectState((prev: ProjectState) => ({
					...prev,
					initialized: true,
					vision: initData.vision || prev.vision,
					currentPhase: initData.currentPhase || 'Project Initialized',
					activeAgents: initAgents,
					vpAgent: initializedVP || null  // Set VP of Engineering state
				}));
				if (initAgents.length > 0) {
					setAgents(initAgents);
				}
				setLoading(false);
				break;
			case 'AGENT_CREATED':
				console.log('Agent created:', message.payload);
				setAgents((prev: Agent[]) => [...prev, message.payload]);
				break;
			case 'TASK_CREATED':
				console.log('Task created:', message.payload);
				setProjectState((prev: ProjectState) => ({
					...prev,
					tasks: [...(prev.tasks || []), message.payload]
				}));
				break;
			case 'error':
				console.error('Error received:', message.payload);
				// Handle error messages
				const tabType = getTabTypeFromError(message.payload);
				if (tabType) {
					setTabErrorStates((prev) => ({
						...prev,
						[tabType]: new Error(message.payload)
					}));
				}
				setLoading(false);
				break;
			case 'AUTONOMY_UPDATED':
				console.log('Agent autonomy updated:', message.payload);
				setAgents((prev: Agent[]) => prev.map(agent => 
					agent.id === message.payload.agentId
						? { ...agent, ...message.payload.updates }
						: agent
				));
				break;
			case 'LOADING_INDICATOR':
				// Set the loading agent
				console.log('Setting loading agent:', message.payload.sender);
				if (message.payload && message.payload.sender) {
					setLoadingAgent(message.payload.sender);
				} else {
					console.warn('LOADING_INDICATOR received without sender:', message);
				}
				break;
				
			case 'HIDE_LOADING_INDICATOR':
				// Clear the loading agent
				console.log('Clearing loading agent');
				setLoadingAgent(undefined);
				break;
			case 'FLOW_EXECUTED':
				const { proposedChanges, result, state } = message.payload;
				const flowId = state?.flowId || `flow-${Date.now()}`;
				const agentId = state?.agentId || 'unknown';
				const agent = agents.find(a => a.id === agentId);
				
				// Create a change group from the flow execution result
				const newGroup = {
					id: flowId,
					title: state?.flowName || 'Proposed Changes',
					description: result?.summary || 'Changes proposed by the agent',
					agentId,
					agentName: agent?.name || agent?.role || 'Unknown Agent',
					timestamp: new Date().toISOString(),
					files: {
						modify: proposedChanges.filesToModify || [],
						create: proposedChanges.filesToCreate || [],
						delete: proposedChanges.filesToDelete || []
					}
				};
				
				setChangeGroups(prev => [...prev, newGroup]);
				setActiveFlow({
					flowType: 'code',
					result,
					state,
					visualizations: message.payload.visualizations || [],
					proposedChanges
				});
				break;
			case 'CHANGES_APPLIED':
				setLoading(false);
				// Remove the applied change group
				if (activeFlow?.proposedChanges) {
					setChangeGroups(prev => prev.filter(group => 
						!(JSON.stringify(group.files) === JSON.stringify({
							modify: activeFlow.proposedChanges.filesToModify || [],
							create: activeFlow.proposedChanges.filesToCreate || [],
							delete: activeFlow.proposedChanges.filesToDelete || []
						}))
					));
				}
				setActiveFlow(null);
				vscode.postMessage({ type: 'GET_AGENTS' });
				break;
			case 'CHANGES_REJECTED':
				setLoading(false);
				// Remove the rejected change group
				if (activeFlow?.proposedChanges) {
					setChangeGroups(prev => prev.filter(group => 
						!(JSON.stringify(group.files) === JSON.stringify({
							modify: activeFlow.proposedChanges.filesToModify || [],
							create: activeFlow.proposedChanges.filesToCreate || [],
							delete: activeFlow.proposedChanges.filesToDelete || []
						}))
					));
				}
				setActiveFlow(null);
				break;
			case 'updateState':
				setState(message.payload);
				break;
			case 'PROJECT_MANAGEMENT_STATUS':
				setProjectSystemEnabled(message.payload.enabled);
				break;
				
			case 'TOOLS_SYSTEM_STATUS':
				setToolsSystemEnabled(message.payload.enabled);
				break;
				
			case 'LEARNING_SYSTEM_STATUS':
				setLearningSystemEnabled(message.payload.enabled);
				break;
			default:
				console.log('Unknown message type:', message.type);
		}
	};

	// Helper function to determine which tab had an error
	const getTabTypeFromError = (error: string): TabType | null => {
		if (error.toLowerCase().includes('agent')) return 'agents';
		if (error.toLowerCase().includes('task')) return 'tasks';
		if (error.toLowerCase().includes('message')) return 'messages';
		if (error.toLowerCase().includes('team')) return 'get-started';
		return null;
	};

	// Effect to add message listener
	useEffect(() => {
		window.addEventListener('message', handleMessage);
		return () => window.removeEventListener('message', handleMessage);
	}, []);

	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
	}, [messages]);

	const handleSendMessage = async () => {
		if (!currentMessage.trim() || !selectedAgent) return;

		const newMessage: Message = {
			id: Date.now().toString(),
			sender: 'User',
			content: currentMessage,
			timestamp: new Date().toISOString(),
			type: 'user' as const
		};

		setMessages((prev: Message[]) => [...prev, newMessage]);
		setCurrentMessage('');
		setLoading(true);

		vscode.postMessage({
			type: 'SEND_MESSAGE',
			payload: {
				message: currentMessage,
				agentId: selectedAgent.id
			}
		});
	};

	const handleAcceptChanges = () => {
		if (!activeFlow?.proposedChanges) return;

		try {
			setLoading(true);
			vscode.postMessage({
				type: 'APPLY_CHANGES',
				payload: activeFlow.proposedChanges
			});
		} catch (error) {
			console.error('Failed to apply changes:', error);
			setLoading(false);
		}
	};

	const handleRejectChanges = () => {
		try {
			setLoading(true);
			vscode.postMessage({
				type: 'REJECT_CHANGES',
				payload: activeFlow?.proposedChanges
			});
			setActiveFlow(null);
		} catch (error) {
			console.error('Failed to reject changes:', error);
		} finally {
			setLoading(false);
		}
	};

	const handlePendingInstruction = (question: string, context: string) => {
		const newInstruction: PendingInstruction = {
			id: Date.now().toString(),
			question,
			context,
			timestamp: new Date().toISOString()
		};

		setPendingInstructions(prev => [...prev, newInstruction]);
		vscode.postMessage({
			type: 'PENDING_INSTRUCTION',
			payload: newInstruction
		});
	};

	const handleAutonomyUpdate = (agentId: string, updates: Partial<Agent>) => {
		vscode.postMessage({
			type: 'UPDATE_AGENT_AUTONOMY',
			payload: {
				agentId,
				updates
			}
		});
	};

	const handleTeamMessage = async (message: string) => {
		if (!message.trim() || !projectState.vpAgent) return;

		const newMessage: TeamMessage = {
			id: Date.now().toString(),
			sender: 'User',
			content: message,
			timestamp: new Date().toISOString(),
			type: 'user',
			teamId: 'root', // Root team ID for VP of Engineering
			targetAgent: projectState.vpAgent.id
		};

		// Add to team messages
		setTeamMessages(prev => [...prev, newMessage]);
		
		// Send message to VP of Engineering who will coordinate with the team
		vscode.postMessage({
			type: 'SEND_AGENT_MESSAGE',
			payload: {
				agentId: projectState.vpAgent.id,
				message,
				isVPMessage: true,
				isTeamMessage: true // Indicates this needs team coordination
			}
		});
	};

	const handleDirectMessage = async (agentId: string, message: string) => {
		if (!message.trim()) return;

		const newMessage: Message = {
			id: Date.now().toString(),
			sender: 'User',
			content: message,
			timestamp: new Date().toISOString(),
			type: 'user',
			targetAgent: agentId
		};

		// Add to direct messages
		setDirectMessages(prev => ({
			...prev,
			[agentId]: [...(prev[agentId] || []), newMessage]
		}));

		// Send message directly to the agent
		vscode.postMessage({
			type: 'SEND_AGENT_MESSAGE',
			payload: {
				agentId,
				message,
				isVPMessage: false,
				isTeamMessage: false,
				direct: true // Bypass hierarchy for direct messages
			}
		});
	};

	const handleAcceptGroup = (groupId: string) => {
		const group = changeGroups.find(g => g.id === groupId);
		if (!group) return;
		
		setLoading(true);
		vscode.postMessage({
			type: 'acceptGroup',
			payload: { groupId }
		});
	};

	const handleRejectGroup = (groupId: string) => {
		const group = changeGroups.find(g => g.id === groupId);
		if (!group) return;
		
		setLoading(true);
		vscode.postMessage({
			type: 'rejectGroup',
			payload: { groupId }
		});
		
		// Remove the group from the list
		setChangeGroups(prev => prev.filter(g => g.id !== groupId));
	};

	const handleAcceptFile = (groupId: string, filePath: string, fileType: 'modify' | 'create' | 'delete') => {
		const group = changeGroups.find(g => g.id === groupId);
		if (!group) return;
		
		// Create a payload with just this file
		const payload: any = {
			filesToModify: [],
			filesToCreate: [],
			filesToDelete: []
		};
		
		if (fileType === 'modify') {
			const file = group.files.modify.find(f => f.path === filePath);
			if (file) payload.filesToModify = [file];
		} else if (fileType === 'create') {
			const file = group.files.create.find(f => f.path === filePath);
			if (file) payload.filesToCreate = [file];
		} else if (fileType === 'delete') {
			payload.filesToDelete = [filePath];
		}
		
		setLoading(true);
		vscode.postMessage({
			type: 'acceptFile',
			payload
		});
		
		// Update the group to remove this file
		setChangeGroups(prev => prev.map(g => {
			if (g.id !== groupId) return g;
			
			const updatedGroup = { ...g };
			if (fileType === 'modify') {
				updatedGroup.files.modify = updatedGroup.files.modify.filter(f => f.path !== filePath);
			} else if (fileType === 'create') {
				updatedGroup.files.create = updatedGroup.files.create.filter(f => f.path !== filePath);
			} else if (fileType === 'delete') {
				updatedGroup.files.delete = updatedGroup.files.delete.filter(p => p !== filePath);
			}
			
			return updatedGroup;
		}));
	};

	const handleRejectFile = (groupId: string, filePath: string, fileType: 'modify' | 'create' | 'delete') => {
		// Update the group to remove this file
		setChangeGroups(prev => prev.map(g => {
			if (g.id !== groupId) return g;
			
			const updatedGroup = { ...g };
			if (fileType === 'modify') {
				updatedGroup.files.modify = updatedGroup.files.modify.filter(f => f.path !== filePath);
			} else if (fileType === 'create') {
				updatedGroup.files.create = updatedGroup.files.create.filter(f => f.path !== filePath);
			} else if (fileType === 'delete') {
				updatedGroup.files.delete = updatedGroup.files.delete.filter(p => p !== filePath);
			}
			
			return updatedGroup;
		}));
	};

	const handleModifyChange = (groupId: string, filePath: string, newContent: string) => {
		setChangeGroups(prev => prev.map(g => {
			if (g.id !== groupId) return g;
			
			const updatedGroup = { ...g };
			
			// Check if it's a file to modify
			const modifyIndex = updatedGroup.files.modify.findIndex(f => f.path === filePath);
			if (modifyIndex >= 0) {
				updatedGroup.files.modify[modifyIndex].content = newContent;
				return updatedGroup;
			}
			
			// Check if it's a file to create
			const createIndex = updatedGroup.files.create.findIndex(f => f.path === filePath);
			if (createIndex >= 0) {
				updatedGroup.files.create[createIndex].content = newContent;
				return updatedGroup;
			}
			
			return g;
		}));
	};

	const handleRequestExplanation = (groupId: string, filePath: string) => {
		// In a real implementation, this would request an explanation from the agent
		// For now, we'll just add a placeholder explanation
		setChangeGroups(prev => prev.map(g => {
			if (g.id !== groupId) return g;
			
			const updatedGroup = { ...g };
			
			// Check if it's a file to modify
			const modifyIndex = updatedGroup.files.modify.findIndex(f => f.path === filePath);
			if (modifyIndex >= 0) {
				updatedGroup.files.modify[modifyIndex].explanation = 
					`This change modifies ${filePath} to implement the requested functionality. ` +
					`The key changes include updating function signatures, adding error handling, ` +
					`and improving performance through optimized algorithms.`;
				return updatedGroup;
			}
			
			// Check if it's a file to create
			const createIndex = updatedGroup.files.create.findIndex(f => f.path === filePath);
			if (createIndex >= 0) {
				updatedGroup.files.create[createIndex].explanation = 
					`This new file ${filePath} is created to support the new feature. ` +
					`It contains utility functions and components that will be used across the application.`;
				return updatedGroup;
			}
			
			return g;
		}));
	};

	const handleSelectImplementation = (implementationId: string) => {
		vscode.postMessage({
			type: 'selectImplementation',
			payload: { implementationId }
		});
	};

	const handleDismissImplementations = () => {
		vscode.postMessage({
			type: 'dismissImplementations',
			payload: { action: 'dismiss' }
		});
	};

	const handleAddAnnotation = (annotation: Omit<Annotation, 'id' | 'timestamp' | 'replies'>) => {
		vscode.postMessage({
			type: 'addAnnotation',
			payload: { annotation }
		});
	};

	const handleEditAnnotation = (id: string, content: string) => {
		vscode.postMessage({
			type: 'editAnnotation',
			payload: { id, content }
		});
	};

	const handleDeleteAnnotation = (id: string) => {
		vscode.postMessage({
			type: 'deleteAnnotation',
			payload: { id }
		});
	};

	const handleReplyToAnnotation = (parentId: string, reply: Omit<Annotation, 'id' | 'timestamp' | 'replies'>) => {
		vscode.postMessage({
			type: 'replyToAnnotation',
			payload: { parentId, reply }
		});
	};

	const handleRestoreCheckpoint = (checkpointId: string) => {
		vscode.postMessage({
			type: 'restoreCheckpoint',
			payload: { checkpointId }
		});
	};

	const handleDeleteCheckpoint = (checkpointId: string) => {
		vscode.postMessage({
			type: 'deleteCheckpoint',
			payload: { checkpointId }
		});
	};

	const handleViewCheckpointDiff = (checkpointId: string) => {
		vscode.postMessage({
			type: 'viewCheckpointDiff',
			payload: { checkpointId }
		});
	};

	const handleCreateCheckpoint = (description: string) => {
		vscode.postMessage({
			type: 'createCheckpoint',
			payload: { description }
		});
	};

	// Add handlers for system toggles
	const handleToggleProjectSystem = (enabled: boolean) => {
		setProjectSystemEnabled(enabled);
		// Notify the extension
		vscode.postMessage({
			type: 'TOGGLE_PROJECT_MANAGEMENT',
			payload: {
				enabled
			}
		});
	};
	
	const handleToggleToolsSystem = (enabled: boolean) => {
		setToolsSystemEnabled(enabled);
		// Notify the extension
		vscode.postMessage({
			type: 'TOGGLE_TOOLS_SYSTEM',
			payload: {
				enabled
			}
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
			<div className="flex items-center space-x-3">
				<div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
					<svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
					</svg>
				</div>
				<h1 className="text-base font-semibold text-white">Tribe</h1>
			</div>
			<div className="tab-container">
				{tabOrder.map(tab => {
					const isActive = activeTab === tab;
					const config = tabConfig[tab];

					return (
						<TabButton
							key={tab}
							active={isActive}
							onClick={() => setActiveTab(isActive ? null : tab)}
							icon={config.icon}
							label={config.label}
							description={config.description}
						/>
					);
				})}
			</div>
		</div>
	);

	const getPanelClasses = () => {
		const baseClasses = "flex flex-col h-screen border-r border-gray-700/30 transition-all duration-500 ease-in-out";
		return `${baseClasses} ${isPanelOpen ? 'w-full md:w-96' : 'w-16'}`;
	};

	// Tab loading states
	const setTabLoading = (tab: TabType, loading: boolean) => {
		setTabLoadingStates(prev => ({ ...prev, [tab]: loading }));
	};

	const setTabError = (tab: TabType, error: Error | null) => {
		setTabErrorStates(prev => ({ ...prev, [tab]: error }));
	};

	const renderTabContent = () => {
		switch (activeTab) {
			case 'get-started':
				return (
					<GetStarted
						onSubmit={(vision) => {
							vscode.postMessage({
								type: 'INITIALIZE_PROJECT',
								payload: { vision }
							});
						}}
					/>
				);
			case 'overview':
				return (
					<div className="overview-tab">
						<div className="overview-header">
							<h2>Project Vision</h2>
							<p>{projectState.vision}</p>
						</div>
						<div className="overview-content">
							<div className="overview-section">
								<h3>Current Phase</h3>
								<p>{projectState.currentPhase || 'Planning'}</p>
							</div>
							<div className="overview-section">
								<h3>Active Agents</h3>
								<div className="overview-agents">
									{projectState.activeAgents.map((agent) => (
										<div key={agent.id} className="overview-agent">
											<div className="overview-agent-avatar">
												{agent.name?.substring(0, 2) || agent.role.substring(0, 2)}
											</div>
											<div className="overview-agent-info">
												<div className="overview-agent-name">{agent.name || agent.role}</div>
												<div className="overview-agent-role">{agent.short_description || agent.role}</div>
											</div>
										</div>
									))}
								</div>
							</div>
						</div>
					</div>
				);
			case 'agents':
				return (
					<div className="agents-tab">
						<div className="agents-list">
							{projectState.activeAgents.map((agent) => (
								<AgentCard
									key={agent.id}
									agent={agent}
									selected={selectedAgent?.id === agent.id}
									onSelect={(agent) => setSelectedAgent(agent)}
									onSendMessage={(agentId, message) => {
										vscode.postMessage({
											type: 'SEND_AGENT_MESSAGE',
											payload: { agentId, message }
										});
									}}
									onUpdateAutonomy={(agentId, updates) => handleAutonomyUpdate(agentId, updates)}
									messages={messages.filter(m => m.sender === agent.id || m.targetAgent === agent.id)}
								/>
							))}
						</div>
					</div>
				);
			case 'messages':
				return (
					<div className="messages-tab">
						<div className="chat-container">
							<ChatWindow
								messages={messages}
								onSendMessage={handleSendMessage}
							/>
						</div>
					</div>
				);
			case 'tasks':
				return (
					<div className="tasks-tab">
						<TaskList
							tasks={[]}
						/>
					</div>
				);
			case 'decisions':
				return (
					<div className="decisions-tab">
						<DecisionPanel
							decisions={projectState.pendingDecisions}
							onAccept={(decisionId, option) => {
								vscode.postMessage({
									type: 'ACCEPT_DECISION',
									payload: { decisionId, option }
								});
							}}
							onReject={(decisionId) => {
								vscode.postMessage({
									type: 'REJECT_DECISION',
									payload: { decisionId }
								});
							}}
						/>
					</div>
				);
			case 'actions':
				return (
					<div className="actions-tab">
						<ActionPanel
							onCreateAgent={(description) => {
								vscode.postMessage({
									type: 'CREATE_AGENT',
									payload: { description }
								});
							}}
							onCreateTask={(description) => {
								vscode.postMessage({
									type: 'CREATE_TASK',
									payload: { description }
								});
							}}
							onCreateFlow={(description) => {
								vscode.postMessage({
									type: 'CREATE_FLOW',
									payload: { description }
								});
							}}
							onCreateTool={(description) => {
								vscode.postMessage({
									type: 'CREATE_TOOL',
									payload: { description }
								});
							}}
						/>
					</div>
				);
			case 'tribe':
				return (
					<TribeDashboard />
				);
			case 'dashboard':
				return (
					<div className="dashboard-tab-wrapper">
						<ConsolidatedDashboard
							agents={projectState.activeAgents}
							selectedAgent={selectedAgent}
							projectSystemEnabled={projectSystemEnabled}
							toolsSystemEnabled={toolsSystemEnabled}
							learningSystemEnabled={learningSystemEnabled}
							onToggleProjectSystem={handleToggleProjectSystem}
							onToggleToolsSystem={handleToggleToolsSystem}
							onToggleLearningSystem={handleToggleLearningSystem}
						/>
					</div>
				);
			default:
				return null;
		}
	};

	return (
		<div className="crew-panel">
			<div className="logo-container">
				<div className="logo">
					<svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
					</svg>
				</div>
				<h1>Tribe</h1>
			</div>

			{/* Tab Navigation and Content */}
			<nav className="tabs-nav" role="tablist" onKeyDown={(event) => {
				if (!activeTab) {
					if (event.key === 'ArrowDown' || event.key === 'ArrowRight' || event.key === 'Home') {
						event.preventDefault();
						setActiveTab(tabOrder[0]);
					}
					return;
				}

				const currentIndex = tabOrder.indexOf(activeTab);
				let nextIndex: number;

				switch (event.key) {
					case 'ArrowDown':
					case 'ArrowRight':
						event.preventDefault();
						nextIndex = (currentIndex + 1) % tabOrder.length;
						setActiveTab(tabOrder[nextIndex]);
						break;

					case 'ArrowUp':
					case 'ArrowLeft':
						event.preventDefault();
						nextIndex = (currentIndex - 1 + tabOrder.length) % tabOrder.length;
						setActiveTab(tabOrder[nextIndex]);
						break;

					case 'Home':
						event.preventDefault();
						setActiveTab(tabOrder[0]);
						break;

					case 'End':
						event.preventDefault();
						setActiveTab(tabOrder[tabOrder.length - 1]);
						break;
				}
			}} aria-label="Crew Panel Navigation">
				{tabOrder.map(tab => {
					const isActive = activeTab === tab;
					const config = tabConfig[tab];

					return (
						<div key={tab} className="tab-section">
							<TabButton
								active={isActive}
								onClick={() => setActiveTab(isActive ? null : tab)}
								icon={config.icon}
								label={config.label}
								description={config.description}
							/>
							{isActive && (
								<TabContent
									isActive={isActive}
									isLoading={tabLoadingStates[tab]}
									hasError={!!tabErrorStates[tab]}
									error={tabErrorStates[tab]}
									onError={(error: Error) => setTabError(tab, error)}
									useErrorBoundary={config.errorBoundary}
								>
									{tab === 'get-started' && (
										<GetStarted
											onSubmit={(description) => {
												vscode.postMessage({
													type: 'createTeam',
													payload: { description }
												});
											}}
										/>
									)}
									{tab === 'overview' && (
										<div className="overview-content">
											<div className="card">
												<h2>Project Vision</h2>
												<p>{projectState.vision || 'No vision set'}</p>
											</div>
											<div className="card">
												<h2>Current Phase</h2>
												<div className="badge">
													{projectState.currentPhase || 'Not started'}
												</div>
											</div>
											{activeFlow && (
												<div className="card active">
													<h2>Active Flow</h2>
													<p>{activeFlow.flowType}</p>
												</div>
											)}
										</div>
									)}
									{tab === 'agents' && (
										<div className="agents-content">
											{(!Array.isArray(projectState?.activeAgents) || projectState.activeAgents.length === 0) ? (
												<div className="empty-state">
													<p>Create a team by describing your project</p>
													<button
														className="button primary"
														onClick={() => setActiveTab('get-started')}
													>
														Get Started
													</button>
												</div>
											) : (
												<AgentsTab
													agents={projectState.activeAgents}
													onSelectTab={(tabId: string) => setActiveTab(tabId as TabType)}
													onSetActiveAgent={(agentId) => {
														// Find the agent by ID
														const agent = projectState.activeAgents.find((a: Agent) => a.id === agentId);
														if (agent) {
															setSelectedAgent(agent);
														}
													}}
												/>
											)}
										</div>
									)}
									{tab === 'messages' && (
										<div className="messages-content">
											<div className="vp-header">
												<div className="vp-info">
													<h3>{projectState.vpAgent?.name || 'VP of Engineering'}</h3>
													<span className="role">{projectState.vpAgent?.short_description || projectState.vpAgent?.role || 'Team Lead'}</span>
												</div>
											</div>
											<ChatWindow
												messages={teamMessages}
												onSendMessage={handleTeamMessage}
												placeholder="Send a message to the entire team..."
												disabled={loading}
												loadingAgent={loadingAgent}
											/>
											{!projectState.vpAgent && (
												<div className="no-vp-message">
													Waiting for VP of Engineering initialization...
												</div>
											)}
										</div>
									)}
									{tab === 'tasks' && (
										<TaskList tasks={projectState.tasks || []} />
									)}
									{tab === 'decisions' && (
										<DecisionPanel
											decisions={projectState.pendingDecisions}
											onAccept={(decisionId, option) => {
												vscode.postMessage({
													type: 'ACCEPT_DECISION',
													payload: { decisionId, option }
												});
											}}
											onReject={(decisionId) => {
												vscode.postMessage({
													type: 'REJECT_DECISION',
													payload: { decisionId }
												});
											}}
										/>
									)}
									{tab === 'actions' && (
										<ActionPanel 
											onCreateAgent={(description) => {
												vscode.postMessage({
													type: 'CREATE_AGENT',
													payload: { description }
												});
											}}
											onCreateTask={(description) => {
												vscode.postMessage({
													type: 'CREATE_TASK',
													payload: { description }
												});
											}}
											onCreateFlow={(description) => {
												vscode.postMessage({
													type: 'CREATE_FLOW',
													payload: { description }
												});
											}}
											onCreateTool={(description) => {
												vscode.postMessage({
													type: 'CREATE_TOOL',
													payload: { description }
												});
											}}
										/>
									)}
									{tab === 'changes' && (
										<TabContent
											isActive={true}
											isLoading={false}
											hasError={false}
											error={null}
											onError={() => {}}
										>
											<DiffNavigationPortal
												changeGroups={changeGroups}
												onAcceptGroup={(groupId) => handleAcceptGroup(groupId)}
												onRejectGroup={(groupId) => handleRejectGroup(groupId)}
												onAcceptFile={(groupId, filePath, fileType) => handleAcceptFile(groupId, filePath, fileType)}
												onRejectFile={(groupId, filePath, fileType) => handleRejectFile(groupId, filePath, fileType)}
												onModifyChange={(groupId, filePath, newContent) => handleModifyChange(groupId, filePath, newContent)}
												onRequestExplanation={(groupId, filePath) => handleRequestExplanation(groupId, filePath)}
												onViewInEditor={(filePath, lineNumber) => {
													vscode.postMessage({
														command: 'openFile',
														filePath,
														lineNumber
													});
												}}
											/>
										</TabContent>
									)}
									{tab === 'checkpoints' && (
										<TabContent
											isActive={true}
											isLoading={false}
											hasError={false}
											error={null}
											onError={() => {}}
										>
											<ChangeCheckpoints
												checkpoints={state.checkpoints.map(checkpoint => ({
													...checkpoint,
													metadata: {
														agentId: '',
														agentName: '',
													},
													changes: {
														filesModified: checkpoint.changes.modified,
														filesCreated: checkpoint.changes.created,
														filesDeleted: checkpoint.changes.deleted
													}
												}))}
												onRestoreCheckpoint={handleRestoreCheckpoint}
												onDeleteCheckpoint={handleDeleteCheckpoint}
												onViewCheckpointDiff={handleViewCheckpointDiff}
											/>
										</TabContent>
									)}
									{tab === 'tribe' && (
										<TabContent
											isActive={true}
											isLoading={false}
											hasError={false}
											error={null}
											onError={() => {}}
										>
											<TribeDashboard />
										</TabContent>
									)}
								</TabContent>
							)}
						</div>
					);
				})}
			</nav>
		</div>
	);
}

const CrewPanel = React.memo(CrewPanelComponent);

export default CrewPanel;
