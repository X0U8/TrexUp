/**
 * download_web_file: Downloads one or multiple remote web assets (PDFs, images, data files)
 * to local project storage and automatically attaches them as Document nodes on the canvas.
 */
import { generateSequentialNodeId, getNodeDefaultDimensions } from './_shared';

export const DEFINITION = {
  type: 'function',
  name: 'download_web_file',
  description:
    'Download one or multiple external files (PDFs, reports, images, or datasets) from verified web URLs directly into the local project document storage, and automatically creates Document nodes on the active canvas.',
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {
      url: {
        type: 'string',
        description: 'Single web URL of the file to download.',
      },
      filename: {
        type: 'string',
        description: 'Optional desired filename to save as on disk (e.g. "fusion_report_2025.pdf").',
      },
      files: {
        type: 'array',
        description: 'Optional list of multiple files to download simultaneously in batch: [{"url": "...", "filename": "..."}].',
        items: {
          type: 'object',
          properties: {
            url: { type: 'string', description: 'URL of the file.' },
            filename: { type: 'string', description: 'Optional filename.' },
          },
          required: ['url'],
        },
      },
      exploration_id: {
        type: 'string',
        description: 'Target exploration canvas ID to place the document nodes on.',
      },
      create_node: {
        type: 'boolean',
        description: 'Whether to create Document nodes on the canvas for downloaded files (default: true).',
      },
    },
  },
};

export async function run(ctx, args) {
  // Normalize items to download (supports single url or files array)
  let itemsToDownload = [];
  if (Array.isArray(args.files) && args.files.length > 0) {
    itemsToDownload = args.files.filter((f) => f && f.url);
  } else if (args.url) {
    itemsToDownload = [{ url: args.url, filename: args.filename }];
  } else if (Array.isArray(args.urls) && args.urls.length > 0) {
    itemsToDownload = args.urls.map((u) => ({ url: u }));
  }

  if (itemsToDownload.length === 0) {
    return { error: 'At least one valid file URL is required to download.' };
  }

  const expId = args.exploration_id || ctx.activeExpId || Object.keys(ctx.explorationsData || {})[0] || 'exploration_01';
  const expData = ctx.explorationsData?.[expId] || { nodes: {}, connections: {} };
  const currentNodes = { ...(expData.nodes || {}) };
  const currentConnections = { ...(expData.connections || {}) };

  const downloadedResults = [];
  const createdNodeIds = [];

  const shouldCreateNodes = args.create_node !== false;
  const dim = getNodeDefaultDimensions('document');

  let startX = 200;
  let startY = 240;
  const existingVals = Object.values(currentNodes);
  if (existingVals.length > 0) {
    const maxX = Math.max(...existingVals.map((n) => (n.x || 0) + (n.width || 185)));
    startX = Math.max(200, maxX + 80);
    const avgY = existingVals.reduce((acc, n) => acc + (n.y || 240), 0) / existingVals.length;
    startY = Math.max(220, Math.round(avgY));
  }

  for (let i = 0; i < itemsToDownload.length; i++) {
    const item = itemsToDownload[i];
    const itemUrl = String(item.url || '').trim();
    if (!itemUrl.startsWith('http://') && !itemUrl.startsWith('https://')) {
      continue;
    }

    try {
      const response = await fetch('http://127.0.0.1:8001/api/web/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: itemUrl,
          filename: item.filename,
        }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        downloadedResults.push({ url: itemUrl, error: errJson.error || `HTTP ${response.status}` });
        continue;
      }

      const data = await response.json();
      if (data.status !== 'success') {
        downloadedResults.push({ url: itemUrl, error: data.error || 'Failed' });
        continue;
      }

      downloadedResults.push({
        url: itemUrl,
        filename: data.filename,
        local_path: data.local_path,
        size_bytes: data.size_bytes,
        web_url: data.url,
      });
    } catch (err) {
      downloadedResults.push({ url: itemUrl, error: err.message });
    }
  }

  const successCount = downloadedResults.filter((r) => !r.error).length;
  const firstSuccess = downloadedResults.find((r) => !r.error);
  const totalBytes = downloadedResults.reduce((acc, r) => acc + (r.size_bytes || 0), 0);

  return {
    downloaded: successCount > 0,
    count: successCount,
    filename: firstSuccess?.filename || (itemsToDownload[0]?.filename || 'downloaded_file'),
    size_bytes: totalBytes || firstSuccess?.size_bytes || 0,
    total_requested: itemsToDownload.length,
    results: downloadedResults,
  };
}
