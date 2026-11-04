/** create_engine: save a new engine. Refused if the ID exists or the code is not a valid engine. */
import { ENGINE_ID_PATTERN, engineExists, validateCode } from './_shared';

export const DEFINITION = {
  type: 'function',
  name: 'create_engine',
  description:
    'Create a new engine from Python code. The code must define a top-level MANIFEST dictionary specifying its input/output ports and an entry function `def run(input_data, context=None)`. Refused if the engine_id exists or if code lacks MANIFEST or run().',
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {
      engine_id: {
        type: 'string',
        description: 'Unique snake_case ID for the engine (e.g. "text_sentiment_analyzer", "table_formatter").',
      },
      name: {
        type: 'string',
        description: 'Short human-readable display name for the engine.',
      },
      description: {
        type: 'string',
        description: 'Clear description of what the engine does, its expected inputs and return values.',
      },
      code: {
        type: 'string',
        description:
          'Full Python source code. You MUST adhere to this exact canonical engine template:\n\nMANIFEST = {\n    "name": "<engine_id>",\n    "version": "1.0.0",\n    "description": "<one-sentence summary>",\n    "inputs": {\n        "<input_port>": {\n            "type": "text",       # Supported: "text", "file", "json", "number", "boolean", "image", "audio"\n            "required": True,\n            "description": "<what this input represents>"\n        }\n    },\n    "outputs": {\n        "<output_port>": {\n            "type": "json",       # Supported: "json", "text", "file", "image", "audio"\n            "description": "<what this output represents>"\n        }\n    }\n}\n\ndef run(input_data, context=None):\n    # input_data is a dict with keys from MANIFEST["inputs"]\n    if not isinstance(input_data, dict):\n        return {"error": "Expected dict input"}\n    value = input_data.get("<input_port>", "")\n    # your processing logic here\n    return {"<output_port>": value}',
      },
    },
    required: ['engine_id', 'name', 'description', 'code'],
  },
};

export async function run(ctx, args) {
  const id = String(args.engine_id || '').trim();
  const name = String(args.name || '').trim();
  const description = String(args.description || '').trim();
  const code = typeof args.code === 'string' ? args.code : '';
  if (!ENGINE_ID_PATTERN.test(id)) {
    return { error: 'engine_id must be snake_case: 3-40 chars, start with a letter, only a-z, 0-9 and _' };
  }
  if (engineExists(ctx, id)) return { error: `Engine "${id}" already exists. Use update_engine to change it.` };
  if (!name || !description || !code.trim()) return { error: 'name, description and code are required' };

  const invalid = await validateCode(code);
  if (invalid) return invalid;

  const now = new Date().toISOString();
  return {
    created: true,
    engine_id: id,
    updatedEngines: [...ctx.engines, id],
    updatedEnginesData: { ...ctx.enginesData, [id]: { id, name, description, code, createdAt: now, updatedAt: now } },
  };
}
