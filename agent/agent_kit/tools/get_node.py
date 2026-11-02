"""get_node: Retrieve an existing node and all its details from a specified exploration canvas.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from . import Context

DEFINITION = {
    "type": "function",
    "name": "get_node",
    "description": "Retrieve an existing node by its unique node_id from a specified exploration canvas.",
    "parameters": {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "exploration_id": {
                "type": "string",
                "description": "The unique ID of the exploration canvas containing the node.",
            },
            "node_id": {
                "type": "string",
                "description": "The unique ID of the node to retrieve (e.g. 'node_find_4a2c', 'node_doc_e722').",
            },
        },
        "required": ["exploration_id", "node_id"],
    },
}


def run(ctx: Context, args: dict) -> dict:
    exploration_id = str(args.get("exploration_id", "")).strip()
    node_id = str(args.get("node_id", "")).strip()

    if not exploration_id:
        return {"error": "exploration_id is required: you must specify which exploration to query"}
    if not node_id:
        return {"error": "node_id is required"}

    try:
        node = ctx.workspace.get_node(exploration_id, node_id)
        return {"node": node}
    except Exception as err:
        return {"error": str(err)}
