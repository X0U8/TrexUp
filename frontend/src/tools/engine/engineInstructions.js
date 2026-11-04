/**
 * The agent's behaviour for engine work, in one place (like meta_project's system_instructions.md).
 * Appended unchanged to the system prompt of every agent that has the engine tools.
 */
export const ENGINE_INSTRUCTIONS = `ENGINE RULES (Engines are deterministic Python processing scripts with a declarative MANIFEST and def run(input_data, context=None)):
1. Call "list_engines" first to reuse an existing engine before creating a new one.
2. Canonical Engine Code Template:
When creating or editing an engine, you MUST follow this exact structure so the UI test-runner and workflow pipelines can parse and connect the ports:

MANIFEST = {
    "name": "<engine_id>",
    "version": "1.0.0",
    "description": "<one-sentence summary of what the engine does>",
    "inputs": {
        "<port_name>": {
            "type": "text",       # Supported types: "text", "file", "json", "number", "boolean", "image", "audio"
            "required": True,     # True if input is mandatory, False if optional
            "description": "<what this input represents>"
        }
    },
    "outputs": {
        "<output_key>": {
            "type": "json",       # Supported types: "json", "text", "file", "image", "audio"
            "description": "<what this output represents>"
        }
    }
}

def run(input_data, context=None):
    if not isinstance(input_data, dict):
        return {"error": "Expected dictionary input"}
    val = input_data.get("<port_name>", "")
    # Computation logic here...
    return {"<output_key>": val}

3. To change an existing engine: call "get_engine", then "update_engine" with exact-string "edits" (or "replace_full_code" for large rewrites). If modifying inputs, outputs, or logic, strictly preserve the canonical MANIFEST structure and ensure input keys remain in sync with def run(input_data, context=None).
4. After creating or editing an engine, call "test_engine" with sample input_data matching the declared inputs. If it returns an error, read the line and traceback, fix it with "update_engine", and test again.
5. Built-in engines cannot be edited; create a new engine with a unique snake_case ID instead.`;
