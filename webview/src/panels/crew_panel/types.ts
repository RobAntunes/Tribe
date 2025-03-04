export interface AutonomyLevel {
    level: 'FULL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'MINIMAL';
    value: number;
    description: string;
}

export interface DecisionCriteria {
    confidenceThreshold: number;
    riskTolerance: number;
    maxResourceUsage: number;
    requiredApprovals: number;
    timeoutSeconds: number;
}

export interface TaskType {
    name: string;
    criteria: DecisionCriteria;
}

export interface AutonomyState {
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

export interface PerformanceMetrics {
    successRate: number;
    taskCompletionTime: number;
    resourceUsage: number;
    errorRate: number;
}

export interface Agent {
    id: string;
    name?: string;
    role: string;
    status: string;
    backstory?: string;
    description?: string;
    short_description?: string;
    autonomyState?: AutonomyState;
    performanceMetrics?: PerformanceMetrics;
    tools?:
        | Array<{
              name: string;
              description: string;
          }>
        | string[];
    collaborationPatterns?: any;
    learningEnabled?: boolean;
}

export interface AgentContext {
    id: string;
    name?: string;
    role?: string;
    description?: string;
    backstory?: string;
    skills?: string[];
    tools?: string[] | Array<{name: string; description: string;}>;
}

export interface Message {
    id: string;
    sender: string;
    content: string;
    timestamp: string;
    type: 'user' | 'agent' | 'system';
    targetAgent?: string;
    teamId?: string;
    isManagerResponse?: boolean;
    isVPResponse?: boolean;
    isTeamMessage?: boolean;
    originalResponses?: Message[];
    read?: boolean;
    isLoading?: boolean;
    isError?: boolean;
    status?: 'loading' | 'error' | 'complete';
    agentContext?: AgentContext; // Full agent context for the sender (if agent) or targetAgent
}

export interface Team {
    id: string;
    name: string;
    managerId: string;
    members: string[];
    parentTeamId?: string;
}

export interface ProjectState {
    initialized: boolean;
    vision: string;
    currentPhase: string;
    activeAgents: Agent[];
    agents: Agent[];
    pendingDecisions: any[];
    tasks: any[];
    notifications: any[];
    teams: Team[];
    vpAgent?: Agent;
}

export interface Tool {
    name: string;
    description: string;
    category: string;
    parameters?: Record<string, any>;
    returnType?: string;
    isDynamic?: boolean;
}

export interface AgentSpec {
    id?: string;
    name: string;
    role: string;
    skills?: string[];
    description?: string;
    responsibilities?: string[];
    tools?: string[];
    autonomyLevel?: number;
    customAttributes?: Record<string, any>;
}
