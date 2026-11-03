/** create_engine: save a new engine. Refused if the ID exists or the code is not a valid engine. */
import { ENGINE_ID_PATTERN, engineExists, validateCode } from './_shared';

export const DEFINITION = {
  type: 'function',
  name: 'create_engine',
  description:
    'Create a new engine from Python code. The code must define a MANIFEST dict and an entry function `def run(input_data, context=None)`. Refused if the ID already exists or the code has a syntax error, no MANIFEST, or no run().',
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {
      engine_id: { type: 'string', description: 'Unique snake_case ID for the engine (e.g. "pdf_table_extractor").' },
      name: { type: 'string', description: 'Short display name for the engine.' },
      description: { type: 'string', description: 'What the engine does, what it expects as input and what it returns.' },
      code: { type: 'string', description: 'Full Python source: MANIFEST plus `def run(input_data, context=None)`.' },
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
