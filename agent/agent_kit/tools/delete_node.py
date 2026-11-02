"""delete_node: Remove a node from a specified exploration canvas.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from . import Context

DEFINITION = {
    "type": "function",
    "name": "delete_node",
    "description": "Delete one or more nodes from a specific exploration canvas. Can delete a single node by node_id, multiple nodes by node_ids array, or all nodes by setting node_id: 'all' or delete_all: true.",
    "parameters": {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "exploration_id": {
                "type": "string",
                "description": "The unique ID of the exploration canvas containing the node(s).",
            },
            "node_id": {
                "type": "string",
                "description": "The unique ID of the node to delete, or 'all' to delete all nodes.",
            },
            "node_ids": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Optional list of node IDs to delete in batch.",
            },
            "delete_all": {
                "type": "boolean",
                "description": "Set to true to delete all nodes in this exploration.",
            },
            "cascade_connections": {
                "type": "boolean",
                "description": "Whether to automatically remove all connections linked to these nodes (default: true).",
            },
        },
        "required": ["exploration_id"],
    },
}


def run(ctx: Context, args: dict) -> dict:
    exploration_id = str(args.get("exploration_id", "")).strip()
    node_id = str(args.get("node_id", "")).strip() if args.get("node_id") else None
    node_ids = args.get("node_ids") if isinstance(args.get("node_ids"), list) else None
    delete_all = bool(args.get("delete_all", False))
    cascade = args.get("cascade_connections", True)

    if not exploration_id:
        return {"error": "exploration_id is required"}

    try:
        res = ctx.workspace.delete_node(
            exploration_id=exploration_id,
            node_id=node_id,
            node_ids=node_ids,
            delete_all=delete_all,
            cascade_connections=bool(cascade),
        )
        return res
    except Exception as err:
        return {"error": str(err)}
