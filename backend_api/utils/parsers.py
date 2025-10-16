# backend_api/utils/parsers.py

import json
from typing import Any

def parse_if_json_string(value: Any) -> Any:
    """Tente de parser une chaîne de caractères en JSON. Si ça échoue, retourne la chaîne originale."""
    if isinstance(value, str):
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return value
    return value
