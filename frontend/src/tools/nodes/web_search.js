/**
 * web_search: Live web search grounding using Meta AI Responses API.
 * Retrieves real-time cited facts, synthesis, and verified URLs.
 * Can automatically create canvas finding nodes (strictly NO CODE).
 */
import { generateSequentialNodeId, generateSequentialThreadId, getNodeDefaultDimensions } from './_shared';

export const DEFINITION = {
  type: 'function',
  name: 'web_search',
  description:
    'Search the live web using Meta AI Search Grounding. Retrieves real-time information, research, and citations with verified URLs. If create_nodes is true (or requested), automatically creates visual finding nodes on the active canvas with source links in plain English (strictly NO CODE).',
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {
      query: {
        type: 'string',
        description: 'The search query or topic to search live on the internet.',
      },
      search_context_size: {
        type: 'string',
        enum: ['low', 'medium', 'high'],
        description: 'Context size: low (fastest), medium (balanced, default), high (comprehensive research).',
      },
      create_nodes: {
        type: 'boolean',
        description: 'If true, automatically creates canvas finding nodes for each verified fact with source links (strictly plain text, NO CODE).',
      },
      exploration_id: {
        type: 'string',
        description: 'Target exploration canvas ID (e.g. "exploration_01").',
      },
    },
    required: ['query'],
  },
};

export async function run(ctx, args) {
  const query = String(args.query || '').trim();
  if (!query) {
    return { error: 'Search query is required' };
  }

  const expId = args.exploration_id || ctx.activeExpId || Object.keys(ctx.explorationsData || {})[0] || 'exploration_01';
  const expData = ctx.explorationsData?.[expId] || { nodes: {}, connections: {} };
  const currentNodes = { ...(expData.nodes || {}) };
  const currentConnections = { ...(expData.connections || {}) };

  try {
    const response = await fetch('http://127.0.0.1:8001/api/web/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        search_context_size: args.search_context_size || 'medium',
      }),
    });

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      return { error: errJson.error || `Web search request failed with status ${response.status}` };
    }

    const data = await response.json();
    if (data.status !== 'success') {
      return { error: data.error || 'Web search failed' };
    }

    const answer = data.answer || '';
    const citations = Array.isArray(data.citations) ? data.citations : [];
    const shouldCreateNodes = args.create_nodes === true;

    const createdNodeIds = [];
    if (shouldCreateNodes && citations.length > 0) {
      // Find starting position
      let startX = 400;
      let startY = 240;
      const existingVals = Object.values(currentNodes);
      if (existingVals.length > 0) {
        const maxX = Math.max(...existingVals.map((n) => (n.x || 0) + (n.width || 185)));
        startX = Math.max(360, maxX + 100);
        const avgY = existingVals.reduce((acc, n) => acc + (n.y || 240), 0) / existingVals.length;
        startY = Math.max(220, Math.round(avgY));
      }

      // Limit auto-created finding nodes to top 4 key citations to avoid canvas clutter
      const topCitations = citations.slice(0, 4);

      topCitations.forEach((cit, index) => {
        const nodeId = generateSequentialNodeId(currentNodes, 'finding');
        const dim = getNodeDefaultDimensions('finding');
        const title = cit.title && cit.title.length > 60 ? `${cit.title.slice(0, 57)}...` : (cit.title || `Finding ${index + 1}`);
        const passage = cit.passage || '';
        const desc = passage
          ? `${passage}\n\nSource: ${cit.title || cit.url}\nURL: ${cit.url}`
          : `Grounded finding regarding "${query}".\n\nSource: ${cit.title || cit.url}\nURL: ${cit.url}`;

        const newNode = {
          id: nodeId,
          title,
          description: desc,
          type: 'finding',
          category: 'finding',
          status: 'verified',
          x: startX,
          y: startY + index * (dim.height + 60),
          width: dim.width,
          height: dim.height,
          sourceDoc: cit.title || cit.url,
          url: cit.url,
          metadata: {
            url: cit.url,
            title: cit.title,
            source: 'web_search',
            query,
            verified: true,
          },
          autoLayout: true,
        };

        currentNodes[nodeId] = newNode;
        createdNodeIds.push(nodeId);
      });
    }

    return {
      searched: true,
      query,
      answer,
      citation_count: citations.length,
      citations: citations.slice(0, 8),
      created_nodes_count: createdNodeIds.length,
      created_node_ids: createdNodeIds,
      updatedNodes: createdNodeIds.length > 0 ? currentNodes : undefined,
      updatedConnections: createdNodeIds.length > 0 ? currentConnections : undefined,
    };
  } catch (err) {
    return { error: `Failed to connect to local server for web search: ${err.message}` };
  }
}
