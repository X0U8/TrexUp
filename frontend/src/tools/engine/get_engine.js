/** get_engine: one engine with its full code. Call before editing so edits match the real code. */
import { getEngineDescription, getEngineDisplayName, getEngineManifest } from '../../utils/engineUtils';
import { BUILTIN_ENGINES, engineExists, resolveCode } from './_shared';

export const DEFINITION = {
  type: 'function',
  name: 'get_engine',
  description:
    'Get one engine with its full Python code, description, and MANIFEST. Call this before editing an engine so edits are made against the real current code.',
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {
      engine_id: { type: 'string', description: 'The unique ID of the engine (e.g. "file_detection").' },
    },
    required: ['engine_id'],
  },
};

export async function run(ctx, args) {
  const id = String(args.engine_id || '').trim();
  if (!id) return { error: 'engine_id is required' };
  if (!engineExists(ctx, id)) return { error: `Engine "${id}" not found. Call list_engines to see available engines.` };
  const code = resolveCode(ctx, id);
  const engineCtxData = {
    ...ctx.enginesData,
    [id]: { ...(ctx.enginesData?.[id] || {}), code },
  };
  const manifest = getEngineManifest(id, engineCtxData);
  const name = manifest?.name || getEngineDisplayName(id, engineCtxData);
  const description = manifest?.description || getEngineDescription(id, engineCtxData);

  return {
    engine: {
      engine_id: id,
      name,
      description,
      manifest,
      built_in: BUILTIN_ENGINES.includes(id),
      code,
    },
  };
}
