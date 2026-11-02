"""search_nodes: Search and discover existing nodes within a specified exploration canvas.

Allows the AI agent to search for existing nodes by keyword query (matching title, description, or id),
node type, or verification status. Returns node IDs, titles, types, and current status.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from . import Context

DEFINITION = {
    "type": "function",
    "name": "search_nodes",
    "description": (
        "Search and discover existing nodes in a specific exploration canvas by keyword query, title, or type. "
        "Returns node IDs and details. Use this to locate nodes before updating, connecting, or inspecting them."
    ),
    "parameters": {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "exploration_id": {
                "type": "string",
                "description": "The unique ID of the exploration canvas to search in (e.g. 'exploration_01').",
            },
            "query": {
                "type": "string",
                "description": "Optional keyword or title substring to search for (e.g. 'test', 'chamber', 'market').",
            },
            "node_type": {
                "type": "string",
                "enum": [
                    "topic",
                    "subtopic",
                    "claim",
                    "hypothesis",
                    "finding",
                    "evidence",
                    "document",
                    "open_question",
                ],
                "description": "Optional filter by node type.",
            },
            "status": {
                "type": "string",
                "enum": [
                    "proposed",
                    "under_review",
                    "verified",
                    "contradicted",
                    "unresolved",
                ],
                "description": "Optional filter by verification status.",
            },
        },
        "required": ["exploration_id"],
    },
}


def run(ctx: Context, args: dict) -> dict:
    exploration_id = str(args.get("exploration_id", "")).strip()
    if not exploration_id:
        return {"error": "exploration_id is required: you must specify which exploration canvas to search"}

    query = args.get("query")
    node_type = args.get("node_type")
    status = args.get("status")

    try:
        nodes = ctx.workspace.search_nodes(
            exploration_id=exploration_id,
            query=query,
            node_type=node_type,
            status=status,
        )
        return {
            "success": True,
            "exploration_id": exploration_id,
            "query": query or "",
            "count": len(nodes),
            "nodes": [
                {
                    "node_id": n.get("id"),
                    "title": n.get("title"),
                    "type": n.get("type"),
                    "status": n.get("status"),
                    "description": n.get("description", ""),
                }
                for n in nodes
            ],
        }
    except Exception as err:
        return {"error": str(err)}
