import json
from typing import Tuple, List, Dict, Any

def validate_strategy(strategy: Dict[str, Any]) -> Tuple[bool, List[str]]:
    errors = []
    
    if not isinstance(strategy, dict):
        return False, ["Strategy must be a JSON object"]
    
    for section in ["gtm", "icp", "messagingPillars", "outreachAngles"]:
        if section not in strategy:
            errors.append(f"Missing required section: {section}")
    
    if "messagingPillars" in strategy:
        if not isinstance(strategy["messagingPillars"], list) or len(strategy["messagingPillars"]) == 0:
            errors.append("messagingPillars must be a non-empty array")
    
    if "outreachAngles" in strategy:
        if not isinstance(strategy["outreachAngles"], dict):
            errors.append("outreachAngles must be an object")
    
    if "icp" in strategy:
        icp = strategy["icp"]
        if isinstance(icp, dict) and "primary" in icp:
            primary = icp["primary"]
            if isinstance(primary, dict):
                for field in ["title", "painPoints", "goals"]:
                    if field not in primary:
                        errors.append(f"icp.primary missing required field: {field}")
    
    if "gtm" in strategy:
        gtm = strategy["gtm"]
        if isinstance(gtm, dict) and "positioning" not in gtm:
            errors.append("gtm missing required field: positioning")
    
    return len(errors) == 0, errors
