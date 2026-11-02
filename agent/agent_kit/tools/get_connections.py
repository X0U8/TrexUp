"""get_connections: Retrieve and inspect relationships connected to a node in an exploration canvas.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from . import Context

DEFINITION = {
    "type": "function",
    "name": "get_connections",
    "description": (
        "Retrieve connections and relationships connected to a specific node, "
        "or all connections on the exploration canvas. Supports filtering by direction (incoming, outgoing, both)."
    ),
    "parameters": {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "exploration_id": {
                "type": "string",
                "description": "The unique ID of the exploration canvas containing the connections.",
            },
            "node_id": {
                "type": "string",
                "description": "Optional node ID to inspect connections for. If omitted, returns all connections on the canvas.",
            },
            "direction": {
                "type": "string",
                "enum": ["both", "outgoing", "incoming"],
                "description": "Direction of connections to return relative to node_id (defaults to 'both').",
            },
        },
        "required": ["exploration_id"],
    },
}


def run(ctx: Context, args: dict) -> dict:
    exploration_id = str(args.get("exploration_id", "")).strip()
    if not exploration_id:
        return {"error": "exploration_id is required"}

    node_id = args.get("node_id")
    direction = str(args.get("direction", "both"))

    try:
        conns = ctx.workspace.get_connections(
            exploration_id=exploration_id,
            node_id=str(node_id) if node_id else None,
            direction=direction,
        )
        return {
            "success": True,
            "exploration_id": exploration_id,
            "node_id": node_id,
            "count": len(conns),
            "connections": conns,
        }
    except Exception as err:
        return {"error": str(err)}
