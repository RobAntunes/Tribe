from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional
from pydantic import BaseModel

class ToolMetadata(BaseModel):
    name: str
    description: str
    parameters: Dict[str, Any]
    return_type: str
    category: str
    created_by: Optional[str] = None
    version: str = "1.0.0"
    is_dynamic: bool = False

class BaseTool(ABC):
    def __init__(self):
        self.metadata = self._get_metadata()

    @abstractmethod
    def _get_metadata(self) -> ToolMetadata:
        """Return the tool's metadata"""
        pass

    @abstractmethod
    async def execute(self, **kwargs) -> Any:
        """Execute the tool with given parameters"""
        pass

    def to_dict(self) -> Dict[str, Any]:
        """Convert tool metadata to dictionary format for LLM consumption"""
        return {
            "name": self.metadata.name,
            "description": self.metadata.description,
            "parameters": self.metadata.parameters,
            "return_type": self.metadata.return_type,
            "category": self.metadata.category,
            "created_by": self.metadata.created_by,
            "version": self.metadata.version,
            "is_dynamic": self.metadata.is_dynamic
        }
