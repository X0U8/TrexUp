/**
 * The AI model's instructions for workflow pipeline operations.
 * Appended to the system prompt of agents that have access to the workflow tools.
 */
export const WORKFLOW_INSTRUCTIONS = `WORKFLOW PIPELINE GUIDE & STEP-BY-STEP WORKFLOW CREATION:

Follow these core principles whenever creating or modifying workflow pipelines:

GOLDEN RULES FOR WORKFLOW ARCHITECTURE:
1. THE COMPLETE PIPELINE CHAIN: Every workflow must form an unbroken path from Input to Output (Input -> Engine(s) -> Agent(s) -> Output). Intermediate processing nodes must NEVER be left dangling.
2. NO BYPASS THREADS: When adding intermediate engines or agents between Input and Output, never leave a direct thread connecting Input directly to Output. The data must flow through your processing nodes.
3. THE FILE-DROP REQUIREMENT: If the workflow triggers on "file_drop" and creates canvas nodes, ALWAYS include the "resource_bridge" engine immediately after Input. The Resource Bridge registers the file and creates its Document node on the canvas so that downstream agents know the active document node ID to link findings/topics to.
4. WORKFLOW NAME: Always provide a descriptive "name" parameter when calling "create_workflow" (e.g. name: "Document Analysis Pipeline").

CREATING COMPLETE PIPELINES (RECOMMENDED METHOD - ONE SHOT):
- Call "create_workflow" with "pipeline" to build the entire unbroken workflow in a single step!
  Parameters:
  * name: Descriptive name
  * description: What the pipeline does
  * trigger: "file_drop" (or "manual" / "node_connect")
  * pipeline: Array of sequential stages, e.g.:
    [
      { "type": "engine", "engine_id": "resource_bridge", "title": "Resource Bridge" },
      { "type": "agent", "title": "Node Creator Agent", "model_id": "muse-spark-1.3", "tools": true, "system_prompt": "Analyze input metadata and create canvas nodes linked to the source document." }
    ]
  This automatically spaces the nodes and connects: Input -> Resource Bridge -> Agent -> Output without any dangling threads or bypass errors!

MANUAL STEP-BY-STEP WORKFLOW CREATION (FOR ADVANCED / CUSTOM FLOWS):
Step 1: Call "create_workflow" to initialize canvas.
Step 2: Add nodes via "add_workflow_node" or "batch_place_nodes":
  - Input node (trigger: "file_drop")
  - Python Engines ("resource_bridge", "file_detection", "document_extractor")
  - AI Agents (set system_prompt, model_id, tools: true)
  - Output node
Step 3: Remove any direct "input" -> "output" bypass thread using "disconnect_workflow_nodes".
Step 4: Connect sequentially with "connect_workflow_nodes" (Input -> Engine -> Agent -> Output).
Step 5: Attach branching conditions if needed via "set_thread_condition".
Step 6: Call "auto_layout_workflow" to cleanly align all nodes.

UNDERSTANDING WORKFLOW PARAMETERS & CONFIGURATION CHECKLIST:
Always inspect and configure every parameter deliberately according to its specific purpose:

1. PYTHON ENGINES (DO NOT CONFUSE THEIR ROLES):
- "resource_bridge": Caches and validates the local OS document path, and creates the Document node on the canvas. IT DOES NOT EXTRACT TEXT.
- "file_detection": Detects MIME type, binary magic bytes, and file category.
- "document_extractor": Extracts clean text, headings, and tables from documents. MANDATORY before any agent that needs to analyze document content!

2. CONTEXT SOURCES (WHAT EACH CHECKBOX DELIVERS TO AN AGENT):
- "Input File Content" (inputFile): Passes raw file text and local path. Required if the agent directly inspects raw files.
- "Input Metadata" (inputMetadata): Passes Doc ID, file name, category, and canvas Document Node ID. MANDATORY so the agent knows the canvas node to link its findings to!
- "Previous Node Output" (previousOutput): Passes outputs from upstream nodes (e.g. extracted_text from document_extractor). MANDATORY if a prior engine extracted the text!
- "Previous Node Metadata" (previousMetadata): Passes confidence, duration, and escalation flags.

3. AGENT PROMPT & INSTRUCTION RULES:
- NEVER tell an agent to call "search_nodes" to find the document! The canvas Document Node ID is ALREADY injected into the agent's context and tool calls automatically.
- Always write direct, actionable instructions: "Analyze the document content and immediately call 'create_nodes' in batch to create primary topics, subtopics, and findings linked to the source document."
- Ensure "tools: true" is enabled whenever the agent is expected to create or connect canvas nodes.

4. PARAMETER VERIFICATION CHECKLIST BEFORE RETURNING:
[ ] Input trigger matches user intent ("file_drop" vs "manual").
[ ] If the agent needs to read text, is "document_extractor" present, or is "inputFile" / "previousOutput" enabled?
[ ] Is "inputMetadata" checked so the agent has the document node ID?
[ ] Is the prompt clear and actionable without unnecessary search instructions?
[ ] Are all nodes connected in an unbroken chain to Output with zero bypass threads?`;
