"""
Learning System for Tribe
"""

from typing import Dict, Any, List, Optional, Union
import time
import logging
import json
import uuid

class LearningSystem:
    """Framework for continuous improvement of agent performance and outputs."""
    
    def __init__(self, knowledge_repository: Optional[Dict[str, Any]] = None):
        """
        Initialize the learning system.
        
        Args:
            knowledge_repository (dict, optional): Existing knowledge repository
        """
        self.knowledge_repository = knowledge_repository or {}
        self.learning_patterns = {}
        self.improvement_metrics = {}
        
    def capture_experience(self, agent_id: str, context: Dict[str, Any], 
                          decision: str, outcome: Dict[str, Any], 
                          metadata: Optional[Dict[str, Any]] = None) -> str:
        """
        Record an agent's experience for future learning.
        
        Args:
            agent_id (str): Identifier for the agent
            context (dict): Situation details when decision was made
            decision (str): What the agent decided to do
            outcome (dict): Results of the decision
            metadata (dict): Additional relevant information
            
        Returns:
            str: Experience record identifier
        """
        experience_id = f"exp_{agent_id}_{int(time.time())}"
        
        experience_record = {
            "agent_id": agent_id,
            "timestamp": time.time(),
            "context": context,
            "decision": decision,
            "outcome": outcome,
            "metadata": metadata or {},
            "lessons_extracted": False
        }
        
        # Store in appropriate repository
        if agent_id not in self.knowledge_repository:
            self.knowledge_repository[agent_id] = []
        
        self.knowledge_repository[agent_id].append(experience_record)
        return experience_id
        
    def extract_patterns(self, agent_id: Optional[str] = None, 
                        topic: Optional[str] = None, 
                        outcome_type: Optional[str] = None) -> Dict[str, Any]:
        """
        Analyze experiences to identify recurring patterns.
        
        Args:
            agent_id (str, optional): Filter by specific agent
            topic (str, optional): Filter by subject area
            outcome_type (str, optional): Filter by result category
            
        Returns:
            dict: Identified patterns with supporting evidence
        """
        try:
            logging.info(f"Extracting patterns for agent_id={agent_id}, topic={topic}, outcome_type={outcome_type}")
            
            # Filter experiences based on criteria
            filtered_experiences = []
            
            for agent, experiences in self.knowledge_repository.items():
                if agent_id and agent != agent_id:
                    continue
                    
                for exp in experiences:
                    # Check topic if specified
                    if topic and not self._matches_topic(exp, topic):
                        continue
                        
                    # Check outcome type if specified
                    if outcome_type and not self._matches_outcome_type(exp, outcome_type):
                        continue
                        
                    filtered_experiences.append(exp)
            
            # If no experiences match criteria, return empty result
            if not filtered_experiences:
                logging.info("No matching experiences found")
                return {"patterns": [], "confidence": 0.0}
                
            # Analyze experiences to find patterns
            patterns = self._analyze_experiences(filtered_experiences)
            
            # Store patterns for future reference
            pattern_id = f"pattern_{uuid.uuid4()}"
            self.learning_patterns[pattern_id] = {
                "id": pattern_id,
                "agent_id": agent_id,
                "topic": topic,
                "outcome_type": outcome_type,
                "timestamp": time.time(),
                "patterns": patterns,
                "experience_count": len(filtered_experiences)
            }
            
            return {
                "patterns": patterns,
                "experience_count": len(filtered_experiences),
                "confidence": self._calculate_confidence(patterns, filtered_experiences)
            }
            
        except Exception as e:
            logging.error(f"Error extracting patterns: {str(e)}")
            return {"patterns": [], "confidence": 0.0, "error": str(e)}
            
    def _matches_topic(self, experience: Dict[str, Any], topic: str) -> bool:
        """Check if experience matches the specified topic."""
        # Check context for topic
        if "topic" in experience["context"] and experience["context"]["topic"] == topic:
            return True
            
        # Check metadata for topic
        if "topic" in experience["metadata"] and experience["metadata"]["topic"] == topic:
            return True
            
        # Check if topic appears in decision or outcome
        if topic.lower() in experience["decision"].lower():
            return True
            
        if "description" in experience["outcome"] and topic.lower() in experience["outcome"]["description"].lower():
            return True
            
        return False
        
    def _matches_outcome_type(self, experience: Dict[str, Any], outcome_type: str) -> bool:
        """Check if experience matches the specified outcome type."""
        # Check if outcome has a type field
        if "type" in experience["outcome"] and experience["outcome"]["type"] == outcome_type:
            return True
            
        # Check if outcome has a result field
        if "result" in experience["outcome"] and experience["outcome"]["result"] == outcome_type:
            return True
            
        return False
        
    def _analyze_experiences(self, experiences: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Analyze experiences to identify patterns."""
        # This is a simplified implementation
        # In a real system, this would use more sophisticated pattern recognition
        
        # Group experiences by context similarity
        context_groups = {}
        
        for exp in experiences:
            # Create a simplified context key for grouping
            context_key = self._create_context_key(exp["context"])
            
            if context_key not in context_groups:
                context_groups[context_key] = []
                
            context_groups[context_key].append(exp)
            
        # Identify patterns in each group
        patterns = []
        
        for context_key, group in context_groups.items():
            if len(group) < 2:
                continue  # Need at least 2 experiences to form a pattern
                
            # Check for similar decisions
            decision_counts = {}
            for exp in group:
                decision = exp["decision"]
                decision_counts[decision] = decision_counts.get(decision, 0) + 1
                
            # Check for similar outcomes
            outcome_counts = {}
            for exp in group:
                outcome_key = self._create_outcome_key(exp["outcome"])
                outcome_counts[outcome_key] = outcome_counts.get(outcome_key, 0) + 1
                
            # Create patterns for frequent decisions and outcomes
            for decision, count in decision_counts.items():
                if count >= 2:  # At least 2 occurrences
                    patterns.append({
                        "type": "decision_pattern",
                        "context": context_key,
                        "decision": decision,
                        "frequency": count,
                        "total_experiences": len(group),
                        "supporting_evidence": [exp["experience_id"] if "experience_id" in exp else i 
                                              for i, exp in enumerate(group) 
                                              if exp["decision"] == decision]
                    })
                    
            for outcome_key, count in outcome_counts.items():
                if count >= 2:  # At least 2 occurrences
                    patterns.append({
                        "type": "outcome_pattern",
                        "context": context_key,
                        "outcome": outcome_key,
                        "frequency": count,
                        "total_experiences": len(group),
                        "supporting_evidence": [exp["experience_id"] if "experience_id" in exp else i 
                                              for i, exp in enumerate(group) 
                                              if self._create_outcome_key(exp["outcome"]) == outcome_key]
                    })
                    
        return patterns
        
    def _create_context_key(self, context: Dict[str, Any]) -> str:
        """Create a simplified key for context grouping."""
        # This is a simplified implementation
        # In a real system, this would use more sophisticated context analysis
        
        key_parts = []
        
        # Extract key elements from context
        if "task_type" in context:
            key_parts.append(f"task:{context['task_type']}")
            
        if "domain" in context:
            key_parts.append(f"domain:{context['domain']}")
            
        if "complexity" in context:
            key_parts.append(f"complexity:{context['complexity']}")
            
        if not key_parts:
            # If no structured fields, use a hash of the context
            return f"context_hash:{hash(json.dumps(context, sort_keys=True))}"
            
        return "|".join(key_parts)
        
    def _create_outcome_key(self, outcome: Dict[str, Any]) -> str:
        """Create a simplified key for outcome grouping."""
        # This is a simplified implementation
        # In a real system, this would use more sophisticated outcome analysis
        
        if "result" in outcome:
            return f"result:{outcome['result']}"
            
        if "status" in outcome:
            return f"status:{outcome['status']}"
            
        # If no structured fields, use a hash of the outcome
        return f"outcome_hash:{hash(json.dumps(outcome, sort_keys=True))}"
        
    def _calculate_confidence(self, patterns: List[Dict[str, Any]], 
                             experiences: List[Dict[str, Any]]) -> float:
        """Calculate confidence level for identified patterns."""
        if not patterns or not experiences:
            return 0.0
            
        # Calculate average frequency across patterns
        total_frequency = sum(p["frequency"] for p in patterns)
        avg_frequency = total_frequency / len(patterns)
        
        # Calculate coverage (what percentage of experiences are covered by patterns)
        covered_experiences = set()
        for pattern in patterns:
            covered_experiences.update(pattern["supporting_evidence"])
            
        coverage = len(covered_experiences) / len(experiences)
        
        # Combine frequency and coverage for confidence score
        confidence = (avg_frequency / len(experiences) + coverage) / 2
        
        return min(confidence, 1.0)  # Cap at 1.0
        
    def apply_learning(self, agent: Any, context: Dict[str, Any], 
                      available_experiences: Optional[List[str]] = None) -> Dict[str, Any]:
        """
        Leverage past experiences to improve current decisions.
        
        Args:
            agent (Agent): Agent making a decision
            context (dict): Current situation details
            available_experiences (list, optional): Specific experiences to consider
            
        Returns:
            dict: Recommendations based on past learning
        """
        try:
            logging.info(f"Applying learning for agent {agent.id if hasattr(agent, 'id') else 'unknown'}")
            
            # Get agent ID
            agent_id = agent.id if hasattr(agent, "id") else str(agent)
            
            # Filter experiences to consider
            experiences_to_consider = []
            
            if available_experiences:
                # Use specified experiences
                for agent_id, experiences in self.knowledge_repository.items():
                    for exp in experiences:
                        exp_id = exp.get("experience_id", "")
                        if exp_id in available_experiences:
                            experiences_to_consider.append(exp)
            else:
                # Use all experiences for this agent
                if agent_id in self.knowledge_repository:
                    experiences_to_consider = self.knowledge_repository[agent_id]
                    
            # If no experiences to consider, return empty recommendations
            if not experiences_to_consider:
                logging.info("No experiences available for learning")
                return {"recommendations": [], "confidence": 0.0}
                
            # Find experiences with similar context
            similar_experiences = self._find_similar_experiences(context, experiences_to_consider)
            
            # If no similar experiences, return empty recommendations
            if not similar_experiences:
                logging.info("No similar experiences found")
                return {"recommendations": [], "confidence": 0.0}
                
            # Generate recommendations based on similar experiences
            recommendations = self._generate_recommendations(similar_experiences)
            
            return {
                "recommendations": recommendations,
                "similar_experiences": len(similar_experiences),
                "confidence": self._calculate_recommendation_confidence(recommendations, similar_experiences)
            }
            
        except Exception as e:
            logging.error(f"Error applying learning: {str(e)}")
            return {"recommendations": [], "confidence": 0.0, "error": str(e)}
            
    def _find_similar_experiences(self, context: Dict[str, Any], 
                                experiences: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Find experiences with similar context."""
        # This is a simplified implementation
        # In a real system, this would use more sophisticated similarity metrics
        
        similar_experiences = []
        
        for exp in experiences:
            similarity_score = self._calculate_context_similarity(context, exp["context"])
            
            if similarity_score > 0.7:  # Threshold for similarity
                similar_experiences.append({
                    "experience": exp,
                    "similarity": similarity_score
                })
                
        # Sort by similarity (most similar first)
        similar_experiences.sort(key=lambda x: x["similarity"], reverse=True)
        
        return similar_experiences
        
    def _calculate_context_similarity(self, context1: Dict[str, Any], 
                                    context2: Dict[str, Any]) -> float:
        """Calculate similarity between two contexts."""
        # This is a simplified implementation
        # In a real system, this would use more sophisticated similarity metrics
        
        # Count matching keys and values
        matching_keys = set(context1.keys()) & set(context2.keys())
        
        if not matching_keys:
            return 0.0
            
        matching_values = sum(1 for k in matching_keys if context1[k] == context2[k])
        
        # Calculate similarity score
        total_keys = len(set(context1.keys()) | set(context2.keys()))
        
        if total_keys == 0:
            return 0.0
            
        return (matching_keys + matching_values) / (total_keys * 2)
        
    def _generate_recommendations(self, similar_experiences: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Generate recommendations based on similar experiences."""
        # Group by decisions
        decision_outcomes = {}
        
        for item in similar_experiences:
            exp = item["experience"]
            decision = exp["decision"]
            
            if decision not in decision_outcomes:
                decision_outcomes[decision] = []
                
            decision_outcomes[decision].append({
                "outcome": exp["outcome"],
                "similarity": item["similarity"]
            })
            
        # Generate recommendations based on successful outcomes
        recommendations = []
        
        for decision, outcomes in decision_outcomes.items():
            # Calculate success rate for this decision
            success_count = sum(1 for o in outcomes if self._is_successful_outcome(o["outcome"]))
            success_rate = success_count / len(outcomes) if outcomes else 0
            
            # Calculate weighted score based on similarity and success
            weighted_score = sum(o["similarity"] * (1 if self._is_successful_outcome(o["outcome"]) else 0) 
                               for o in outcomes) / len(outcomes) if outcomes else 0
            
            recommendations.append({
                "decision": decision,
                "success_rate": success_rate,
                "sample_size": len(outcomes),
                "weighted_score": weighted_score,
                "supporting_evidence": len(outcomes)
            })
            
        # Sort by weighted score (best first)
        recommendations.sort(key=lambda x: x["weighted_score"], reverse=True)
        
        return recommendations
        
    def _is_successful_outcome(self, outcome: Dict[str, Any]) -> bool:
        """Determine if an outcome was successful."""
        # Check for explicit success indicator
        if "success" in outcome:
            return outcome["success"]
            
        # Check for status indicator
        if "status" in outcome:
            return outcome["status"] in ["success", "completed", "positive"]
            
        # Check for result indicator
        if "result" in outcome:
            return outcome["result"] in ["success", "completed", "positive"]
            
        # Default to neutral (not clearly successful or unsuccessful)
        return False
        
    def _calculate_recommendation_confidence(self, recommendations: List[Dict[str, Any]], 
                                           similar_experiences: List[Dict[str, Any]]) -> float:
        """Calculate confidence level for recommendations."""
        if not recommendations or not similar_experiences:
            return 0.0
            
        # Calculate average sample size
        avg_sample_size = sum(r["sample_size"] for r in recommendations) / len(recommendations)
        
        # Calculate average similarity
        avg_similarity = sum(exp["similarity"] for exp in similar_experiences) / len(similar_experiences)
        
        # Combine factors for confidence score
        confidence = (avg_sample_size / 10) * 0.5 + avg_similarity * 0.5
        
        return min(confidence, 1.0)  # Cap at 1.0
        
    def update_agent_model(self, agent: Any, new_insights: Dict[str, Any]) -> bool:
        """
        Evolve an agent's decision-making based on accumulated learning.
        
        Args:
            agent (Agent): Agent to update
            new_insights (dict): Learned patterns to incorporate
            
        Returns:
            bool: Success indicator
        """
        try:
            logging.info(f"Updating agent model for {agent.id if hasattr(agent, 'id') else 'unknown'}")
            
            # Get agent ID
            agent_id = agent.id if hasattr(agent, "id") else str(agent)
            
            # Store insights in agent's knowledge base
            if not hasattr(agent, "knowledge_base"):
                agent.knowledge_base = {}
                
            if "patterns" not in agent.knowledge_base:
                agent.knowledge_base["patterns"] = []
                
            if "recommendations" not in agent.knowledge_base:
                agent.knowledge_base["recommendations"] = []
                
            # Add new patterns
            if "patterns" in new_insights:
                agent.knowledge_base["patterns"].extend(new_insights["patterns"])
                
            # Add new recommendations
            if "recommendations" in new_insights:
                agent.knowledge_base["recommendations"].extend(new_insights["recommendations"])
                
            # Record update in improvement metrics
            update_id = f"update_{agent_id}_{int(time.time())}"
            
            self.improvement_metrics[update_id] = {
                "agent_id": agent_id,
                "timestamp": time.time(),
                "insights_added": {
                    "patterns": len(new_insights.get("patterns", [])),
                    "recommendations": len(new_insights.get("recommendations", []))
                },
                "current_knowledge_base_size": {
                    "patterns": len(agent.knowledge_base["patterns"]),
                    "recommendations": len(agent.knowledge_base["recommendations"])
                }
            }
            
            return True
            
        except Exception as e:
            logging.error(f"Error updating agent model: {str(e)}")
            return False 