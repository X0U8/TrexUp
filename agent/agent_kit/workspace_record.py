"""The investigation workspace record: the underlying graph and state system the agent acts on.

Stored as JSON at workspace/investigations/<investigation_id>.json.
Tracks explorations, nodes within each exploration, connections, and an append-only audit log.
"""

from __future__ import annotations

import json
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

NODE_TYPES = ("topic", "subtopic", "claim", "hypothesis", "finding", "evidence", "document", "open_question")
NODE_STATUSES = ("proposed", "under_review", "verified", "contradicted", "unresolved")

NODE_ID_PATTERN = re.compile(r"^[a-zA-Z0-9_-]{3,64}$")


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class WorkspaceError(ValueError):
    """An error indicating a tool operation was refused. Safe to show the model."""


class WorkspaceRecord:
    def __init__(self, root: Path, investigation_id: str) -> None:
        self.root = Path(root)
        self.investigation_id = investigation_id
        self.path = self.root / "workspace/investigations" / f"{investigation_id}.json"
        if self.path.is_file():
            self.data: dict[str, Any] = json.loads(self.path.read_text(encoding="utf-8"))
            # Ensure explorations structure exists for backwards compatibility
            if "explorations" not in self.data:
                default_nodes = self.data.get("nodes", {})
                default_conns = self.data.get("connections", {})
                self.data["explorations"] = {
                    "exploration_01": {
                        "id": "exploration_01",
                        "name": "exploration_01",
                        "description": "Default exploration canvas",
                        "created_at": now_iso(),
                        "nodes": default_nodes,
                        "connections": default_conns,
                    }
                }
                self.data["current_exploration_id"] = "exploration_01"
        else:
            self.path.parent.mkdir(parents=True, exist_ok=True)
            self.data = {
                "investigation_id": investigation_id,
                "created": now_iso(),
                "updated": now_iso(),
                "current_exploration_id": "exploration_01",
                "explorations": {
                    "exploration_01": {
                        "id": "exploration_01",
                        "name": "exploration_01",
                        "description": "Initial exploration canvas",
                        "created_at": now_iso(),
                        "nodes": {},
                        "connections": {},
                    }
                },
                "groups": {},
                "audit": [],
            }
            self._save("created", {"investigation_id": investigation_id})

    def _save(self, action: str, details: dict) -> None:
        self.data["updated"] = now_iso()
        self.data["audit"].append({
            "timestamp": now_iso(),
            "action": action,
            "details": details,
        })
        self.path.write_text(json.dumps(self.data, indent=2), encoding="utf-8")

    # --- Exploration Operations ---

    def list_explorations(self) -> list[dict]:
        res = []
        for exp_id, exp in self.data.get("explorations", {}).items():
            res.append({
                "exploration_id": exp_id,
                "name": exp.get("name", exp_id),
                "description": exp.get("description", ""),
                "node_count": len(exp.get("nodes", {})),
                "connection_count": len(exp.get("connections", {})),
                "created_at": exp.get("created_at", ""),
            })
        return res

    def get_exploration(self, exploration_id: str) -> dict:
        exp_id = (exploration_id or "").strip()
        if not exp_id:
            available = list(self.data.get("explorations", {}).keys())
            raise WorkspaceError(f"exploration_id is required. Available explorations: {available}")
        explorations = self.data.get("explorations", {})
        if exp_id not in explorations:
            available = list(explorations.keys())
            raise WorkspaceError(f"Exploration with ID '{exp_id}' does not exist. Available: {available}")
        return explorations[exp_id]

    def create_exploration(self, name: str | None = None, description: str = "") -> dict:
        explorations = self.data.setdefault("explorations", {})
        next_num = len(explorations) + 1
        default_id = f"exploration_{next_num:02d}"
        exp_id = default_id
        exp_name = (name or "").strip() or default_id

        if exp_id in explorations:
            exp_id = f"exp_{uuid.uuid4().hex[:6]}"

        new_exp = {
            "id": exp_id,
            "name": exp_name,
            "description": description.strip(),
            "created_at": now_iso(),
            "nodes": {},
            "connections": {},
        }
        explorations[exp_id] = new_exp
        self._save("create_exploration", {"exploration_id": exp_id, "name": exp_name})
        return {
            "exploration_id": exp_id,
            "name": exp_name,
            "description": description.strip(),
            "created_at": new_exp["created_at"],
        }

    # --- Node Lifecycle Operations ---

    def create_node(
        self,
        exploration_id: str,
        title: str,
        description: str,
        node_type: str = "finding",
        status: str = "proposed",
        metadata: dict | None = None,
        x: float | None = None,
        y: float | None = None,
    ) -> dict:
        exp = self.get_exploration(exploration_id)
        title = title.strip()
        description = description.strip()
        if not title:
            raise WorkspaceError("title cannot be empty")
        if not description:
            raise WorkspaceError("description cannot be empty")
        if node_type not in NODE_TYPES:
            raise WorkspaceError(f"invalid node_type '{node_type}'. Must be one of: {NODE_TYPES}")
        if status not in NODE_STATUSES:
            raise WorkspaceError(f"invalid status '{status}'. Must be one of: {NODE_STATUSES}")

        prefix_map = {
            "hypothesis": "hypo",
            "finding": "find",
            "claim": "claim",
            "topic": "topic",
            "subtopic": "subtopic",
            "evidence": "evid",
            "document": "doc",
            "open_question": "quest",
        }
        prefix = prefix_map.get(node_type, "node")
        short_id = uuid.uuid4().hex[:6]
        node_id = f"node_{prefix}_{short_id}"

        node = {
            "id": node_id,
            "node_id": node_id,
            "exploration_id": exp["id"],
            "title": title,
            "description": description,
            "type": node_type,
            "category": "resource" if node_type == "document" else "info",
            "status": status,
            "x": x if x is not None else 100.0,
            "y": y if y is not None else 100.0,
            "width": 280.0,
            "height": 72.0,
            "metadata": metadata or {},
            "created_at": now_iso(),
            "updated_at": now_iso(),
            "status_history": [
                {
                    "status": status,
                    "timestamp": now_iso(),
                    "justification": "Initial creation",
                }
            ],
        }

        exp.setdefault("nodes", {})[node_id] = node
        self._save("create_node", {
            "exploration_id": exp["id"],
            "node_id": node_id,
            "title": title,
            "type": node_type,
        })
        return node

    def get_node(self, exploration_id: str, node_id: str) -> dict:
        exp = self.get_exploration(exploration_id)
        nodes = exp.get("nodes", {})
        if node_id not in nodes:
            raise WorkspaceError(f"node with id '{node_id}' does not exist in exploration '{exp['id']}'.")
        return nodes[node_id]

    def update_node(
        self,
        exploration_id: str,
        node_id: str,
        title: str | None = None,
        description: str | None = None,
        metadata: dict | None = None,
    ) -> dict:
        node = self.get_node(exploration_id, node_id)
        changed = False

        if title is not None:
            t = title.strip()
            if not t:
                raise WorkspaceError("title cannot be empty")
            node["title"] = t
            changed = True

        if description is not None:
            d = description.strip()
            if not d:
                raise WorkspaceError("description cannot be empty")
            node["description"] = d
            changed = True

        if metadata is not None:
            node["metadata"] = {**node.get("metadata", {}), **metadata}
            changed = True

        if changed:
            node["updated_at"] = now_iso()
            self._save("update_node", {"exploration_id": exploration_id, "node_id": node_id})

        return node

    def update_node_status(self, exploration_id: str, node_id: str, status: str, justification: str) -> dict:
        node = self.get_node(exploration_id, node_id)
        if status not in NODE_STATUSES:
            raise WorkspaceError(f"invalid status '{status}'. Must be one of: {NODE_STATUSES}")
        justification = justification.strip()
        if len(justification) < 6:
            raise WorkspaceError("status update refused: justification must explain the reason (min 6 characters)")

        old_status = node.get("status", "proposed")
        node["status"] = status
        node["updated_at"] = now_iso()
        node.setdefault("status_history", []).append({
            "status": status,
            "previous_status": old_status,
            "timestamp": now_iso(),
            "justification": justification,
        })

        self._save("update_node_status", {
            "exploration_id": exploration_id,
            "node_id": node_id,
            "previous_status": old_status,
            "new_status": status,
            "justification": justification,
        })
        return {
            "exploration_id": exploration_id,
            "node_id": node_id,
            "previous_status": old_status,
            "new_status": status,
            "justification": justification,
        }

    def delete_node(
        self,
        exploration_id: str,
        node_id: str | None = None,
        node_ids: list[str] | None = None,
        delete_all: bool = False,
        cascade_connections: bool = True,
    ) -> dict:
        exp = self.get_exploration(exploration_id)
        nid_str = (str(node_id) if node_id else "").strip().lower()

        if delete_all or nid_str in ("all", "*"):
            targets = list(exp.get("nodes", {}).keys())
        elif node_ids and isinstance(node_ids, list):
            targets = [str(nid) for nid in node_ids if str(nid) in exp.get("nodes", {})]
        elif node_id:
            self.get_node(exploration_id, node_id)
            targets = [node_id]
        else:
            targets = []

        total_removed_conns = 0
        for nid in targets:
            if nid in exp.get("nodes", {}):
                del exp["nodes"][nid]
            if cascade_connections:
                conns = exp.get("connections", {})
                to_remove = [
                    cid
                    for cid, conn in conns.items()
                    if conn.get("source_node_id") == nid or conn.get("target_node_id") == nid
                ]
                for cid in to_remove:
                    del conns[cid]
                    total_removed_conns += 1

        self._save("delete_node", {
            "exploration_id": exploration_id,
            "node_ids": targets,
            "cascade_connections": cascade_connections,
            "removed_connections_count": total_removed_conns,
        })
        return {
            "deleted": True,
            "exploration_id": exploration_id,
            "node_id": targets[0] if len(targets) == 1 else None,
            "node_ids": targets,
            "count": len(targets),
            "removed_connections_count": total_removed_conns,
        }

    def search_nodes(
        self,
        exploration_id: str,
        query: str | None = None,
        node_type: str | None = None,
        status: str | None = None,
    ) -> list[dict]:
        exp = self.get_exploration(exploration_id)
        nodes = exp.get("nodes", {})
        results = []
        q = (query or "").strip().lower()

        for node_id, node in nodes.items():
            if node_type and node.get("type") != node_type:
                continue
            if status and node.get("status") != status:
                continue
            if q:
                title = node.get("title", "").lower()
                desc = node.get("description", "").lower()
                nid = node_id.lower()
                if q not in title and q not in desc and q not in nid:
                    continue
            results.append(node)
        return results

    # --- Connection Operations ---

    def connect_nodes(
        self,
        exploration_id: str,
        source_node_id: str,
        target_node_ids: list[str] | str,
        relationship_type: str = "related_to",
        description: str = "",
        metadata: dict | None = None,
    ) -> list[dict]:
        exp = self.get_exploration(exploration_id)
        conns = exp.setdefault("connections", {})
        nodes = exp.get("nodes", {})

        src_id = (source_node_id or "").strip()
        if src_id not in nodes:
            raise WorkspaceError(f"source node '{src_id}' does not exist in exploration '{exploration_id}'.")

        desc = (description or "").strip()
        if not desc:
            raise WorkspaceError("description is required: you must explain the reasoning for connecting these nodes.")

        targets = [target_node_ids] if isinstance(target_node_ids, str) else list(target_node_ids)
        targets = [t.strip() for t in targets if t and t.strip()]
        if not targets:
            raise WorkspaceError("at least one target_node_id is required to create a connection.")

        created_conns = []
        for tid in targets:
            if tid not in nodes:
                raise WorkspaceError(f"target node '{tid}' does not exist in exploration '{exploration_id}'.")
            if tid == src_id:
                raise WorkspaceError("cannot connect a node to itself.")

            # Check if identical connection already exists
            existing = next(
                (c for c in conns.values() if c.get("source_node_id") == src_id and c.get("target_node_id") == tid),
                None,
            )
            if existing:
                continue

            cid = f"conn_{uuid.uuid4().hex[:6]}"
            conn = {
                "id": cid,
                "connection_id": cid,
                "exploration_id": exploration_id,
                "source_node_id": src_id,
                "target_node_id": tid,
                "relationship_type": relationship_type or "related_to",
                "description": desc,
                "metadata": metadata or {},
                "created_at": now_iso(),
                "updated_at": now_iso(),
            }
            conns[cid] = conn
            created_conns.append(conn)

        if created_conns:
            self._save("connect_nodes", {
                "exploration_id": exploration_id,
                "source_node_id": src_id,
                "target_count": len(created_conns),
                "relationship_type": relationship_type,
            })

        return created_conns

    def get_connections(
        self,
        exploration_id: str,
        node_id: str | None = None,
        direction: str = "both",
    ) -> list[dict]:
        exp = self.get_exploration(exploration_id)
        conns = list(exp.get("connections", {}).values())

        if not node_id:
            return conns

        nid = node_id.strip()
        dir_lower = (direction or "both").lower()

        if dir_lower == "outgoing":
            return [c for c in conns if c.get("source_node_id") == nid]
        if dir_lower == "incoming":
            return [c for c in conns if c.get("target_node_id") == nid]
        return [c for c in conns if c.get("source_node_id") == nid or c.get("target_node_id") == nid]

    def update_connection(
        self,
        exploration_id: str,
        connection_id: str,
        relationship_type: str | None = None,
        description: str | None = None,
        metadata: dict | None = None,
    ) -> dict:
        exp = self.get_exploration(exploration_id)
        conns = exp.get("connections", {})
        cid = (connection_id or "").strip()

        if cid not in conns:
            raise WorkspaceError(f"connection '{cid}' does not exist in exploration '{exploration_id}'.")

        conn = conns[cid]
        if relationship_type:
            conn["relationship_type"] = relationship_type.strip()
        if description:
            conn["description"] = description.strip()
        if metadata:
            conn.setdefault("metadata", {}).update(metadata)

        conn["updated_at"] = now_iso()
        self._save("update_connection", {
            "exploration_id": exploration_id,
            "connection_id": cid,
            "relationship_type": conn["relationship_type"],
        })
        return conn

    def remove_connection(self, exploration_id: str, connection_id: str) -> dict:
        exp = self.get_exploration(exploration_id)
        conns = exp.get("connections", {})
        cid = (connection_id or "").strip()

        if cid not in conns:
            raise WorkspaceError(f"connection '{cid}' does not exist in exploration '{exploration_id}'.")

        del conns[cid]
        self._save("remove_connection", {
            "exploration_id": exploration_id,
            "connection_id": cid,
        })
        return {
            "deleted": True,
            "exploration_id": exploration_id,
            "connection_id": cid,
        }


