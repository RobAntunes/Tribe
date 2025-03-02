"""
Feedback System for Tribe
"""

from typing import Dict, Any, List, Optional, Union
import time
import logging
import json
import uuid

class FeedbackSystem:
    """Framework for collecting, analyzing, and applying feedback to improve agent performance."""
    
    def __init__(self):
        """Initialize the feedback system."""
        self.feedback_repository = {}
        self.feedback_metrics = {}
        self.feedback_patterns = {}
        
    def collect_feedback(self, source_id: str, target_id: str, 
                        feedback_type: str, content: Dict[str, Any],
                        metadata: Optional[Dict[str, Any]] = None) -> str:
        """
        Record feedback from one entity to another.
        
        Args:
            source_id (str): Identifier for feedback provider
            target_id (str): Identifier for feedback recipient
            feedback_type (str): Category of feedback (e.g., "performance", "output", "behavior")
            content (dict): Detailed feedback information
            metadata (dict, optional): Additional contextual information
            
        Returns:
            str: Feedback record identifier
        """
        feedback_id = f"feedback_{source_id}_{target_id}_{int(time.time())}"
        
        feedback_record = {
            "id": feedback_id,
            "source_id": source_id,
            "target_id": target_id,
            "feedback_type": feedback_type,
            "content": content,
            "metadata": metadata or {},
            "timestamp": time.time(),
            "processed": False
        }
        
        # Store in repository
        if target_id not in self.feedback_repository:
            self.feedback_repository[target_id] = []
            
        self.feedback_repository[target_id].append(feedback_record)
        
        # Log feedback collection
        logging.info(f"Collected feedback: {source_id} -> {target_id} ({feedback_type})")
        
        return feedback_id
        
    def analyze_feedback(self, target_id: str, 
                        feedback_types: Optional[List[str]] = None,
                        time_range: Optional[Dict[str, float]] = None) -> Dict[str, Any]:
        """
        Process collected feedback to identify patterns and insights.
        
        Args:
            target_id (str): Entity to analyze feedback for
            feedback_types (list, optional): Specific types of feedback to analyze
            time_range (dict, optional): Time period to consider (start_time, end_time)
            
        Returns:
            dict: Analysis results with patterns and recommendations
        """
        try:
            logging.info(f"Analyzing feedback for {target_id}")
            
            # Get feedback for target
            if target_id not in self.feedback_repository:
                logging.info(f"No feedback found for {target_id}")
                return {"patterns": [], "recommendations": [], "feedback_count": 0}
                
            feedback_items = self.feedback_repository[target_id]
            
            # Apply filters
            filtered_feedback = []
            
            for item in feedback_items:
                # Filter by feedback type
                if feedback_types and item["feedback_type"] not in feedback_types:
                    continue
                    
                # Filter by time range
                if time_range:
                    if "start_time" in time_range and item["timestamp"] < time_range["start_time"]:
                        continue
                    if "end_time" in time_range and item["timestamp"] > time_range["end_time"]:
                        continue
                        
                filtered_feedback.append(item)
                
            # If no feedback matches criteria, return empty result
            if not filtered_feedback:
                logging.info("No matching feedback found")
                return {"patterns": [], "recommendations": [], "feedback_count": 0}
                
            # Analyze feedback to find patterns
            patterns = self._identify_feedback_patterns(filtered_feedback)
            
            # Generate recommendations based on patterns
            recommendations = self._generate_recommendations(patterns, filtered_feedback)
            
            # Store analysis results
            analysis_id = f"analysis_{target_id}_{int(time.time())}"
            
            self.feedback_patterns[analysis_id] = {
                "id": analysis_id,
                "target_id": target_id,
                "timestamp": time.time(),
                "feedback_count": len(filtered_feedback),
                "patterns": patterns,
                "recommendations": recommendations
            }
            
            # Mark feedback as processed
            for item in filtered_feedback:
                item["processed"] = True
                
            return {
                "patterns": patterns,
                "recommendations": recommendations,
                "feedback_count": len(filtered_feedback)
            }
            
        except Exception as e:
            logging.error(f"Error analyzing feedback: {str(e)}")
            return {"patterns": [], "recommendations": [], "feedback_count": 0, "error": str(e)}
            
    def _identify_feedback_patterns(self, feedback_items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Identify patterns in feedback data."""
        # Group feedback by type
        feedback_by_type = {}
        
        for item in feedback_items:
            feedback_type = item["feedback_type"]
            
            if feedback_type not in feedback_by_type:
                feedback_by_type[feedback_type] = []
                
            feedback_by_type[feedback_type].append(item)
            
        # Identify patterns in each feedback type
        patterns = []
        
        for feedback_type, items in feedback_by_type.items():
            # Skip if too few items
            if len(items) < 2:
                continue
                
            # Analyze content for common themes
            content_themes = self._extract_content_themes(items)
            
            for theme, occurrences in content_themes.items():
                if len(occurrences) >= 2:  # At least 2 occurrences to form a pattern
                    patterns.append({
                        "type": "content_theme",
                        "feedback_type": feedback_type,
                        "theme": theme,
                        "frequency": len(occurrences),
                        "percentage": len(occurrences) / len(items) * 100,
                        "supporting_evidence": [item["id"] for item in occurrences]
                    })
                    
            # Analyze sentiment
            sentiment_counts = {"positive": 0, "neutral": 0, "negative": 0}
            
            for item in items:
                sentiment = self._determine_sentiment(item)
                sentiment_counts[sentiment] += 1
                
            # Add sentiment pattern if there's a clear trend
            max_sentiment = max(sentiment_counts, key=sentiment_counts.get)
            max_count = sentiment_counts[max_sentiment]
            
            if max_count >= len(items) * 0.6:  # At least 60% of items share sentiment
                patterns.append({
                    "type": "sentiment_trend",
                    "feedback_type": feedback_type,
                    "sentiment": max_sentiment,
                    "frequency": max_count,
                    "percentage": max_count / len(items) * 100
                })
                
            # Analyze timing patterns
            if len(items) >= 3:  # Need at least 3 items to detect timing patterns
                timing_pattern = self._analyze_timing(items)
                
                if timing_pattern:
                    patterns.append(timing_pattern)
                    
        return patterns
        
    def _extract_content_themes(self, feedback_items: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
        """Extract common themes from feedback content."""
        # This is a simplified implementation
        # In a real system, this would use NLP techniques for theme extraction
        
        themes = {}
        
        for item in feedback_items:
            content = item["content"]
            
            # Check for explicit themes/categories in content
            if "category" in content:
                theme = content["category"]
                
                if theme not in themes:
                    themes[theme] = []
                    
                themes[theme].append(item)
                continue
                
            # Check for themes in specific fields
            if "area" in content:
                theme = f"area:{content['area']}"
                
                if theme not in themes:
                    themes[theme] = []
                    
                themes[theme].append(item)
                continue
                
            # Check for themes in message content
            if "message" in content:
                # This is very simplified - would use NLP in real implementation
                message = content["message"].lower()
                
                # Check for common keywords
                keywords = ["performance", "quality", "speed", "accuracy", 
                           "communication", "creativity", "reliability"]
                
                for keyword in keywords:
                    if keyword in message:
                        theme = f"keyword:{keyword}"
                        
                        if theme not in themes:
                            themes[theme] = []
                            
                        themes[theme].append(item)
                        break
                        
        return themes
        
    def _determine_sentiment(self, feedback_item: Dict[str, Any]) -> str:
        """Determine sentiment of feedback (positive, neutral, negative)."""
        content = feedback_item["content"]
        
        # Check for explicit sentiment
        if "sentiment" in content:
            sentiment = content["sentiment"].lower()
            
            if sentiment in ["positive", "good", "excellent"]:
                return "positive"
            elif sentiment in ["negative", "bad", "poor"]:
                return "negative"
            else:
                return "neutral"
                
        # Check for rating
        if "rating" in content:
            rating = content["rating"]
            
            # Assume rating is on a scale (e.g., 1-5, 1-10)
            # This is a simplified approach
            if isinstance(rating, (int, float)):
                # For 1-5 scale
                if rating <= 5:
                    if rating >= 4:
                        return "positive"
                    elif rating <= 2:
                        return "negative"
                    else:
                        return "neutral"
                # For 1-10 scale
                else:
                    if rating >= 7:
                        return "positive"
                    elif rating <= 4:
                        return "negative"
                    else:
                        return "neutral"
                        
        # Check for sentiment in message
        if "message" in content:
            message = content["message"].lower()
            
            # Very simplified sentiment analysis
            positive_words = ["good", "great", "excellent", "impressive", "helpful", 
                             "effective", "efficient", "valuable", "useful"]
            negative_words = ["bad", "poor", "inadequate", "ineffective", "unhelpful", 
                             "disappointing", "frustrating", "confusing"]
            
            positive_count = sum(1 for word in positive_words if word in message)
            negative_count = sum(1 for word in negative_words if word in message)
            
            if positive_count > negative_count:
                return "positive"
            elif negative_count > positive_count:
                return "negative"
                
        # Default to neutral if no clear sentiment
        return "neutral"
        
    def _analyze_timing(self, feedback_items: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        """Analyze timing patterns in feedback."""
        # Sort by timestamp
        sorted_items = sorted(feedback_items, key=lambda x: x["timestamp"])
        
        # Calculate time differences between consecutive feedback
        time_diffs = []
        
        for i in range(1, len(sorted_items)):
            time_diff = sorted_items[i]["timestamp"] - sorted_items[i-1]["timestamp"]
            time_diffs.append(time_diff)
            
        # Calculate average and standard deviation
        if not time_diffs:
            return None
            
        avg_time_diff = sum(time_diffs) / len(time_diffs)
        
        # Check if feedback frequency is increasing or decreasing
        if len(time_diffs) >= 3:
            first_half = time_diffs[:len(time_diffs)//2]
            second_half = time_diffs[len(time_diffs)//2:]
            
            first_half_avg = sum(first_half) / len(first_half)
            second_half_avg = sum(second_half) / len(second_half)
            
            if second_half_avg < first_half_avg * 0.7:  # 30% faster feedback
                return {
                    "type": "timing_trend",
                    "trend": "increasing_frequency",
                    "first_period_avg": first_half_avg,
                    "second_period_avg": second_half_avg,
                    "change_percentage": (first_half_avg - second_half_avg) / first_half_avg * 100
                }
            elif second_half_avg > first_half_avg * 1.3:  # 30% slower feedback
                return {
                    "type": "timing_trend",
                    "trend": "decreasing_frequency",
                    "first_period_avg": first_half_avg,
                    "second_period_avg": second_half_avg,
                    "change_percentage": (second_half_avg - first_half_avg) / first_half_avg * 100
                }
                
        return None
        
    def _generate_recommendations(self, patterns: List[Dict[str, Any]], 
                                feedback_items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Generate recommendations based on feedback patterns."""
        recommendations = []
        
        # Process content theme patterns
        content_themes = [p for p in patterns if p["type"] == "content_theme"]
        
        for pattern in content_themes:
            theme = pattern["theme"]
            feedback_type = pattern["feedback_type"]
            
            # Generate recommendation based on theme and feedback type
            if pattern["sentiment"] if "sentiment" in pattern else "neutral" == "negative":
                recommendations.append({
                    "type": "improvement_area",
                    "area": theme.split(":", 1)[1] if ":" in theme else theme,
                    "feedback_type": feedback_type,
                    "priority": "high" if pattern["percentage"] > 70 else "medium",
                    "confidence": pattern["percentage"] / 100,
                    "suggestion": f"Address issues related to {theme.split(':', 1)[1] if ':' in theme else theme}"
                })
            elif pattern["sentiment"] if "sentiment" in pattern else "neutral" == "positive":
                recommendations.append({
                    "type": "strength",
                    "area": theme.split(":", 1)[1] if ":" in theme else theme,
                    "feedback_type": feedback_type,
                    "confidence": pattern["percentage"] / 100,
                    "suggestion": f"Leverage strength in {theme.split(':', 1)[1] if ':' in theme else theme}"
                })
                
        # Process sentiment trend patterns
        sentiment_trends = [p for p in patterns if p["type"] == "sentiment_trend"]
        
        for pattern in sentiment_trends:
            feedback_type = pattern["feedback_type"]
            sentiment = pattern["sentiment"]
            
            if sentiment == "negative":
                recommendations.append({
                    "type": "general_improvement",
                    "feedback_type": feedback_type,
                    "priority": "high" if pattern["percentage"] > 70 else "medium",
                    "confidence": pattern["percentage"] / 100,
                    "suggestion": f"Address overall negative feedback regarding {feedback_type}"
                })
            elif sentiment == "positive":
                recommendations.append({
                    "type": "general_strength",
                    "feedback_type": feedback_type,
                    "confidence": pattern["percentage"] / 100,
                    "suggestion": f"Maintain strong performance in {feedback_type}"
                })
                
        # Process timing trend patterns
        timing_trends = [p for p in patterns if p["type"] == "timing_trend"]
        
        for pattern in timing_trends:
            trend = pattern["trend"]
            
            if trend == "increasing_frequency":
                recommendations.append({
                    "type": "engagement_trend",
                    "trend": "increasing",
                    "confidence": 0.7,
                    "suggestion": "Feedback frequency is increasing, indicating higher engagement"
                })
            elif trend == "decreasing_frequency":
                recommendations.append({
                    "type": "engagement_trend",
                    "trend": "decreasing",
                    "priority": "medium",
                    "confidence": 0.7,
                    "suggestion": "Feedback frequency is decreasing, consider encouraging more feedback"
                })
                
        # Sort recommendations by priority and confidence
        recommendations.sort(key=lambda x: (
            0 if x.get("priority") == "high" else 1 if x.get("priority") == "medium" else 2,
            -x.get("confidence", 0)
        ))
        
        return recommendations
        
    def apply_feedback(self, agent: Any, feedback_analysis: Dict[str, Any]) -> bool:
        """
        Update agent behavior based on feedback analysis.
        
        Args:
            agent (Agent): Agent to update
            feedback_analysis (dict): Analysis results with patterns and recommendations
            
        Returns:
            bool: Success indicator
        """
        try:
            logging.info(f"Applying feedback to agent {agent.id if hasattr(agent, 'id') else 'unknown'}")
            
            # Get agent ID
            agent_id = agent.id if hasattr(agent, "id") else str(agent)
            
            # Ensure agent has feedback_insights attribute
            if not hasattr(agent, "feedback_insights"):
                agent.feedback_insights = {
                    "improvement_areas": [],
                    "strengths": [],
                    "recommendations": []
                }
                
            # Process recommendations
            if "recommendations" in feedback_analysis:
                for recommendation in feedback_analysis["recommendations"]:
                    rec_type = recommendation["type"]
                    
                    if rec_type in ["improvement_area", "general_improvement"]:
                        # Add to improvement areas if not already present
                        area = recommendation.get("area", recommendation.get("feedback_type", "general"))
                        
                        existing = [a for a in agent.feedback_insights["improvement_areas"] 
                                  if a["area"] == area]
                                  
                        if not existing:
                            agent.feedback_insights["improvement_areas"].append({
                                "area": area,
                                "priority": recommendation.get("priority", "medium"),
                                "confidence": recommendation.get("confidence", 0.5),
                                "suggestion": recommendation["suggestion"]
                            })
                        else:
                            # Update existing improvement area
                            existing[0]["confidence"] = max(existing[0]["confidence"], 
                                                         recommendation.get("confidence", 0.5))
                            if recommendation.get("priority") == "high":
                                existing[0]["priority"] = "high"
                                
                    elif rec_type in ["strength", "general_strength"]:
                        # Add to strengths if not already present
                        area = recommendation.get("area", recommendation.get("feedback_type", "general"))
                        
                        existing = [s for s in agent.feedback_insights["strengths"] 
                                  if s["area"] == area]
                                  
                        if not existing:
                            agent.feedback_insights["strengths"].append({
                                "area": area,
                                "confidence": recommendation.get("confidence", 0.5),
                                "suggestion": recommendation["suggestion"]
                            })
                        else:
                            # Update existing strength
                            existing[0]["confidence"] = max(existing[0]["confidence"], 
                                                         recommendation.get("confidence", 0.5))
                                                         
                    # Add all recommendations to the list
                    agent.feedback_insights["recommendations"].append(recommendation)
                    
            # Record feedback application
            application_id = f"application_{agent_id}_{int(time.time())}"
            
            self.feedback_metrics[application_id] = {
                "agent_id": agent_id,
                "timestamp": time.time(),
                "feedback_count": feedback_analysis.get("feedback_count", 0),
                "patterns_count": len(feedback_analysis.get("patterns", [])),
                "recommendations_count": len(feedback_analysis.get("recommendations", [])),
                "improvement_areas_count": len([r for r in feedback_analysis.get("recommendations", []) 
                                             if r["type"] in ["improvement_area", "general_improvement"]]),
                "strengths_count": len([r for r in feedback_analysis.get("recommendations", []) 
                                     if r["type"] in ["strength", "general_strength"]])
            }
            
            return True
            
        except Exception as e:
            logging.error(f"Error applying feedback: {str(e)}")
            return False
            
    def get_feedback_summary(self, target_id: str) -> Dict[str, Any]:
        """
        Generate a summary of all feedback for a target.
        
        Args:
            target_id (str): Entity to summarize feedback for
            
        Returns:
            dict: Summary statistics and insights
        """
        try:
            if target_id not in self.feedback_repository:
                return {
                    "feedback_count": 0,
                    "sentiment_distribution": {"positive": 0, "neutral": 0, "negative": 0},
                    "feedback_types": {},
                    "recent_feedback": []
                }
                
            feedback_items = self.feedback_repository[target_id]
            
            # Calculate sentiment distribution
            sentiment_counts = {"positive": 0, "neutral": 0, "negative": 0}
            
            for item in feedback_items:
                sentiment = self._determine_sentiment(item)
                sentiment_counts[sentiment] += 1
                
            # Count feedback by type
            feedback_types = {}
            
            for item in feedback_items:
                feedback_type = item["feedback_type"]
                feedback_types[feedback_type] = feedback_types.get(feedback_type, 0) + 1
                
            # Get recent feedback (last 5)
            recent_feedback = sorted(feedback_items, key=lambda x: x["timestamp"], reverse=True)[:5]
            
            # Calculate average sentiment over time
            if len(feedback_items) >= 5:
                # Group by time periods (e.g., weeks)
                period_size = 7 * 24 * 60 * 60  # 1 week in seconds
                earliest_time = min(item["timestamp"] for item in feedback_items)
                latest_time = max(item["timestamp"] for item in feedback_items)
                
                periods = {}
                
                for item in feedback_items:
                    period_index = int((item["timestamp"] - earliest_time) / period_size)
                    
                    if period_index not in periods:
                        periods[period_index] = {"count": 0, "positive": 0, "neutral": 0, "negative": 0}
                        
                    periods[period_index]["count"] += 1
                    sentiment = self._determine_sentiment(item)
                    periods[period_index][sentiment] += 1
                    
                sentiment_trend = [
                    {
                        "period": i,
                        "start_time": earliest_time + i * period_size,
                        "end_time": earliest_time + (i + 1) * period_size,
                        "count": periods[i]["count"],
                        "sentiment_distribution": {
                            "positive": periods[i]["positive"] / periods[i]["count"] if periods[i]["count"] > 0 else 0,
                            "neutral": periods[i]["neutral"] / periods[i]["count"] if periods[i]["count"] > 0 else 0,
                            "negative": periods[i]["negative"] / periods[i]["count"] if periods[i]["count"] > 0 else 0
                        }
                    }
                    for i in sorted(periods.keys())
                ]
            else:
                sentiment_trend = []
                
            return {
                "feedback_count": len(feedback_items),
                "sentiment_distribution": {
                    "positive": sentiment_counts["positive"] / len(feedback_items) if feedback_items else 0,
                    "neutral": sentiment_counts["neutral"] / len(feedback_items) if feedback_items else 0,
                    "negative": sentiment_counts["negative"] / len(feedback_items) if feedback_items else 0
                },
                "feedback_types": feedback_types,
                "recent_feedback": [
                    {
                        "id": item["id"],
                        "source_id": item["source_id"],
                        "feedback_type": item["feedback_type"],
                        "timestamp": item["timestamp"],
                        "sentiment": self._determine_sentiment(item)
                    }
                    for item in recent_feedback
                ],
                "sentiment_trend": sentiment_trend
            }
            
        except Exception as e:
            logging.error(f"Error generating feedback summary: {str(e)}")
            return {"feedback_count": 0, "error": str(e)} 