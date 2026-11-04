import { AVAILABLE_AGENT_MODELS } from './_shared';

export const DEFINITION = {
  type: 'function',
  name: 'list_agent_models',
  description: 'List all valid AI models available for workflow agents, including IDs, context limits, and capabilities.',
  parameters: {
    type: 'object',
    properties: {},
  },
};

export async function run() {
  return {
    listed: true,
    count: AVAILABLE_AGENT_MODELS.length,
    models: AVAILABLE_AGENT_MODELS.map((m) => ({
      model_id: m.id,
      name: m.name,
      context_window: m.tag === '1M' ? '1,048,576 tokens' : m.tag,
      description: m.desc,
    })),
  };
}
