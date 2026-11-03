import { getExplorationContext } from './_shared';

export const DEFINITION = {
  type: 'function',
  name: 'list_explorations',
  description:
    'List all exploration canvases available in the workspace. Returns exploration IDs, names, descriptions, and node counts.',
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {},
  },
};

export function run(ctx, args = {}) {
  const { explorationsData } = getExplorationContext(ctx, args);
  const list = Object.keys(explorationsData).map((id) => ({
    exploration_id: id,
    name: id,
    node_count: Object.keys(explorationsData[id]?.nodes || {}).length,
  }));
  return { success: true, explorations: list };
}
