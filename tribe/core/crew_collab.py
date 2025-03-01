from enum import Enum

class CollaborationMode(Enum):
    """Enum for different collaboration modes between crew members."""
    SEQUENTIAL = "sequential"  # Agents work one after another
    PARALLEL = "parallel"      # Agents work simultaneously
    HYBRID = "hybrid"         # Mix of sequential and parallel work
