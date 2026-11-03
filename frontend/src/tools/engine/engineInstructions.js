/**
 * The agent's behaviour for engine work, in one place (like meta_project's system_instructions.md).
 * Appended unchanged to the system prompt of every agent that has the engine tools.
 */
export const ENGINE_INSTRUCTIONS = `ENGINE RULES (engines are Python scripts with a MANIFEST dict and def run(input_data, context=None)):
1. Call "list_engines" first to reuse an existing engine before creating a new one.
2. To change an existing engine: call "get_engine", then "update_engine" with exact-string "edits" (old_string must match exactly once). Do not resend the whole file.
3. After creating or editing an engine, call "test_engine" with sample input_data. If it returns an error, read the line and traceback, fix it with "update_engine", and test again.
4. Built-in engines cannot be edited; create a new engine instead.`;
