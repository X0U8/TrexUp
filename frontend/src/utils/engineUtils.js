/**
 * Utility functions for engine manifest parsing and identity management.
 */

/**
 * Safely extracts the engine display name from the Python MANIFEST in code,
 * falling back to the engine ID if no valid name is defined.
 *
 * @param {string} engId - Unique immutable engine identifier
 * @param {Record<string, { code?: string, name?: string }>} enginesData - Project engines dictionary
 * @returns {string} The resolved display name or engId
 */
export function getEngineDisplayName(engId, enginesData = {}) {
  if (!engId) return '';
  const engineObj = enginesData?.[engId];
  const code = engineObj?.code;

  if (code) {
    // Fast regex match on "name" inside MANIFEST dictionary
    const nameMatch = code.match(/["']name["']\s*:\s*["']([^"']+)["']/);
    if (nameMatch && nameMatch[1] && nameMatch[1].trim()) {
      return nameMatch[1].trim();
    }
  }

  // Explicit object name if set
  if (engineObj?.name && typeof engineObj.name === 'string' && engineObj.name.trim()) {
    return engineObj.name.trim();
  }

  // Canonical default for built-in engines if no code yet
  if (engId === 'resource_bridge') {
    return 'resource_bridge';
  }
  if (engId === 'file_detection') {
    return 'file_detection';
  }
  if (engId === 'document_extractor') {
    return 'document_extractor';
  }
  if (engId === 'node_context_builder') {
    return 'node_context_builder';
  }

  // Fallback to unique engine ID when no name is provided
  return engId;
}

/**
 * Safely extracts the engine description from the Python MANIFEST in code,
 * falling back to a sensible default or engine description if not defined.
 *
 * @param {string} engId - Unique immutable engine identifier
 * @param {Record<string, { code?: string, desc?: string, description?: string }>} enginesData - Project engines dictionary
 * @returns {string} The resolved description
 */
export function getEngineDescription(engId, enginesData = {}) {
  if (!engId) return '';
  const engineObj = enginesData?.[engId];
  const code = engineObj?.code;

  if (code) {
    // Fast regex match on "description" inside MANIFEST dictionary
    const descMatch = code.match(/["']description["']\s*:\s*["']([^"']+)["']/);
    if (descMatch && descMatch[1] && descMatch[1].trim()) {
      return descMatch[1].trim();
    }
  }

  if (engineObj?.desc && typeof engineObj.desc === 'string' && engineObj.desc.trim()) {
    return engineObj.desc.trim();
  }
  if (engineObj?.description && typeof engineObj.description === 'string' && engineObj.description.trim()) {
    return engineObj.description.trim();
  }

  if (engId === 'resource_bridge') {
    return 'Verifies local OS cache or downloads from Cloudinary';
  }
  if (engId === 'file_detection') {
    return 'Binary and structural file inspector';
  }
  if (engId === 'document_extractor') {
    return 'Deterministic document parser with OCR & Vision escalation';
  }
  if (engId === 'node_context_builder') {
    return 'Prepares structured comparison context from two exploration nodes for relationship analysis';
  }

  return 'Custom processing engine';
}

/**
 * Extracts the full manifest definition (name, description, inputs, outputs)
 * for an engine, supporting built-in and user-defined Python engines.
 *
 * @param {string} engId - Engine identifier
 * @param {Record<string, any>} enginesData - Project engines dictionary
 * @returns {{ name: string, description: string, inputs: Record<string, any>, outputs: Record<string, any> }}
 */
export function getEngineManifest(engId, enginesData = {}) {
  if (!engId) {
    return { name: 'Engine', description: '', inputs: {}, outputs: {} };
  }

  const engineObj = enginesData?.[engId];
  const code = engineObj?.code;

  if (code) {
    const manifestMatch = code.match(/MANIFEST\s*=\s*({[\s\S]*?\n})/);
    if (manifestMatch) {
      try {
        const raw = manifestMatch[1]
          .replace(/#.*$/gm, '')
          .replace(/\bTrue\b/g, 'true')
          .replace(/\bFalse\b/g, 'false')
          .replace(/\bNone\b/g, 'null')
          .replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, '"$1"')
          .replace(/,\s*([}\]])/g, '$1');
        const parsed = JSON.parse(raw);
        return {
          name: parsed.name || getEngineDisplayName(engId, enginesData),
          description: parsed.description || getEngineDescription(engId, enginesData),
          inputs: parsed.inputs || { input: { type: 'file', description: 'Input data' } },
          outputs: parsed.outputs || { output: { type: 'json', description: 'Execution result' } },
        };
      } catch {
        // fallback
      }
    }
  }

  if (engId === 'resource_bridge') {
    return {
      name: 'Resource Bridge',
      description: 'Verifies local OS cache or downloads from Cloudinary',
      inputs: {
        file: { type: 'file', description: 'File metadata with doc_id and cloudinaryUrl' },
      },
      outputs: {
        local_path: { type: 'text', description: 'Guaranteed local file path on OS disk' },
        status: { type: 'text', description: 'cached or downloaded' },
      },
    };
  }

  if (engId === 'file_detection') {
    return {
      name: 'File Detection',
      description: 'Binary and structural file inspector',
      inputs: {
        file: { type: 'file', description: 'Uploaded raw binary stream' },
      },
      outputs: {
        category: { type: 'text', description: 'Document, image, or audio' },
        mime_type: { type: 'text', description: 'MIME format' },
        metadata: { type: 'json', description: 'Header metadata & limits' },
      },
    };
  }

  if (engId === 'document_extractor') {
    return {
      name: 'Document Extractor',
      description: 'Deterministic document parser with OCR & Vision escalation',
      inputs: {
        file: { type: 'document', description: 'PDF, DOCX, TXT, or markdown' },
      },
      outputs: {
        text: { type: 'text', description: 'Extracted raw document text' },
        pages: { type: 'json', description: 'Page breakdown & structure' },
        escalation: { type: 'json', description: 'needs_vision_model routing flag' },
      },
    };
  }

  return {
    name: getEngineDisplayName(engId, enginesData),
    description: getEngineDescription(engId, enginesData),
    inputs: { input: { type: 'text', description: 'Standard input' } },
    outputs: { output: { type: 'json', description: 'Structured JSON output' } },
  };
}


export const BUILT_IN_ENGINE_IDS = ['resource_bridge', 'file_detection', 'document_extractor', 'node_context_builder'];

/**
 * Merges engine ID lists (live state, saved project) with the built-in engines, de-duplicated.
 * Saved projects may omit built-ins, so every consumer should go through this.
 */
export function getAllEngineIds(...lists) {
  return Array.from(new Set([...BUILT_IN_ENGINE_IDS, ...lists.flat().filter(Boolean)]));
}
