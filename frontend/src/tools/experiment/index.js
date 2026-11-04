export { EXPERIMENT_INSTRUCTIONS } from './experimentInstructions';

export const EXPERIMENT_TOOL_DEFINITIONS = [
  {
    name: 'propose_experiment',
    description: 'Propose an experiment to investigate a question or test a hypothesis. Triggers user confirmation before the experiment is created.',
    parameters: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'A concise, descriptive title for the experiment.',
        },
        objective: {
          type: 'string',
          description: 'The core research objective or goal of this experiment.',
        },
        hypothesis: {
          type: 'string',
          description: 'The tentative hypothesis being tested or explored.',
        },
      },
      required: ['title', 'objective'],
    },
  },
  {
    name: 'set_experiment_plan',
    description: 'Formulate or replace the tentative step-by-step flowchart plan for the active experiment.',
    parameters: {
      type: 'object',
      properties: {
        experiment_id: {
          type: 'string',
          description: 'Optional ID of the experiment (defaults to the currently active experiment).',
        },
        plan: {
          type: 'array',
          description: 'Sequential list of planned steps.',
          items: {
            type: 'object',
            properties: {
              step_number: { type: 'number', description: 'Step order index (1-based).' },
              title: { type: 'string', description: 'Short title for this step.' },
              description: { type: 'string', description: 'Detailed description of what this step investigates or tests.' },
              status: {
                type: 'string',
                enum: ['pending', 'in_progress', 'completed', 'failed'],
                description: 'Initial status of the step (usually pending).',
              },
            },
            required: ['step_number', 'title'],
          },
        },
      },
      required: ['plan'],
    },
  },
  {
    name: 'update_experiment_step',
    description: 'Update the execution status and findings of a specific step in the experiment flowchart.',
    parameters: {
      type: 'object',
      properties: {
        experiment_id: {
          type: 'string',
          description: 'Optional ID of the experiment.',
        },
        step_number: {
          type: 'number',
          description: 'The 1-based step number to update.',
        },
        status: {
          type: 'string',
          enum: ['pending', 'in_progress', 'completed', 'failed'],
          description: 'New status for the step.',
        },
        notes: {
          type: 'string',
          description: 'Execution observations or notes for this step.',
        },
      },
      required: ['step_number', 'status'],
    },
  },
  {
    name: 'record_experiment_finding',
    description: 'Log an experimental finding backed by concrete proof into the Findings tab.',
    parameters: {
      type: 'object',
      properties: {
        experiment_id: {
          type: 'string',
          description: 'Optional ID of the experiment.',
        },
        title: {
          type: 'string',
          description: 'Headline of the verified finding or discovery.',
        },
        proof: {
          type: 'string',
          description: 'Empirical proof, verified metrics, calculation, or cited evidence backing this finding.',
        },
        details: {
          type: 'string',
          description: 'Optional extended explanation or context.',
        },
      },
      required: ['title', 'proof'],
    },
  },
  {
    name: 'record_experiment_artifact',
    description: 'Attach a research paper, dataset, chart, or result file into the Artifacts tab.',
    parameters: {
      type: 'object',
      properties: {
        experiment_id: {
          type: 'string',
          description: 'Optional ID of the experiment.',
        },
        name: {
          type: 'string',
          description: 'Name of the artifact (e.g. "experiment_data.csv" or "Theory Analysis").',
        },
        type: {
          type: 'string',
          description: 'Type of artifact: paper, dataset, chart, code, or document.',
        },
        content: {
          type: 'string',
          description: 'Text content or summary of the artifact.',
        },
        url: {
          type: 'string',
          description: 'Optional URL or local path to the artifact file.',
        },
      },
      required: ['name', 'type'],
    },
  },
  {
    name: 'finalize_experiment_report',
    description: 'Publish the final proof-backed synthesis report for the experiment into the Report tab.',
    parameters: {
      type: 'object',
      properties: {
        experiment_id: {
          type: 'string',
          description: 'Optional ID of the experiment.',
        },
        report: {
          type: 'string',
          description: 'Comprehensive research report in markdown detailing the hypothesis, methodology, results, and conclusion.',
        },
      },
      required: ['report'],
    },
  },
];

export const EXPERIMENT_TOOL_NAMES = EXPERIMENT_TOOL_DEFINITIONS.map((def) => def.name);
