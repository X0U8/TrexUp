"""remove_connection: Remove a relationship between nodes by connection_id.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from . import Context

DEFINITION = {
    "type": "function",
    "name": "remove_connection",
    "description": "Disconnect and remove an existing relationship by connection_id from an exploration canvas.",
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
                "description": "The unique ID of the connection to remove (e.g. 'conn_4b2c1a').",
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

    try:
        res = ctx.workspace.remove_connection(
            exploration_id=exploration_id,
            connection_id=connection_id,
        )
        return {
            "success": True,
            "deleted": True,
            "exploration_id": exploration_id,
            "connection_id": connection_id,
        }
    except Exception as err:
        return {"error": str(err)}
