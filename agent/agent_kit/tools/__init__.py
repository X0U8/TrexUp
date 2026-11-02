"""The investigation workspace tools, following the exact Meta project pattern.

One file per tool: its DEFINITION (what the model sees) and run(ctx, args)
(what happens when the model calls it).
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from ..workspace_record import WorkspaceRecord
from . import (
    connect_nodes,
    create_node,
    delete_node,
    get_connections,
    get_node,
    list_explorations,
    remove_connection,
    search_nodes,
    update_connection,
    update_node,
    update_node_status,
)

BASE_TOOLS = [
    "list_explorations",
    "search_nodes",
    "create_node",
    "get_node",
    "update_node",
    "update_node_status",
    "delete_node",
    "connect_nodes",
    "get_connections",
    "update_connection",
    "remove_connection",
]

MODULES: dict[str, Any] = {
    str(m.DEFINITION["name"]): m
    for m in (
        list_explorations,
        search_nodes,
        create_node,
        get_node,
        update_node,
        update_node_status,
        delete_node,
        connect_nodes,
        get_connections,
        update_connection,
        remove_connection,
    )
}

DEFINITIONS: dict[str, dict] = {
    name: module.DEFINITION for name, module in MODULES.items()
}


@dataclass
class Context:
    """Context passed to every tool execution."""

    root: Path
    investigation_id: str
    workspace: WorkspaceRecord
    client: Any = None


def names() -> list[str]:
    return list(BASE_TOOLS)


def definitions() -> list[dict]:
    """The tool definitions to offer the model in this workspace."""
    return [DEFINITIONS[name] for name in names()]


def run(root: Path, investigation_id: str, call: Any, client: Any = None) -> dict:
    """Run the tool the model chose."""
    name = _field(call, "name")
    raw = _field(call, "arguments") or "{}"

    try:
        args = json.loads(raw) if isinstance(raw, str) else dict(raw)
    except (TypeError, ValueError) as error:
        return {"error": f"tool arguments are not valid JSON: {error}"}

    if not isinstance(args, dict):
        return {"error": "tool arguments must be a JSON object"}

    if name not in names():
        return {"error": f"unknown tool: {name!r}"}

    root_path = Path(root)
    workspace = WorkspaceRecord(root_path, investigation_id)
    ctx = Context(root=root_path, investigation_id=investigation_id, workspace=workspace, client=client)

    try:
        result = MODULES[name].run(ctx, args)
    except Exception as error:
        return {"error": str(error) or type(error).__name__}

    return result if isinstance(result, dict) else {"result": result}


def _field(call: Any, key: str) -> Any:
    return call.get(key) if isinstance(call, dict) else getattr(call, key, None)
