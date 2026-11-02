"""list_explorations: List all exploration canvases available in the investigation workspace.

Returns the list of exploration IDs, names, descriptions, and node counts.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from . import Context

DEFINITION = {
    "type": "function",
    "name": "list_explorations",
    "description": "List all exploration canvases available in the workspace. Returns exploration IDs, names, descriptions, and node counts so the AI knows which exploration to target.",
    "parameters": {
        "type": "object",
        "additionalProperties": False,
        "properties": {},
    },
}


def run(ctx: Context, args: dict) -> dict:
    try:
        explorations = ctx.workspace.list_explorations()
        return {"explorations": explorations}
    except Exception as err:
        return {"error": str(err)}
