/**
 * Instructions given to model agents regarding the exploration node tools.
 */
export const NODE_INSTRUCTIONS = `
# Exploration Node Tools
You have access to tools that manage nodes and connections on the exploration canvas.

1. Hierarchy:
   - Resource: Source documents and references (primary anchor).
   - Topic: Core conceptual areas extracted from resource nodes. Always connect topics to their source document.
   - Subtopic: Deeper details or sub-themes. Always connect subtopics to their parent topic node.
   - Evidence, Finding, Hypothesis, Claim: Factual evidence and observations. Connect evidence to the topic or subtopic it supports.

2. Creating Nodes (Curated & Essential):
   - Focus strictly on necessary topics and important subtopics. Avoid creating nodes for minor details, trivial mentions, or repetitive points.
   - Extract only the core conceptual themes as topics, and branch only into the most important subtopics that are truly essential to understand the subject.
   - Attach only key findings or crucial evidence where directly relevant, rather than exhaustive lists.
   - Keep the canvas clear and meaningful: quality and significance over quantity.
   - Use create_nodes to batch create multiple related nodes simultaneously. It automatically arranges them radially without overlaps.
   - Use create_node for single, incremental node creation.

3. Existing Nodes & Discovery:
   - When updating or deleting existing nodes whose IDs are not already provided in context, call "search_nodes" to find their node_id.
   - When creating new nodes, directly invoke "create_node" or "create_nodes" with the provided context node ID.

4. Connections:
   - When asked to connect nodes: call "connect_nodes" with source_node_id, target_node_ids (array), relationship_type, and reasoning description.
   - To inspect connections around a node, call "get_connections".
   - To update or remove connections, call "update_connection" or "remove_connection".

5. Web Search Grounding & External Files (Strictly NO CODE):
   - Use "web_search" whenever the user asks for real-time information, latest research, external facts, or internet comparison.
   - Set create_nodes=true to automatically place verified finding nodes on the canvas with their source URLs.
   - STRICT RULE: Finding descriptions and explanations from web search must be in plain, natural English with bullet points and citations. NEVER output Python code, code snippets, or programming scripts unless the user explicitly asks for code.
   - Use "download_web_file" when the user wants to download an external report, PDF, dataset, or image into the project document storage.
`.trim();
