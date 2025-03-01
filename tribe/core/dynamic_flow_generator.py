from crewai.flow.flow import Flow, listen, start
from typing import Dict, List, Any, Optional
import json
import inspect

class DynamicFlowGenerator:
    """Generates dynamic flows based on agent analysis and requirements"""
    
    def __init__(self):
        self.flow_templates = {}
        self.generated_flows = {}
    
    def analyze_and_generate_flow(self, requirements: Dict[str, Any], context: Dict[str, Any]) -> str:
        """Analyzes requirements and generates a new flow class dynamically"""
        
        # Create a flow definition based on requirements
        flow_definition = self._create_flow_definition(requirements, context)
        
        # Generate the flow class dynamically
        flow_class = self._generate_flow_class(flow_definition)
        
        # Register the flow for future use
        flow_id = f"dynamic_flow_{len(self.generated_flows)}"
        self.generated_flows[flow_id] = flow_class
        
        return flow_id
    
    def _create_flow_definition(self, requirements: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        """Creates a flow definition based on requirements and context"""
        
        # Analyze requirements to determine needed steps
        steps = []
        dependencies = []
        
        # Determine initial state requirements
        state_requirements = {
            'input_requirements': requirements,
            'context': context,
            'execution_history': []
        }
        
        # Analyze the task to determine necessary steps
        if 'task_type' in requirements:
            if requirements['task_type'] == 'code_modification':
                steps.extend([
                    ('analyze_current_code', {'requires': []}),
                    ('identify_changes', {'requires': ['analyze_current_code']}),
                    ('implement_changes', {'requires': ['identify_changes']}),
                    ('verify_changes', {'requires': ['implement_changes']})
                ])
            elif requirements['task_type'] == 'architecture_design':
                steps.extend([
                    ('analyze_requirements', {'requires': []}),
                    ('design_architecture', {'requires': ['analyze_requirements']}),
                    ('validate_design', {'requires': ['design_architecture']}),
                    ('generate_implementation_plan', {'requires': ['validate_design']})
                ])
        
        # Add any custom steps from requirements
        if 'custom_steps' in requirements:
            for step in requirements['custom_steps']:
                steps.append((step['name'], {'requires': step.get('requires', [])}))
        
        return {
            'steps': steps,
            'dependencies': dependencies,
            'state_requirements': state_requirements
        }
    
    def _generate_flow_class(self, flow_definition: Dict[str, Any]) -> type:
        """Generates a new Flow class dynamically based on the definition"""
        
        class_dict = {
            '__module__': __name__,
            'state_requirements': flow_definition['state_requirements']
        }
        
        # Generate the start method (first step)
        first_step = flow_definition['steps'][0]
        
        def generate_step_method(step_name: str, step_config: Dict[str, Any]):
            def step_method(self, previous_output: Any = None):
                # Record step execution in history
                self.state['execution_history'].append({
                    'step': step_name,
                    'input': previous_output
                })
                
                # Execute the step using appropriate agent
                result = self._execute_step(step_name, previous_output)
                
                # Store result in state
                self.state[f'{step_name}_result'] = result
                return result
            
            # Set the method name
            step_method.__name__ = step_name
            return step_method
        
        # Add the start method
        start_method = generate_step_method(first_step[0], first_step[1])
        class_dict[first_step[0]] = start()(start_method)
        
        # Generate methods for remaining steps
        for i in range(1, len(flow_definition['steps'])):
            step = flow_definition['steps'][i]
            step_method = generate_step_method(step[0], step[1])
            
            # Get the dependencies for this step
            depends_on = step[1]['requires']
            if depends_on:
                # Create a listener that waits for all required steps
                step_method = listen(*depends_on)(step_method)
            else:
                # If no explicit dependencies, listen to the previous step
                step_method = listen(flow_definition['steps'][i-1][0])(step_method)
            
            class_dict[step[0]] = step_method
        
        # Add helper methods
        def _execute_step(self, step_name: str, input_data: Any) -> Any:
            """Executes a single step using appropriate agent"""
            # Get the agent for this step type
            agent = self._get_agent_for_step(step_name)
            
            # Execute the step
            result = agent.execute_task({
                'step_name': step_name,
                'input_data': input_data,
                'context': self.state['context']
            })
            
            return result
        
        def _get_agent_for_step(self, step_name: str) -> Any:
            """Returns the appropriate agent for a given step"""
            # This could be enhanced to use a more sophisticated agent selection mechanism
            from .dynamic import DynamicAgent
            
            return DynamicAgent(
                name=f"{step_name}_agent",
                role=f"Expert in {step_name}",
                goal=f"Successfully execute {step_name}",
                backstory=f"An expert agent specialized in {step_name}",
                allow_delegation=True,
                allow_code_execution=True
            )
        
        class_dict['_execute_step'] = _execute_step
        class_dict['_get_agent_for_step'] = _get_agent_for_step
        
        # Create and return the new Flow class
        return type('DynamicGeneratedFlow', (Flow,), class_dict)
    
    def get_flow(self, flow_id: str) -> Optional[type]:
        """Retrieves a previously generated flow class"""
        return self.generated_flows.get(flow_id)
