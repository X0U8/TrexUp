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

BEFORE YOU BUILD:
- State the goal in one line: the input, and the output you expect (text, image, or canvas nodes).
- Design the pipeline yourself. Use existing engines and agents where they fit. Create a custom engine only when no existing one does the job, and test it with test_engine before adding it to the workflow.

THE CHECKLIST (the validator checks these after every change; the pipeline is not done until all pass):
- Exactly one Input and one Output, and every step is on a path from Input to Output.
- Every agent receives input from an upstream step.
- Every agent has instructions (prompt).
- Every custom engine has passed test_engine with its current code.
- Nothing is left dangling and there is no Input-to-Output bypass.

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

2. CONTEXT SOURCES (WHAT EACH CONTEXT OPTION DELIVERS TO AN AGENT):
- "input" / "Input File Content" (inputFile): The main content given as input to the workflow (e.g. raw document text, file bytes, or source content).
- "input_metadata" / "Input Metadata" (inputMetadata): Identity and technical metadata of the main input (doc_id, file_name, file size, MIME type, category, and canvas document node ID). MANDATORY so downstream agents know which canvas node to link findings to!
- "previous_output" / "Previous Node Output" (previousOutput): The primary result produced by the immediately preceding upstream step (e.g. clean extracted_text from document_extractor, or synthesized insights from a prior agent).
- "previous_output_metadata" / "Previous Node Metadata" (previousMetadata): Execution and performance metadata from the preceding step (duration, model name, status, confidence score, and error flags).

3. AGENT PROMPT & INSTRUCTION RULES:
- NEVER tell an agent to call "search_nodes" to find the document! The canvas Document Node ID is ALREADY injected into the agent's context and tool calls automatically.
- Always write direct, actionable instructions: "Analyze the document content and immediately call 'create_nodes' in batch to create primary topics, subtopics, and findings linked to the source document."
- Ensure "tools: true" is enabled whenever the agent is expected to create or connect canvas nodes.

4. PARAMETER VERIFICATION CHECKLIST BEFORE RETURNING:
[ ] Input trigger matches user intent ("file_drop" vs "manual").
[ ] If the agent needs to read text, is "document_extractor" present, or is "inputFile" / "previousOutput" enabled?
[ ] Is "inputMetadata" checked so the agent has the document node ID?
[ ] Is the prompt clear and actionable without unnecessary search instructions?
[ ] Are all nodes connected in an unbroken chain to Output with zero bypass threads?
[ ] Does every agent have an upstream input and instructions?
[ ] Has every custom engine passed test_engine?

5. READ-ONLY LOG INSPECTION TOOLS (DIAGNOSE ERRORS & TRACE RUNS):
- "get_workflow_logs": List recent workflow execution runs with their status, error, duration, and node count.
- "inspect_workflow_run_log": Inspect the complete read-only trace of a workflow run (or the latest run). Shows:
  * The exact execution path followed (which threads were activated).
  * Every single node executed, its exact input received, output returned, duration, and error message.
  * Call this whenever a pipeline fails, returns null, or behaves unexpectedly to diagnose the exact problem and fix it!`;
