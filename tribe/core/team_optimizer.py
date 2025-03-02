"""Team optimization logic for agent crews."""
from typing import List, Dict, Any, Optional, Tuple
from enum import Enum
import json
import random
from .crew_collab import CollaborationMode

class OptimizationMetric(Enum):
    """Metrics used for team optimization."""
    EFFICIENCY = "efficiency"
    CREATIVITY = "creativity"
    QUALITY = "quality"
    SPEED = "speed"
    COST = "cost"

class TeamRole(Enum):
    """Common team roles."""
    LEADER = "leader"
    SPECIALIST = "specialist"
    GENERALIST = "generalist"
    COORDINATOR = "coordinator"
    INNOVATOR = "innovator"
    IMPLEMENTER = "implementer"
    REVIEWER = "reviewer"

class OptimizationStrategy(Enum):
    """Strategies for team optimization."""
    BALANCED = "balanced"
    SPECIALIZED = "specialized"
    MINIMAL = "minimal"
    COMPREHENSIVE = "comprehensive"
    AGILE = "agile"

class AgentCapability:
    """Represents a capability or skill of an agent."""
    
    def __init__(self, name: str, proficiency: float, experience: int = 0):
        self.name = name
        self.proficiency = min(max(proficiency, 0.0), 1.0)  # Between 0 and 1
        self.experience = experience  # Number of tasks completed using this capability
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "proficiency": self.proficiency,
            "experience": self.experience
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'AgentCapability':
        return cls(
            name=data["name"],
            proficiency=data["proficiency"],
            experience=data.get("experience", 0)
        )

class TeamOptimizer:
    """Optimizes team composition and collaboration strategies using AI-driven insights."""
    
    def __init__(self, foundation_model=None):
        self.collaboration_mode = CollaborationMode.SEQUENTIAL
        self.foundation_model = foundation_model
        self.optimization_history: List[Dict[str, Any]] = []
        self.agent_performance_history: Dict[str, List[Dict[str, Any]]] = {}
    
    def optimize_team_composition(
        self, 
        agents: List[Dict[str, Any]], 
        requirements: Dict[str, Any],
        strategy: OptimizationStrategy = OptimizationStrategy.BALANCED,
        primary_metric: OptimizationMetric = OptimizationMetric.EFFICIENCY
    ) -> List[Dict[str, Any]]:
        """Optimize team composition based on requirements.
        
        Args:
            agents: List of agent specifications
            requirements: Task requirements and constraints
            strategy: Optimization strategy to use
            primary_metric: Primary metric to optimize for
            
        Returns:
            Optimized list of agent specifications
        """
        if not agents:
            return []
            
        # Extract skills required from requirements
        required_skills = self._extract_required_skills(requirements)
        
        # Score each agent based on required skills and metrics
        agent_scores = self._score_agents(agents, required_skills, primary_metric)
        
        # Apply optimization strategy
        optimized_team = self._apply_optimization_strategy(
            agents, 
            agent_scores, 
            strategy, 
            requirements
        )
        
        # Record optimization for learning
        self._record_optimization(agents, optimized_team, requirements, strategy, primary_metric)
        
        return optimized_team
    
    def _extract_required_skills(self, requirements: Dict[str, Any]) -> List[str]:
        """Extract required skills from task requirements."""
        skills = []
        
        # Extract from task description
        description = requirements.get("description", "")
        if description:
            # Basic keyword extraction (in a real system, this would use NLP)
            common_skills = [
                "coding", "debugging", "design", "testing", "documentation",
                "analysis", "architecture", "leadership", "coordination"
            ]
            skills.extend([skill for skill in common_skills if skill.lower() in description.lower()])
        
        # Extract from explicit skill requirements
        if "required_skills" in requirements:
            skills.extend(requirements["required_skills"])
            
        return list(set(skills))  # Remove duplicates
    
    def _score_agents(
        self, 
        agents: List[Dict[str, Any]], 
        required_skills: List[str],
        primary_metric: OptimizationMetric
    ) -> Dict[str, float]:
        """Score agents based on how well they match required skills and metrics."""
        scores = {}
        
        for agent in agents:
            agent_id = agent["id"]
            score = 0.0
            
            # Score based on skills match
            agent_skills = agent.get("capabilities", [])
            for skill in required_skills:
                for agent_skill in agent_skills:
                    if isinstance(agent_skill, dict):
                        skill_name = agent_skill.get("name", "")
                        proficiency = agent_skill.get("proficiency", 0.0)
                    else:
                        skill_name = agent_skill
                        proficiency = 0.5  # Default if not specified
                        
                    if skill.lower() in skill_name.lower():
                        score += proficiency
            
            # Adjust score based on performance history
            if agent_id in self.agent_performance_history:
                history = self.agent_performance_history[agent_id]
                if history:
                    metric_values = [h.get(primary_metric.value, 0.5) for h in history]
                    avg_metric = sum(metric_values) / len(metric_values)
                    score *= (0.5 + avg_metric)
            
            # Adjust score based on agent role if it matches task needs
            agent_role = agent.get("role", "").lower()
            if "leadership" in required_skills and "lead" in agent_role:
                score *= 1.5
            elif "coordination" in required_skills and "coordinat" in agent_role:
                score *= 1.5
                
            scores[agent_id] = score
            
        return scores
    
    def _apply_optimization_strategy(
        self,
        agents: List[Dict[str, Any]],
        agent_scores: Dict[str, float],
        strategy: OptimizationStrategy,
        requirements: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Apply the selected optimization strategy to create the team."""
        agent_dict = {agent["id"]: agent for agent in agents}
        team_size = requirements.get("team_size", len(agents))
        
        # Handle different strategies
        if strategy == OptimizationStrategy.MINIMAL:
            # Select minimum viable team (top N scorers)
            min_size = min(3, len(agents))  # At least 3 or all if less
            top_agents = sorted(agent_scores.items(), key=lambda x: x[1], reverse=True)[:min_size]
            return [agent_dict[agent_id] for agent_id, _ in top_agents]
            
        elif strategy == OptimizationStrategy.SPECIALIZED:
            # Prioritize specialists in required skills
            required_skills = self._extract_required_skills(requirements)
            specialists = []
            
            # First, add specialists for each required skill
            for skill in required_skills:
                best_agent_id = None
                best_score = -1
                
                for agent_id, agent in agent_dict.items():
                    if agent_id in specialists:
                        continue
                        
                    capabilities = agent.get("capabilities", [])
                    for capability in capabilities:
                        if isinstance(capability, dict):
                            cap_name = capability.get("name", "")
                            proficiency = capability.get("proficiency", 0)
                        else:
                            cap_name = capability
                            proficiency = 0.5
                            
                        if skill.lower() in cap_name.lower() and proficiency > best_score:
                            best_score = proficiency
                            best_agent_id = agent_id
                
                if best_agent_id:
                    specialists.append(best_agent_id)
                    
            # Then fill remaining slots with top scorers
            remaining = team_size - len(specialists)
            if remaining > 0:
                remaining_agents = [
                    agent_id for agent_id in agent_scores 
                    if agent_id not in specialists
                ]
                remaining_agents.sort(key=lambda x: agent_scores[x], reverse=True)
                specialists.extend(remaining_agents[:remaining])
                
            return [agent_dict[agent_id] for agent_id in specialists if agent_id in agent_dict]
            
        elif strategy == OptimizationStrategy.COMPREHENSIVE:
            # Include all agents, but prioritize top scorers for key roles
            sorted_agents = sorted(agent_scores.items(), key=lambda x: x[1], reverse=True)
            top_agents = [agent_id for agent_id, _ in sorted_agents[:team_size]]
            return [agent_dict[agent_id] for agent_id in top_agents]
            
        elif strategy == OptimizationStrategy.AGILE:
            # Balance of specialists and generalists with focus on adaptability
            specialists = []
            generalists = []
            
            for agent_id, agent in agent_dict.items():
                role = agent.get("role", "").lower()
                if "specialist" in role:
                    specialists.append(agent_id)
                elif "generalist" in role or len(agent.get("capabilities", [])) > 3:
                    generalists.append(agent_id)
                    
            # Sort specialists and generalists by score
            specialists.sort(key=lambda x: agent_scores.get(x, 0), reverse=True)
            generalists.sort(key=lambda x: agent_scores.get(x, 0), reverse=True)
            
            # Select 70% specialists, 30% generalists
            spec_count = int(team_size * 0.7)
            gen_count = team_size - spec_count
            
            team_ids = specialists[:spec_count] + generalists[:gen_count]
            if len(team_ids) < team_size:
                # Fill remaining spots with top scorers
                remaining = sorted(agent_scores.items(), key=lambda x: x[1], reverse=True)
                for agent_id, _ in remaining:
                    if agent_id not in team_ids:
                        team_ids.append(agent_id)
                        if len(team_ids) >= team_size:
                            break
                            
            return [agent_dict[agent_id] for agent_id in team_ids if agent_id in agent_dict]
            
        else:  # Default BALANCED strategy
            # Create a balanced team with a mix of skills
            required_skills = self._extract_required_skills(requirements)
            skill_coverage = {skill: [] for skill in required_skills}
            
            # Map agents to skills they cover
            for agent_id, agent in agent_dict.items():
                capabilities = agent.get("capabilities", [])
                for capability in capabilities:
                    if isinstance(capability, dict):
                        cap_name = capability.get("name", "")
                    else:
                        cap_name = capability
                        
                    for skill in required_skills:
                        if skill.lower() in cap_name.lower():
                            skill_coverage[skill].append(agent_id)
            
            # Ensure at least one agent per skill
            selected_agents = set()
            for skill, agents in skill_coverage.items():
                if agents:
                    # Sort agents by score
                    agents.sort(key=lambda x: agent_scores.get(x, 0), reverse=True)
                    # Add highest scoring agent for this skill
                    selected_agents.add(agents[0])
            
            # Fill remaining slots with highest scorers
            sorted_by_score = sorted(agent_scores.items(), key=lambda x: x[1], reverse=True)
            for agent_id, _ in sorted_by_score:
                if len(selected_agents) >= team_size:
                    break
                if agent_id not in selected_agents:
                    selected_agents.add(agent_id)
                    
            return [agent_dict[agent_id] for agent_id in selected_agents if agent_id in agent_dict]
    
    def determine_collaboration_mode(self, task_requirements: Dict[str, Any]) -> CollaborationMode:
        """Determine best collaboration mode based on task requirements.
        
        Args:
            task_requirements: Requirements and constraints for the task
            
        Returns:
            Appropriate CollaborationMode for the task
        """
        task_type = task_requirements.get("type", "").lower()
        complexity = task_requirements.get("complexity", "medium").lower()
        
        # Determine mode based on task type and complexity
        if "research" in task_type or "exploration" in task_type:
            return CollaborationMode.PARALLEL
        elif "implementation" in task_type and complexity in ["high", "complex"]:
            return CollaborationMode.HIERARCHICAL
        elif "brainstorming" in task_type:
            return CollaborationMode.COLLABORATIVE
        elif "review" in task_type or "validation" in task_type:
            return CollaborationMode.SEQUENTIAL
        elif complexity in ["low", "simple"]:
            return CollaborationMode.SEQUENTIAL
        else:
            # Default for medium complexity tasks
            return CollaborationMode.HYBRID
        
    def assign_roles(self, agents: List[Dict[str, Any]], task: Dict[str, Any]) -> Dict[str, List[str]]:
        """Assign roles to agents based on task requirements.
        
        Args:
            agents: List of agent specifications
            task: Task specification and requirements
            
        Returns:
            Mapping of roles to agent IDs
        """
        roles = {}
        
        # Extract key task information
        task_skills = task.get("required_skills", [])
        task_type = task.get("type", "")
        
        # Identify required roles for the task
        required_roles = self._identify_required_roles(task)
        
        # Score agents for each role
        role_scores = {role: {} for role in required_roles}
        
        for agent in agents:
            agent_id = agent["id"]
            agent_role = agent.get("role", "")
            agent_skills = agent.get("capabilities", [])
            
            for role in required_roles:
                score = 0
                
                # Higher score if agent's designated role matches
                if role.lower() in agent_role.lower():
                    score += 2
                    
                # Score based on skills relevant to the role
                role_skills = self._get_skills_for_role(role, task_type)
                for skill in role_skills:
                    if any(skill.lower() in (str(s).lower() if not isinstance(s, dict) else s.get("name", "").lower()) for s in agent_skills):
                        score += 1
                        
                # Consider past performance in this role
                if agent_id in self.agent_performance_history:
                    history = [h for h in self.agent_performance_history[agent_id] 
                              if h.get("role", "").lower() == role.lower()]
                    if history:
                        avg_performance = sum(h.get("performance", 0.5) for h in history) / len(history)
                        score *= (0.5 + avg_performance)
                        
                role_scores[role][agent_id] = score
        
        # Assign roles based on scores
        for role in required_roles:
            if not role_scores[role]:  # Skip if no agents scored for this role
                continue
                
            # Sort agents by score for this role
            sorted_agents = sorted(role_scores[role].items(), key=lambda x: x[1], reverse=True)
            
            # Determine how many agents needed for this role
            num_agents = 1
            if role == TeamRole.LEADER.value:
                num_agents = 1
            elif role == TeamRole.SPECIALIST.value:
                num_agents = min(len(task_skills), len(agents) // 2)
            elif role == TeamRole.IMPLEMENTER.value:
                num_agents = max(1, len(agents) // 3)
                
            # Assign top scoring agents to this role
            roles[role] = [agent_id for agent_id, _ in sorted_agents[:num_agents]]
        
        return roles
    
    def _identify_required_roles(self, task: Dict[str, Any]) -> List[str]:
        """Identify required roles for a task."""
        task_type = task.get("type", "").lower()
        roles = []
        
        # Every task needs a leader
        roles.append(TeamRole.LEADER.value)
        
        # Task-specific roles
        if "research" in task_type or "exploration" in task_type:
            roles.append(TeamRole.SPECIALIST.value)
            roles.append(TeamRole.INNOVATOR.value)
        elif "implementation" in task_type:
            roles.append(TeamRole.IMPLEMENTER.value)
            roles.append(TeamRole.REVIEWER.value)
        elif "design" in task_type:
            roles.append(TeamRole.INNOVATOR.value)
            roles.append(TeamRole.SPECIALIST.value)
        elif "review" in task_type:
            roles.append(TeamRole.REVIEWER.value)
        elif "coordination" in task_type:
            roles.append(TeamRole.COORDINATOR.value)
        else:
            # Default roles for unspecified task types
            roles.append(TeamRole.GENERALIST.value)
            roles.append(TeamRole.IMPLEMENTER.value)
            
        return roles
    
    def _get_skills_for_role(self, role: str, task_type: str) -> List[str]:
        """Get skills that are relevant for a specific role in the context of a task."""
        if role == TeamRole.LEADER.value:
            return ["leadership", "coordination", "planning", "communication"]
        elif role == TeamRole.SPECIALIST.value:
            if "coding" in task_type:
                return ["programming", "debugging", "coding"]
            elif "design" in task_type:
                return ["design", "architecture", "ui/ux"]
            elif "research" in task_type:
                return ["research", "analysis", "data"]
            else:
                return ["expertise", "specialization"]
        elif role == TeamRole.IMPLEMENTER.value:
            return ["coding", "implementation", "execution"]
        elif role == TeamRole.INNOVATOR.value:
            return ["creativity", "innovation", "brainstorming"]
        elif role == TeamRole.REVIEWER.value:
            return ["review", "testing", "quality assurance", "feedback"]
        elif role == TeamRole.COORDINATOR.value:
            return ["coordination", "communication", "organization"]
        else:  # GENERALIST
            return ["versatility", "adaptability", "problem-solving"]
    
    def update_agent_performance(self, agent_id: str, task_data: Dict[str, Any], 
                                performance_metrics: Dict[str, float]) -> None:
        """Update performance history for an agent after task completion."""
        if agent_id not in self.agent_performance_history:
            self.agent_performance_history[agent_id] = []
            
        performance_record = {
            "task_id": task_data.get("id"),
            "task_type": task_data.get("type"),
            "role": task_data.get("assigned_role"),
            "timestamp": task_data.get("completion_time"),
            **performance_metrics
        }
        
        self.agent_performance_history[agent_id].append(performance_record)
        
        # Limit history size to avoid unbounded growth
        if len(self.agent_performance_history[agent_id]) > 100:
            self.agent_performance_history[agent_id] = self.agent_performance_history[agent_id][-100:]
    
    def _record_optimization(self, 
                           original_team: List[Dict[str, Any]], 
                           optimized_team: List[Dict[str, Any]],
                           requirements: Dict[str, Any],
                           strategy: OptimizationStrategy,
                           primary_metric: OptimizationMetric) -> None:
        """Record optimization for learning and improvement."""
        import datetime
        record = {
            "timestamp": datetime.datetime.now().isoformat(),
            "requirements": requirements,
            "strategy": strategy.value,
            "primary_metric": primary_metric.value,
            "original_team_size": len(original_team),
            "optimized_team_size": len(optimized_team),
            "original_team_ids": [a["id"] for a in original_team],
            "optimized_team_ids": [a["id"] for a in optimized_team],
        }
        
        self.optimization_history.append(record)
        
        # Limit history size
        if len(self.optimization_history) > 100:
            self.optimization_history = self.optimization_history[-100:]
