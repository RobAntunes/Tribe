"""
Reflection System for Tribe
"""

from typing import Dict, Any, List, Optional, Union
import time
import logging
import json
import uuid

class ReflectionSystem:
    """Framework for agents to analyze their own performance and decision-making processes."""
    
    def __init__(self):
        """Initialize the reflection system."""
        self.reflection_repository = {}
        self.insight_repository = {}
        self.improvement_plans = {}
        
    def create_reflection(self, agent_id: str, task_id: str, 
                         reflection_type: str, content: Dict[str, Any],
                         metadata: Optional[Dict[str, Any]] = None) -> str:
        """
        Record an agent's reflection on its own performance.
        
        Args:
            agent_id (str): Identifier for the reflecting agent
            task_id (str): Identifier for the task being reflected on
            reflection_type (str): Category of reflection (e.g., "process", "outcome", "decision")
            content (dict): Detailed reflection information
            metadata (dict, optional): Additional contextual information
            
        Returns:
            str: Reflection record identifier
        """
        reflection_id = f"reflection_{agent_id}_{task_id}_{int(time.time())}"
        
        reflection_record = {
            "id": reflection_id,
            "agent_id": agent_id,
            "task_id": task_id,
            "reflection_type": reflection_type,
            "content": content,
            "metadata": metadata or {},
            "timestamp": time.time(),
            "insights_extracted": False
        }
        
        # Store in repository
        if agent_id not in self.reflection_repository:
            self.reflection_repository[agent_id] = []
            
        self.reflection_repository[agent_id].append(reflection_record)
        
        # Log reflection creation
        logging.info(f"Created reflection: {agent_id} on task {task_id} ({reflection_type})")
        
        return reflection_id
        
    def extract_insights(self, agent_id: str, 
                        reflection_types: Optional[List[str]] = None,
                        task_ids: Optional[List[str]] = None) -> Dict[str, Any]:
        """
        Analyze reflections to identify insights and learning opportunities.
        
        Args:
            agent_id (str): Agent to analyze reflections for
            reflection_types (list, optional): Specific types of reflections to analyze
            task_ids (list, optional): Specific tasks to analyze reflections for
            
        Returns:
            dict: Extracted insights and improvement opportunities
        """
        try:
            logging.info(f"Extracting insights for {agent_id}")
            
            # Get reflections for agent
            if agent_id not in self.reflection_repository:
                logging.info(f"No reflections found for {agent_id}")
                return {"insights": [], "improvement_opportunities": [], "reflection_count": 0}
                
            reflections = self.reflection_repository[agent_id]
            
            # Apply filters
            filtered_reflections = []
            
            for reflection in reflections:
                # Filter by reflection type
                if reflection_types and reflection["reflection_type"] not in reflection_types:
                    continue
                    
                # Filter by task ID
                if task_ids and reflection["task_id"] not in task_ids:
                    continue
                    
                filtered_reflections.append(reflection)
                
            # If no reflections match criteria, return empty result
            if not filtered_reflections:
                logging.info("No matching reflections found")
                return {"insights": [], "improvement_opportunities": [], "reflection_count": 0}
                
            # Extract insights from reflections
            insights = self._identify_insights(filtered_reflections)
            
            # Identify improvement opportunities
            improvement_opportunities = self._identify_improvement_opportunities(filtered_reflections, insights)
            
            # Store insights
            insight_id = f"insight_{agent_id}_{int(time.time())}"
            
            self.insight_repository[insight_id] = {
                "id": insight_id,
                "agent_id": agent_id,
                "timestamp": time.time(),
                "reflection_count": len(filtered_reflections),
                "insights": insights,
                "improvement_opportunities": improvement_opportunities
            }
            
            # Mark reflections as processed
            for reflection in filtered_reflections:
                reflection["insights_extracted"] = True
                
            return {
                "insights": insights,
                "improvement_opportunities": improvement_opportunities,
                "reflection_count": len(filtered_reflections)
            }
            
        except Exception as e:
            logging.error(f"Error extracting insights: {str(e)}")
            return {"insights": [], "improvement_opportunities": [], "reflection_count": 0, "error": str(e)}
            
    def _identify_insights(self, reflections: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Identify insights from reflections."""
        insights = []
        
        # Group reflections by type
        reflections_by_type = {}
        
        for reflection in reflections:
            reflection_type = reflection["reflection_type"]
            
            if reflection_type not in reflections_by_type:
                reflections_by_type[reflection_type] = []
                
            reflections_by_type[reflection_type].append(reflection)
            
        # Process each reflection type
        for reflection_type, type_reflections in reflections_by_type.items():
            # Extract insights based on reflection type
            if reflection_type == "process":
                process_insights = self._extract_process_insights(type_reflections)
                insights.extend(process_insights)
            elif reflection_type == "outcome":
                outcome_insights = self._extract_outcome_insights(type_reflections)
                insights.extend(outcome_insights)
            elif reflection_type == "decision":
                decision_insights = self._extract_decision_insights(type_reflections)
                insights.extend(decision_insights)
            else:
                # Generic insight extraction for other reflection types
                generic_insights = self._extract_generic_insights(type_reflections)
                insights.extend(generic_insights)
                
        return insights
        
    def _extract_process_insights(self, reflections: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Extract insights related to process reflections."""
        insights = []
        
        # Look for patterns in process efficiency
        efficiency_mentions = []
        
        for reflection in reflections:
            content = reflection["content"]
            
            # Check for efficiency mentions
            if "efficiency" in content:
                efficiency_mentions.append({
                    "reflection_id": reflection["id"],
                    "efficiency": content["efficiency"],
                    "details": content.get("efficiency_details", "")
                })
                
        # If multiple efficiency mentions, create an insight
        if len(efficiency_mentions) >= 2:
            avg_efficiency = sum(mention["efficiency"] for mention in efficiency_mentions 
                              if isinstance(mention["efficiency"], (int, float))) / len(efficiency_mentions)
            
            insights.append({
                "type": "process_efficiency",
                "average_rating": avg_efficiency,
                "sample_size": len(efficiency_mentions),
                "supporting_reflections": [mention["reflection_id"] for mention in efficiency_mentions],
                "summary": f"Process efficiency rated at {avg_efficiency:.1f} across {len(efficiency_mentions)} reflections"
            })
            
        # Look for bottlenecks mentioned
        bottlenecks = {}
        
        for reflection in reflections:
            content = reflection["content"]
            
            if "bottlenecks" in content and isinstance(content["bottlenecks"], list):
                for bottleneck in content["bottlenecks"]:
                    if isinstance(bottleneck, str):
                        if bottleneck not in bottlenecks:
                            bottlenecks[bottleneck] = []
                            
                        bottlenecks[bottleneck].append(reflection["id"])
                    elif isinstance(bottleneck, dict) and "area" in bottleneck:
                        area = bottleneck["area"]
                        
                        if area not in bottlenecks:
                            bottlenecks[area] = []
                            
                        bottlenecks[area].append(reflection["id"])
                        
        # Create insights for common bottlenecks
        for bottleneck, reflection_ids in bottlenecks.items():
            if len(reflection_ids) >= 2:  # At least 2 mentions
                insights.append({
                    "type": "process_bottleneck",
                    "bottleneck": bottleneck,
                    "frequency": len(reflection_ids),
                    "supporting_reflections": reflection_ids,
                    "summary": f"Process bottleneck '{bottleneck}' identified in {len(reflection_ids)} reflections"
                })
                
        return insights
        
    def _extract_outcome_insights(self, reflections: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Extract insights related to outcome reflections."""
        insights = []
        
        # Look for patterns in outcome success
        success_mentions = []
        
        for reflection in reflections:
            content = reflection["content"]
            
            # Check for success mentions
            if "success" in content:
                success_value = content["success"]
                success_mentions.append({
                    "reflection_id": reflection["id"],
                    "success": success_value if isinstance(success_value, bool) else 
                              (success_value.lower() in ["true", "yes", "success", "successful"]) 
                              if isinstance(success_value, str) else False,
                    "details": content.get("success_details", "")
                })
                
        # If multiple success mentions, create an insight
        if len(success_mentions) >= 2:
            success_rate = sum(1 for mention in success_mentions if mention["success"]) / len(success_mentions)
            
            insights.append({
                "type": "outcome_success_rate",
                "success_rate": success_rate,
                "sample_size": len(success_mentions),
                "supporting_reflections": [mention["reflection_id"] for mention in success_mentions],
                "summary": f"Success rate of {success_rate:.1%} across {len(success_mentions)} reflections"
            })
            
        # Look for factors affecting outcomes
        factors = {}
        
        for reflection in reflections:
            content = reflection["content"]
            
            if "factors" in content and isinstance(content["factors"], list):
                for factor in content["factors"]:
                    if isinstance(factor, str):
                        if factor not in factors:
                            factors[factor] = []
                            
                        factors[factor].append(reflection["id"])
                    elif isinstance(factor, dict) and "name" in factor:
                        name = factor["name"]
                        
                        if name not in factors:
                            factors[name] = []
                            
                        factors[name].append(reflection["id"])
                        
        # Create insights for common factors
        for factor, reflection_ids in factors.items():
            if len(reflection_ids) >= 2:  # At least 2 mentions
                insights.append({
                    "type": "outcome_factor",
                    "factor": factor,
                    "frequency": len(reflection_ids),
                    "supporting_reflections": reflection_ids,
                    "summary": f"Outcome factor '{factor}' identified in {len(reflection_ids)} reflections"
                })
                
        return insights
        
    def _extract_decision_insights(self, reflections: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Extract insights related to decision reflections."""
        insights = []
        
        # Look for patterns in decision quality
        quality_mentions = []
        
        for reflection in reflections:
            content = reflection["content"]
            
            # Check for quality mentions
            if "quality" in content:
                quality_mentions.append({
                    "reflection_id": reflection["id"],
                    "quality": content["quality"],
                    "details": content.get("quality_details", "")
                })
                
        # If multiple quality mentions, create an insight
        if len(quality_mentions) >= 2:
            avg_quality = sum(mention["quality"] for mention in quality_mentions 
                           if isinstance(mention["quality"], (int, float))) / len(quality_mentions)
            
            insights.append({
                "type": "decision_quality",
                "average_rating": avg_quality,
                "sample_size": len(quality_mentions),
                "supporting_reflections": [mention["reflection_id"] for mention in quality_mentions],
                "summary": f"Decision quality rated at {avg_quality:.1f} across {len(quality_mentions)} reflections"
            })
            
        # Look for decision factors
        factors = {}
        
        for reflection in reflections:
            content = reflection["content"]
            
            if "factors" in content and isinstance(content["factors"], list):
                for factor in content["factors"]:
                    if isinstance(factor, str):
                        if factor not in factors:
                            factors[factor] = []
                            
                        factors[factor].append(reflection["id"])
                    elif isinstance(factor, dict) and "name" in factor:
                        name = factor["name"]
                        
                        if name not in factors:
                            factors[name] = []
                            
                        factors[name].append(reflection["id"])
                        
        # Create insights for common decision factors
        for factor, reflection_ids in factors.items():
            if len(reflection_ids) >= 2:  # At least 2 mentions
                insights.append({
                    "type": "decision_factor",
                    "factor": factor,
                    "frequency": len(reflection_ids),
                    "supporting_reflections": reflection_ids,
                    "summary": f"Decision factor '{factor}' identified in {len(reflection_ids)} reflections"
                })
                
        return insights
        
    def _extract_generic_insights(self, reflections: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Extract generic insights from reflections."""
        insights = []
        
        # Look for common themes in reflections
        themes = {}
        
        for reflection in reflections:
            content = reflection["content"]
            
            # Check for themes/categories
            if "themes" in content and isinstance(content["themes"], list):
                for theme in content["themes"]:
                    if theme not in themes:
                        themes[theme] = []
                        
                    themes[theme].append(reflection["id"])
                    
            # Check for categories
            if "categories" in content and isinstance(content["categories"], list):
                for category in content["categories"]:
                    if category not in themes:
                        themes[category] = []
                        
                    themes[category].append(reflection["id"])
                    
        # Create insights for common themes
        for theme, reflection_ids in themes.items():
            if len(reflection_ids) >= 2:  # At least 2 mentions
                insights.append({
                    "type": "common_theme",
                    "theme": theme,
                    "frequency": len(reflection_ids),
                    "supporting_reflections": reflection_ids,
                    "summary": f"Common theme '{theme}' identified in {len(reflection_ids)} reflections"
                })
                
        return insights
        
    def _identify_improvement_opportunities(self, reflections: List[Dict[str, Any]], 
                                          insights: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Identify improvement opportunities from reflections and insights."""
        opportunities = []
        
        # Look for explicit improvement suggestions in reflections
        suggestions = {}
        
        for reflection in reflections:
            content = reflection["content"]
            
            # Check for improvement suggestions
            if "improvements" in content and isinstance(content["improvements"], list):
                for improvement in content["improvements"]:
                    if isinstance(improvement, str):
                        suggestion = improvement
                        area = "general"
                    elif isinstance(improvement, dict):
                        suggestion = improvement.get("suggestion", "")
                        area = improvement.get("area", "general")
                    else:
                        continue
                        
                    if not suggestion:
                        continue
                        
                    key = f"{area}:{suggestion}"
                    
                    if key not in suggestions:
                        suggestions[key] = {
                            "area": area,
                            "suggestion": suggestion,
                            "reflection_ids": []
                        }
                        
                    suggestions[key]["reflection_ids"].append(reflection["id"])
                    
        # Create opportunities from suggestions
        for key, data in suggestions.items():
            if len(data["reflection_ids"]) >= 1:  # Even a single suggestion is valuable
                opportunities.append({
                    "type": "suggested_improvement",
                    "area": data["area"],
                    "suggestion": data["suggestion"],
                    "frequency": len(data["reflection_ids"]),
                    "supporting_reflections": data["reflection_ids"],
                    "priority": "high" if len(data["reflection_ids"]) >= 3 else "medium"
                })
                
        # Derive opportunities from insights
        for insight in insights:
            insight_type = insight["type"]
            
            if insight_type == "process_bottleneck":
                opportunities.append({
                    "type": "process_improvement",
                    "area": "bottleneck",
                    "target": insight["bottleneck"],
                    "suggestion": f"Address process bottleneck in '{insight['bottleneck']}'",
                    "supporting_insight": insight,
                    "priority": "high" if insight["frequency"] >= 3 else "medium"
                })
            elif insight_type == "outcome_success_rate" and insight["success_rate"] < 0.7:
                opportunities.append({
                    "type": "outcome_improvement",
                    "area": "success_rate",
                    "current_rate": insight["success_rate"],
                    "suggestion": f"Improve success rate (currently {insight['success_rate']:.1%})",
                    "supporting_insight": insight,
                    "priority": "high" if insight["success_rate"] < 0.5 else "medium"
                })
            elif insight_type == "decision_quality" and insight["average_rating"] < 3.5:
                opportunities.append({
                    "type": "decision_improvement",
                    "area": "quality",
                    "current_rating": insight["average_rating"],
                    "suggestion": f"Improve decision quality (currently rated {insight['average_rating']:.1f}/5)",
                    "supporting_insight": insight,
                    "priority": "high" if insight["average_rating"] < 2.5 else "medium"
                })
                
        # Sort opportunities by priority
        opportunities.sort(key=lambda x: 0 if x["priority"] == "high" else 1)
        
        return opportunities
        
    def create_improvement_plan(self, agent_id: str, 
                              opportunities: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Generate a structured plan to address identified improvement opportunities.
        
        Args:
            agent_id (str): Agent to create plan for
            opportunities (list): Improvement opportunities to address
            
        Returns:
            dict: Structured improvement plan
        """
        try:
            logging.info(f"Creating improvement plan for {agent_id}")
            
            # Filter to high and medium priority opportunities
            filtered_opportunities = [o for o in opportunities 
                                   if o.get("priority") in ["high", "medium"]]
            
            # If no opportunities, return empty plan
            if not filtered_opportunities:
                logging.info("No opportunities to address")
                return {
                    "agent_id": agent_id,
                    "timestamp": time.time(),
                    "opportunity_count": 0,
                    "actions": []
                }
                
            # Group opportunities by area
            opportunities_by_area = {}
            
            for opportunity in filtered_opportunities:
                area = opportunity.get("area", "general")
                
                if area not in opportunities_by_area:
                    opportunities_by_area[area] = []
                    
                opportunities_by_area[area].append(opportunity)
                
            # Create actions for each area
            actions = []
            
            for area, area_opportunities in opportunities_by_area.items():
                # Sort by priority
                area_opportunities.sort(key=lambda x: 0 if x.get("priority") == "high" else 1)
                
                # Create action for each opportunity
                for i, opportunity in enumerate(area_opportunities):
                    action = {
                        "id": f"action_{len(actions) + 1}",
                        "area": area,
                        "description": opportunity.get("suggestion", "Improve " + area),
                        "priority": opportunity.get("priority", "medium"),
                        "related_opportunity": opportunity,
                        "status": "planned",
                        "order": i + 1
                    }
                    
                    actions.append(action)
                    
            # Create plan
            plan_id = f"plan_{agent_id}_{int(time.time())}"
            
            plan = {
                "id": plan_id,
                "agent_id": agent_id,
                "timestamp": time.time(),
                "opportunity_count": len(filtered_opportunities),
                "actions": actions,
                "status": "created"
            }
            
            # Store plan
            self.improvement_plans[plan_id] = plan
            
            return plan
            
        except Exception as e:
            logging.error(f"Error creating improvement plan: {str(e)}")
            return {
                "agent_id": agent_id,
                "timestamp": time.time(),
                "opportunity_count": 0,
                "actions": [],
                "error": str(e)
            }
            
    def update_action_status(self, plan_id: str, action_id: str, 
                           new_status: str, notes: Optional[str] = None) -> bool:
        """
        Update the status of an improvement action.
        
        Args:
            plan_id (str): Identifier for the improvement plan
            action_id (str): Identifier for the action to update
            new_status (str): New status (e.g., "in_progress", "completed", "blocked")
            notes (str, optional): Additional notes about the status update
            
        Returns:
            bool: Success indicator
        """
        try:
            if plan_id not in self.improvement_plans:
                logging.error(f"Plan {plan_id} not found")
                return False
                
            plan = self.improvement_plans[plan_id]
            
            # Find action
            action = None
            
            for a in plan["actions"]:
                if a["id"] == action_id:
                    action = a
                    break
                    
            if not action:
                logging.error(f"Action {action_id} not found in plan {plan_id}")
                return False
                
            # Update status
            action["status"] = new_status
            
            # Add notes if provided
            if notes:
                if "notes" not in action:
                    action["notes"] = []
                    
                action["notes"].append({
                    "timestamp": time.time(),
                    "status": new_status,
                    "content": notes
                })
                
            # Update plan status if all actions are completed
            if all(a["status"] == "completed" for a in plan["actions"]):
                plan["status"] = "completed"
            elif any(a["status"] in ["in_progress", "blocked"] for a in plan["actions"]):
                plan["status"] = "in_progress"
                
            logging.info(f"Updated action {action_id} status to {new_status}")
            
            return True
            
        except Exception as e:
            logging.error(f"Error updating action status: {str(e)}")
            return False
            
    def get_reflection_summary(self, agent_id: str) -> Dict[str, Any]:
        """
        Generate a summary of all reflections for an agent.
        
        Args:
            agent_id (str): Agent to summarize reflections for
            
        Returns:
            dict: Summary statistics and insights
        """
        try:
            if agent_id not in self.reflection_repository:
                return {
                    "reflection_count": 0,
                    "reflection_types": {},
                    "recent_reflections": [],
                    "active_plans": []
                }
                
            reflections = self.reflection_repository[agent_id]
            
            # Count reflections by type
            reflection_types = {}
            
            for reflection in reflections:
                reflection_type = reflection["reflection_type"]
                reflection_types[reflection_type] = reflection_types.get(reflection_type, 0) + 1
                
            # Get recent reflections (last 5)
            recent_reflections = sorted(reflections, key=lambda x: x["timestamp"], reverse=True)[:5]
            
            # Get active improvement plans
            active_plans = []
            
            for plan_id, plan in self.improvement_plans.items():
                if plan["agent_id"] == agent_id and plan["status"] in ["created", "in_progress"]:
                    active_plans.append({
                        "id": plan_id,
                        "timestamp": plan["timestamp"],
                        "opportunity_count": plan["opportunity_count"],
                        "action_count": len(plan["actions"]),
                        "status": plan["status"]
                    })
                    
            return {
                "reflection_count": len(reflections),
                "reflection_types": reflection_types,
                "recent_reflections": [
                    {
                        "id": reflection["id"],
                        "task_id": reflection["task_id"],
                        "reflection_type": reflection["reflection_type"],
                        "timestamp": reflection["timestamp"]
                    }
                    for reflection in recent_reflections
                ],
                "active_plans": active_plans
            }
            
        except Exception as e:
            logging.error(f"Error generating reflection summary: {str(e)}")
            return {"reflection_count": 0, "error": str(e)} 