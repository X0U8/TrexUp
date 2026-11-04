import { generateNextWorkflowId } from './_shared';
import { DEFAULT_WORKFLOWS } from '../../utils/workflowTemplates';

export const DEFINITION = {
  type: 'function',
  name: 'create_workflow',
  description: 'Create a new workflow pipeline. Supports creating a blank workflow, from a template, or an end-to-end connected pipeline with stages.',
  parameters: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Display name of the workflow.' },
      description: { type: 'string', description: 'Summary of the workflow objective and routing logic.' },
      trigger: {
        type: 'string',
        enum: ['file_drop', 'manual', 'node_connect'],
        description: 'Trigger type for the Input node (default: "file_drop").',
      },
      template_id: { type: 'string', description: 'Optional blueprint template to base the workflow on.' },
      pipeline: {
        type: 'array',
        description: 'Optional sequential list of intermediate stages between Input and Output. Automatically creates and connects Input -> Stage 1 -> Stage 2 -> Output.',
        items: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['engine', 'agent'], description: 'Stage type.' },
            title: { type: 'string', description: 'Display title for the stage node.' },
            engine_id: { type: 'string', description: 'Engine ID if type is engine (e.g. "resource_bridge", "file_detection", "document_extractor").' },
            model_id: { type: 'string', description: 'Model ID if type is agent (e.g. "muse-spark-1.3", "muse-wonder-1.0").' },
            system_prompt: { type: 'string', description: 'System prompt instructions for the agent.' },
            tools: { type: 'boolean', description: 'Whether the agent has canvas tool access (default: true).' },
          },
          required: ['type'],
        },
      },
    },
    required: ['name'],
  },
};

export async function run(ctx, args) {
  let name = String(args?.name || args?.workflow_name || args?.title || '').trim();
  if (!name) {
    name = 'Custom Workflow Pipeline';
  }

  const existingWorkflows = ctx.workflows || ['extraction', 'connection_synthesis'];
  const newWorkflowId = generateNextWorkflowId(existingWorkflows);

  const initialTrigger = args?.trigger || 'file_drop';
  const triggerLabel = initialTrigger === 'file_drop' ? 'file drop' : initialTrigger;

  let nodes = {
    input: {
      id: 'input',
      title: 'Input',
      sub: `Trigger: ${triggerLabel}`,
      type: 'input',
      trigger: initialTrigger,
      x: 120,
      y: 220,
      width: 175,
      height: 56,
      acceptedTypes: ['canvas_nodes', 'files'],
      sourceScope: 'canvas_nodes',
    },
    output: {
      id: 'output',
      title: 'Output',
      sub: '',
      type: 'output',
      x: 520,
      y: 220,
      width: 175,
      height: 56,
    },
  };
  let threads = [{ id: 'th_1', from: 'input', to: 'output', condition: '' }];

  if (args?.template_id && DEFAULT_WORKFLOWS[args.template_id]) {
    const tmpl = DEFAULT_WORKFLOWS[args.template_id];
    nodes = JSON.parse(JSON.stringify(tmpl.nodes || {}));
    threads = JSON.parse(JSON.stringify(tmpl.threads || []));
  } else {
    const pipelineList = Array.isArray(args?.pipeline) ? args.pipeline : Array.isArray(args?.stages) ? args.stages : null;
    if (pipelineList && pipelineList.length > 0) {
      threads = [];
      let currentX = 120;
      let prevNodeId = 'input';

      pipelineList.forEach((stage, idx) => {
        currentX += 270;
        const stageType = stage.type === 'engine' ? 'engine' : 'agent';
        const stageId = `${stageType}_${idx + 1}`;
        const stageTitle = stage.title || (stageType === 'engine' ? (stage.engine_id || 'Engine') : (stage.model_id || 'Agent'));

        const nodeObj = {
          id: stageId,
          title: stageTitle,
          sub: stageType === 'engine' ? (stage.engine_id || 'Python engine') : (stage.model_id || 'Muse Spark 1.3'),
          type: stageType,
          x: currentX,
          y: 220,
          width: 185,
          height: 56,
        };

        if (stageType === 'engine') {
          nodeObj.engineId = stage.engine_id || 'resource_bridge';
          nodeObj.inputSource = stage.input_source || 'previous';
        } else {
          nodeObj.modelId = stage.model_id || 'muse-spark-1.3';
          nodeObj.modelName = stage.model_id || 'Muse Spark 1.3';
          nodeObj.systemPrompt = stage.system_prompt || 'You are an AI research assistant.';
          nodeObj.temperature = typeof stage.temperature === 'number' ? stage.temperature : 0.2;
          nodeObj.reasoningEffort = stage.reasoning_effort || 'minimal';
          nodeObj.tools = typeof stage.tools === 'boolean' ? stage.tools : true;
          nodeObj.inputSource = stage.input_source || 'previous';
        }

        nodes[stageId] = nodeObj;
        threads.push({
          id: `th_${threads.length + 1}`,
          from: prevNodeId,
          to: stageId,
          condition: stage.condition || '',
        });
        prevNodeId = stageId;
      });

      currentX += 270;
      nodes.output.x = currentX;
      threads.push({
        id: `th_${threads.length + 1}`,
        from: prevNodeId,
        to: 'output',
        condition: '',
      });
    }
  }

  const description = String(args?.description || 'Custom workflow pipeline.').trim();

  const newWorkflow = {
    name,
    description,
    nodes,
    threads,
  };

  const updatedWorkflows = [...existingWorkflows, newWorkflowId];
  const updatedWorkflowsData = {
    ...(ctx.workflowsData || {}),
    [newWorkflowId]: newWorkflow,
  };

  return {
    created: true,
    workflow_id: newWorkflowId,
    name,
    description,
    node_count: Object.keys(nodes).length,
    thread_count: threads.length,
    updatedWorkflows,
    updatedWorkflowsData,
    currentWorkflow: newWorkflowId,
  };
}
