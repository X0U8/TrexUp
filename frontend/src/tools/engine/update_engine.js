/**
 * update_engine: change an engine with exact-string edits instead of rewriting it.
 * Edits apply in order and all-or-nothing; the result is validated before anything is saved.
 */
import { BUILTIN_ENGINES, engineExists, resolveCode, validateCode } from './_shared';

export const DEFINITION = {
  type: 'function',
  name: 'update_engine',
  description:
    'Edit an existing engine. Provide exact string replacements (edits) or full code replacement (replace_full_code). Any updates to MANIFEST or run() must strictly preserve the canonical engine template: top-level MANIFEST dictionary (inputs and outputs with supported types) and entry function def run(input_data, context=None). Built-in engines cannot be edited.',
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {
      engine_id: { type: 'string', description: 'The unique ID of the engine to edit.' },
      edits: {
        type: 'array',
        description:
          'Ordered list of exact string replacements to apply to the code. If modifying MANIFEST or ports, ensure input/output types and keys remain valid and in sync with def run(input_data, context=None).',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            old_string: {
              type: 'string',
              description: 'Exact text to replace. Include surrounding lines so it matches only once.',
            },
            new_string: { type: 'string', description: 'Replacement text.' },
            replace_all: {
              type: 'boolean',
              description: 'Replace every occurrence instead of requiring a single match.',
            },
          },
          required: ['old_string', 'new_string'],
        },
      },
      name: { type: 'string', description: 'Optional new display name.' },
      description: { type: 'string', description: 'Optional new description.' },
      replace_full_code: {
        type: 'string',
        description:
          'Full Python code replacement for major restructures. Must follow the canonical engine template with top-level MANIFEST (inputs and outputs declaring supported types: text, file, json, number, boolean, image, audio) and def run(input_data, context=None). Prefer edits for small changes.',
      },
    },
    required: ['engine_id'],
  },
};

function applyEdits(code, edits) {
  let next = code;
  for (let i = 0; i < edits.length; i++) {
    const { old_string: oldStr, new_string: newStr, replace_all: replaceAll } = edits[i] || {};
    if (typeof oldStr !== 'string' || oldStr === '' || typeof newStr !== 'string') {
      return { error: `edit ${i + 1}: old_string must be non-empty text and new_string must be text` };
    }
    if (oldStr === newStr) return { error: `edit ${i + 1}: old_string and new_string are identical` };
    const count = next.split(oldStr).length - 1;
    if (count === 0) {
      return { error: `edit ${i + 1}: old_string not found in the engine code. Call get_engine and copy the text exactly.` };
    }
    if (count > 1 && !replaceAll) {
      return { error: `edit ${i + 1}: old_string matches ${count} places. Add surrounding lines so it matches once, or set replace_all.` };
    }
    next = replaceAll ? next.split(oldStr).join(newStr) : next.replace(oldStr, () => newStr);
  }
  return { code: next };
}

export async function run(ctx, args) {
  const id = String(args.engine_id || '').trim();
  if (!id) return { error: 'engine_id is required' };
  if (!engineExists(ctx, id)) return { error: `Engine "${id}" not found. Call list_engines to see available engines.` };
  if (BUILTIN_ENGINES.includes(id)) {
    return { error: `"${id}" is a built-in engine and cannot be edited. Create a new engine with the changes instead.` };
  }

  const edits = Array.isArray(args.edits) ? args.edits : [];
  const fullCode = typeof args.replace_full_code === 'string' && args.replace_full_code.trim() !== '' ? args.replace_full_code : null;
  const newName = typeof args.name === 'string' ? args.name.trim() : '';
  const newDesc = typeof args.description === 'string' ? args.description.trim() : '';
  if (edits.length === 0 && !fullCode && !newName && !newDesc) {
    return { error: 'Nothing to update. Provide edits, replace_full_code, name or description.' };
  }
  if (edits.length > 0 && fullCode) return { error: 'Provide either edits or replace_full_code, not both.' };

  let code = resolveCode(ctx, id);
  if (fullCode) {
    code = fullCode;
  } else if (edits.length > 0) {
    const applied = applyEdits(code, edits);
    if (applied.error) return { error: `${applied.error} No changes were saved.` };
    code = applied.code;
  }
  if (fullCode || edits.length > 0) {
    const invalid = await validateCode(code);
    if (invalid) return { ...invalid, error: `${invalid.error} No changes were saved.` };
  }

  const entry = {
    ...(ctx.enginesData[id] || {}),
    id,
    code,
    ...(newName ? { name: newName } : {}),
    ...(newDesc ? { description: newDesc } : {}),
    updatedAt: new Date().toISOString(),
  };
  return {
    updated: true,
    engine_id: id,
    edits_applied: fullCode ? 'full_code' : edits.length,
    updatedEngines: ctx.engines.includes(id) ? ctx.engines : [...ctx.engines, id],
    updatedEnginesData: { ...ctx.enginesData, [id]: entry },
  };
}
