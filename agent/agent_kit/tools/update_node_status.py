"""update_node_status: Mark a node as proposed, under_review, verified, contradicted, or unresolved.

Requires a mandatory justification string and the target exploration_id.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from . import Context

DEFINITION = {
    "type": "function",
    "name": "update_node_status",
    "description": "Update the verification status of a node within an exploration canvas. A clear justification explaining what evidence or finding caused the status change is strictly required.",
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
                "description": "The unique ID of the node.",
            },
            "status": {
                "type": "string",
                "enum": ["proposed", "under_review", "verified", "contradicted", "unresolved"],
                "description": "The new verification status.",
            },
            "justification": {
                "type": "string",
                "description": "Mandatory explanation of why this node is now marked as this status (e.g. 'Verified by Table 2 in CALDERA-0434 showing thermal limits match').",
            },
        },
        "required": ["exploration_id", "node_id", "status", "justification"],
    },
}


def run(ctx: Context, args: dict) -> dict:
    exploration_id = str(args.get("exploration_id", "")).strip()
    node_id = str(args.get("node_id", "")).strip()
    status = str(args.get("status", "")).strip()
    justification = str(args.get("justification", "")).strip()

    if not exploration_id:
        return {"error": "exploration_id is required"}
    if not node_id:
        return {"error": "node_id is required"}
    if not status:
        return {"error": "status is required"}
    if not justification:
        return {"error": "justification is required: you must explain why the node status was changed"}

    try:
        res = ctx.workspace.update_node_status(
            exploration_id=exploration_id,
            node_id=node_id,
            status=status,
            justification=justification,
        )
        return {"updated": True, **res}
    except Exception as err:
        return {"error": str(err)}
