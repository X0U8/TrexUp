"""update_connection: Change relationship type or reasoning description for an existing connection.
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
    "name": "update_connection",
    "description": (
        "Modify an existing connection's relationship type or justification description "
        "within a specified exploration canvas."
    ),
    "parameters": {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "exploration_id": {
                "type": "string",
                "description": "The unique ID of the exploration canvas containing the connection.",
            },
            "connection_id": {
                "type": "string",
                "description": "The unique ID of the connection to update (e.g. 'conn_4b2c1a').",
            },
            "relationship_type": {
                "type": "string",
                "enum": RELATIONSHIP_TYPES,
                "description": "New relationship type.",
            },
            "description": {
                "type": "string",
                "description": "Updated reasoning explanation for the connection.",
            },
            "metadata": {
                "type": "object",
                "description": "Additional metadata to merge into the connection.",
            },
        },
        "required": ["exploration_id", "connection_id"],
    },
}


def run(ctx: Context, args: dict) -> dict:
    exploration_id = str(args.get("exploration_id", "")).strip()
    connection_id = str(args.get("connection_id", "")).strip()

    if not exploration_id:
        return {"error": "exploration_id is required"}
    if not connection_id:
        return {"error": "connection_id is required"}

    rel_type = args.get("relationship_type")
    description = args.get("description")
    metadata = args.get("metadata")

    try:
        updated = ctx.workspace.update_connection(
            exploration_id=exploration_id,
            connection_id=connection_id,
            relationship_type=str(rel_type) if rel_type else None,
            description=str(description) if description else None,
            metadata=metadata if isinstance(metadata, dict) else None,
        )
        return {
            "success": True,
            "updated": True,
            "exploration_id": exploration_id,
            "connection": updated,
        }
    except Exception as err:
        return {"error": str(err)}
