from dataclasses import dataclass, field
from typing import Optional, Dict, Any, List

@dataclass
class StrategyState:
    user_input: Dict[str, Any] = field(default_factory=dict)
    research_output: Optional[Dict] = None
    business_analysis: Optional[Dict] = None
    competitor_analysis: Optional[Dict] = None
    messaging_strategy: Optional[Dict] = None
    review_feedback: Optional[Dict] = None
    final_strategy: Optional[Dict] = None
    errors: List[Dict] = field(default_factory=list)
    retry_count: int = 0
