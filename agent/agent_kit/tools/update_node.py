"""update_node: Modify an existing node's title, description, or metadata in an exploration.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from . import Context

DEFINITION = {
    "type": "function",
    "name": "update_node",
    "description": "Modify an existing node's title, description, or metadata within a specified exploration canvas.",
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
                "description": "The unique ID of the node to update.",
            },
            "title": {
                "type": "string",
                "description": "New title for the node (optional).",
            },
            "description": {
                "type": "string",
                "description": "New detailed description for the node (optional).",
            },
            "metadata": {
                "type": "object",
                "description": "Additional or updated metadata to merge into the node (optional).",
            },
        },
        "required": ["exploration_id", "node_id"],
    },
}


def run(ctx: Context, args: dict) -> dict:
    exploration_id = str(args.get("exploration_id", "")).strip()
    node_id = str(args.get("node_id", "")).strip()

    if not exploration_id:
        return {"error": "exploration_id is required"}
    if not node_id:
        return {"error": "node_id is required"}

    title = args.get("title")
    description = args.get("description")
    metadata = args.get("metadata")

    if title is None and description is None and metadata is None:
        return {"error": "at least one of title, description, or metadata must be provided to update"}

    try:
        updated = ctx.workspace.update_node(
            exploration_id=exploration_id,
            node_id=node_id,
            title=str(title) if title is not None else None,
            description=str(description) if description is not None else None,
            metadata=metadata if isinstance(metadata, dict) else None,
        )
        return {"updated": True, "node": updated}
    except Exception as err:
        return {"error": str(err)}
