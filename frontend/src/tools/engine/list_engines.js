/** list_engines: every engine in the project. Nothing is changed. */
import { getEngineDescription, getEngineDisplayName } from '../../utils/engineUtils';
import { BUILTIN_ENGINES } from './_shared';

export const DEFINITION = {
  type: 'function',
  name: 'list_engines',
  description:
    'List all engines in the project with their ID, name and description. Call this first to find engines to reuse and to avoid creating duplicates.',
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {},
  },
};

export async function run(ctx) {
  const list = ctx.engines.map((id) => ({
    engine_id: id,
    name: getEngineDisplayName(id, ctx.enginesData),
    description: getEngineDescription(id, ctx.enginesData),
    built_in: BUILTIN_ENGINES.includes(id),
  }));
  return { listed: true, count: list.length, engines: list };
}
