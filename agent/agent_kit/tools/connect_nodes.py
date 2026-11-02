"""connect_nodes: Create a relationship between two or more nodes in a specified exploration canvas.

Supports connecting a source node to one or multiple target nodes at once (batch mode).
A clear description explaining the reasoning for the connection is strictly required.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from . import Context

RELATIONSHIP_TYPES = [
    "supports",
    "refutes",
    "caused_by",
    "related_to",
    "derives_from",
    "evidences",
    "depends_on",
    "contradicts",
]

DEFINITION = {
    "type": "function",
    "name": "connect_nodes",
    "description": (
        "Create a relationship between nodes in an exploration canvas. "
        "Supports connecting a source node to one or multiple target nodes at once. "
        "A clear description justifying the reasoning for the connection is strictly required."
    ),
    "parameters": {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "exploration_id": {
                "type": "string",
                "description": "The unique ID of the exploration canvas containing the nodes (e.g. 'exploration_01').",
            },
            "source_node_id": {
                "type": "string",
                "description": "The unique ID of the source node from which the relationship originates.",
            },
            "target_node_ids": {
                "type": "array",
                "items": {"type": "string"},
                "description": "A list of target node IDs to connect to simultaneously (e.g. ['node_find_4a2c', 'node_hypo_91ef']).",
            },
            "target_node_id": {
                "type": "string",
                "description": "Alternative single target node ID (use target_node_ids for connecting multiple at once).",
            },
            "relationship_type": {
                "type": "string",
                "enum": RELATIONSHIP_TYPES,
                "description": "The semantic relationship type (defaults to 'related_to').",
            },
            "description": {
                "type": "string",
                "description": "Mandatory explanation and reasoning for why these nodes are connected.",
            },
            "metadata": {
                "type": "object",
                "description": "Optional arbitrary metadata.",
            },
        },
        "required": ["exploration_id", "source_node_id", "description"],
    },
}


def run(ctx: Context, args: dict) -> dict:
    exploration_id = str(args.get("exploration_id", "")).strip()
    source_node_id = str(args.get("source_node_id", "")).strip()
    description = str(args.get("description", "")).strip()
    rel_type = str(args.get("relationship_type", "related_to"))
    metadata = args.get("metadata") if isinstance(args.get("metadata"), dict) else {}

    if not exploration_id:
        return {"error": "exploration_id is required"}
    if not source_node_id:
        return {"error": "source_node_id is required"}
    if not description:
        return {"error": "description is required: you must explain the reasoning for connecting these nodes"}

    targets = args.get("target_node_ids") or []
    if isinstance(targets, str):
        targets = [targets]
    if not targets and args.get("target_node_id"):
        targets = [str(args.get("target_node_id"))]

    if not targets:
        return {"error": "target_node_ids or target_node_id is required"}

    try:
        created = ctx.workspace.connect_nodes(
            exploration_id=exploration_id,
            source_node_id=source_node_id,
            target_node_ids=targets,
            relationship_type=rel_type,
            description=description,
            metadata=metadata,
        )
        return {
            "success": True,
            "connected": True,
            "exploration_id": exploration_id,
            "source_node_id": source_node_id,
            "connections": created,
            "count": len(created),
        }
    except Exception as err:
        return {"error": str(err)}
