"""
Dynamic Agent Creation Tools for Tribe
"""

from typing import Dict, Any, List, Optional
from crewai import Agent, Task
import logging
import uuid
import time

class AgentCreationTool:
    """Tool for dynamically creating new agents during runtime."""
    
    def create_agent(self, role, name, backstory, goal, personality_attributes=None, allow_delegation=True,
                    allow_code_execution=True, memory=True, planning=True, initial_tasks=None):
        """
        Create a new agent with specified parameters.
        
        Args:
            role (str): The agent's role/function
            name (str): Character-like name for the agent
            backstory (str): Detailed background establishing expertise and context
            goal (str): Clear, measurable objective for the agent
            personality_attributes (dict): Distinctive traits affecting communication style,
                problem-solving approach, collaboration preferences
            allow_delegation (bool): Whether the agent can delegate tasks
            allow_code_execution (bool): Whether the agent can execute code
            memory (bool): Whether the agent has memory capabilities
            planning (bool): Whether the agent can create plans
            initial_tasks (list): List of initial tasks for the agent
            
        Returns:
            Agent: The newly created agent instance
        """
        try:
            logging.info(f"Creating agent: {name} ({role})")
            
            # Create agent with CrewAI
            agent = Agent(
                role=role,
                goal=goal,
                backstory=backstory,
                verbose=True,
                allow_delegation=allow_delegation,
                allow_code_execution=allow_code_execution,
                memory=memory
            )
            
            # Set additional attributes
            agent.name = name
            agent.id = str(uuid.uuid4())
            agent.personality_attributes = personality_attributes or {}
            agent.creation_time = time.time()
            
            # Add initial tasks if provided
            if initial_tasks:
                agent.initial_tasks = []
                for task_desc in initial_tasks:
                    task = Task(
                        description=task_desc,
                        expected_output="Task completion",
                        agent=agent
                    )
                    agent.initial_tasks.append(task)
            
            logging.info(f"Agent created successfully: {name}")
            return agent
            
        except Exception as e:
            logging.error(f"Error creating agent: {str(e)}")
            raise


class TeamCreationTool:
    """Tool for creating specialized sub-teams within the agent ecosystem."""
    
    def create_team(self, name, description, purpose, members=None, manager=None, workflows=None):
        """
        Create a new team or sub-group.
        
        Args:
            name (str): Identifying name for the team
            description (str): Team's function and scope
            purpose (str): Clear objective for the team
            members (list): Initial agents to include
            manager (Agent): Team lead or manager
            workflows (list): Predefined workflows for the team
            
        Returns:
            dict: The newly created team configuration
        """
        try:
            logging.info(f"Creating team: {name}")
            
            team_id = str(uuid.uuid4())
            
            # Create team configuration
            team = {
                "id": team_id,
                "name": name,
                "description": description,
                "purpose": purpose,
                "creation_time": time.time(),
                "members": [],
                "manager_id": manager.id if manager else None,
                "workflows": workflows or []
            }
            
            # Add members if provided
            if members:
                for agent in members:
                    team["members"].append({
                        "id": agent.id,
                        "name": agent.name if hasattr(agent, "name") else agent.role,
                        "role": agent.role
                    })
            
            logging.info(f"Team created successfully: {name} with {len(team['members'])} members")
            return team
            
        except Exception as e:
            logging.error(f"Error creating team: {str(e)}")
            raise


class ToolCreationTool:
    """Tool for generating new capabilities for agents."""
    
    def create_tool(self, name, description, function_definition, required_parameters,
                   return_type, usage_examples, integration_point="agent"):
        """
        Create a new tool that agents can use.
        
        Args:
            name (str): Name of the tool
            description (str): What the tool does
            function_definition (str): Code/definition of the tool's functionality
            required_parameters (list): Inputs needed for the tool
            return_type (str): What the tool returns
            usage_examples (list): Examples showing how to use the tool
            integration_point (str): Where the tool should be available
            
        Returns:
            dict: The newly created tool configuration
        """
        try:
            logging.info(f"Creating tool: {name}")
            
            tool_id = str(uuid.uuid4())
            
            # Create tool configuration
            tool = {
                "id": tool_id,
                "name": name,
                "description": description,
                "function_definition": function_definition,
                "required_parameters": required_parameters,
                "return_type": return_type,
                "usage_examples": usage_examples,
                "integration_point": integration_point,
                "creation_time": time.time()
            }
            
            logging.info(f"Tool created successfully: {name}")
            return tool
            
        except Exception as e:
            logging.error(f"Error creating tool: {str(e)}")
            raise


class WorkflowCreationTool:
    """Tool for defining sequences of operations across agents."""
    
    def create_workflow(self, name, description, steps, trigger_conditions=None,
                       success_criteria=None, failure_handling=None, agents_involved=None):
        """
        Create a new workflow for coordinating multi-agent activities.
        
        Args:
            name (str): Identifier for the workflow
            description (str): What the workflow accomplishes
            steps (list): Ordered sequence of actions/tasks
            trigger_conditions (dict): When the workflow should start
            success_criteria (dict): How to determine completion
            failure_handling (dict): Steps to take if issues arise
            agents_involved (list): Which agents participate
            
        Returns:
            dict: The newly created workflow
        """
        try:
            logging.info(f"Creating workflow: {name}")
            
            workflow_id = str(uuid.uuid4())
            
            # Create workflow configuration
            workflow = {
                "id": workflow_id,
                "name": name,
                "description": description,
                "steps": steps,
                "trigger_conditions": trigger_conditions or {},
                "success_criteria": success_criteria or {},
                "failure_handling": failure_handling or {},
                "agents_involved": [agent.id for agent in agents_involved] if agents_involved else [],
                "creation_time": time.time()
            }
            
            logging.info(f"Workflow created successfully: {name} with {len(steps)} steps")
            return workflow
            
        except Exception as e:
            logging.error(f"Error creating workflow: {str(e)}")
            raise


class TaskCreationTool:
    """Tool for generating new tasks during runtime."""
    
    def create_task(self, description, assigned_to=None, dependencies=None,
                   estimated_effort=None, priority=None, evaluation_criteria=None):
        """
        Create a new task for assignment.
        
        Args:
            description (str): What needs to be done
            assigned_to (Agent): Agent responsible for completion
            dependencies (list): Tasks that must be completed first
            estimated_effort (str): Expected time/resources required
            priority (int): Importance ranking
            evaluation_criteria (dict): How to judge successful completion
            
        Returns:
            Task: The newly created task
        """
        try:
            logging.info(f"Creating task: {description[:50]}...")
            
            # Create task with CrewAI
            task = Task(
                description=description,
                expected_output="Task completion",
                agent=assigned_to
            )
            
            # Set additional attributes
            task.id = str(uuid.uuid4())
            task.dependencies = dependencies or []
            task.estimated_effort = estimated_effort
            task.priority = priority or 0
            task.evaluation_criteria = evaluation_criteria or {}
            task.creation_time = time.time()
            
            logging.info(f"Task created successfully")
            return task
            
        except Exception as e:
            logging.error(f"Error creating task: {str(e)}")
            raise


class PromptCreationTool:
    """Tool for generating optimized prompts for foundation model interactions."""
    
    def create_optimized_prompt(self, purpose, context, desired_output_format=None,
                              constraints=None, additional_instructions=None):
        """
        Query the foundation model to create an optimized prompt.
        
        Args:
            purpose (str): Goal of the prompt
            context (str): Relevant background information
            desired_output_format (str): Structure for the response
            constraints (list): Limitations or requirements
            additional_instructions (str): Any special considerations
            
        Returns:
            str: Optimized prompt for the foundation model
        """
        try:
            logging.info(f"Creating optimized prompt for: {purpose}")
            
            # Construct the meta-prompt
            meta_prompt = f"""
            Design an optimized prompt for the following purpose: "{purpose}"
            
            Context information:
            {context}
            
            Your prompt should:
            1. Provide clear, specific instructions
            2. Include relevant context without redundancy
            3. Structure information in a logical sequence
            4. Specify desired output format clearly
            5. Include constraints and requirements
            6. Anticipate potential misunderstandings
            
            """
            
            if desired_output_format:
                meta_prompt += f"\nDesired output format: {desired_output_format}\n"
                
            if constraints:
                meta_prompt += f"\nConstraints: {', '.join(constraints)}\n"
                
            if additional_instructions:
                meta_prompt += f"\nAdditional instructions: {additional_instructions}\n"
                
            meta_prompt += "\nReturn only the optimized prompt text without additional explanations."
            
            # In a real implementation, this would call the foundation model
            # For now, we'll return the meta-prompt as a placeholder
            logging.info(f"Optimized prompt created successfully")
            return meta_prompt
            
        except Exception as e:
            logging.error(f"Error creating optimized prompt: {str(e)}")
            raise 