"""create_node: Create a topic, subtopic, claim, hypothesis, finding, evidence or document in a specified exploration.

Returns the created node object with its assigned unique node_id.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from . import Context

DEFINITION = {
    "type": "function",
    "name": "create_node",
    "description": "Create a new topic, subtopic, claim, hypothesis, finding, evidence, or document node in a specific exploration canvas. The exploration_id, title, and description are required.",
    "parameters": {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "exploration_id": {
                "type": "string",
                "description": "The unique ID of the exploration canvas to create this node in (e.g. 'exploration_01', 'exp_01').",
            },
            "title": {
                "type": "string",
                "description": "Short, clear title summarizing the node (e.g. 'Chamber Seal Failure at 420K').",
            },
            "description": {
                "type": "string",
                "description": "Detailed explanation of the observation, claim, or hypothesis.",
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
                "description": "The category/type of the node.",
            },
            "status": {
                "type": "string",
                "enum": ["proposed", "under_review", "verified", "contradicted", "unresolved"],
                "description": "Initial status of the node (defaults to 'proposed').",
            },
            "metadata": {
                "type": "object",
                "description": "Optional arbitrary metadata (e.g. source document, page, tags, confidence).",
            },
        },
        "required": ["exploration_id", "title", "description", "node_type"],
    },
}


def run(ctx: Context, args: dict) -> dict:
    exploration_id = str(args.get("exploration_id", "")).strip()
    if not exploration_id:
        return {"error": "exploration_id is required: you must specify which exploration to add this node to"}

    try:
        node = ctx.workspace.create_node(
            exploration_id=exploration_id,
            title=str(args.get("title", "")),
            description=str(args.get("description", "")),
            node_type=str(args.get("node_type", "finding")),
            status=str(args.get("status", "proposed")),
            metadata=args.get("metadata") if isinstance(args.get("metadata"), dict) else {},
        )
        return {"created": True, "node": node}
    except Exception as err:
        return {"error": str(err)}
