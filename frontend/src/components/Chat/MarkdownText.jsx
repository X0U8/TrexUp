import React from 'react';

/**
 * Parses inline markdown:
 * - `code` -> inline code pill
 * - **bold** or __bold__ -> strong (font-weight: 500, no heavy bold)
 * - *italic* or _italic_ -> italic
 * - [text](url) -> link
 */
function renderInline(text) {
  if (!text) return null;

  // Match: `inline code`, **bold**, __bold__, *italic*, _italic_, [text](url)
  const regex = /(`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_|\[[^\]]+\]\([^)]+\))/g;
  const parts = text.split(regex);

  return parts.map((part, i) => {
    if (!part) return null;

    // Inline code: `...`
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      return (
        <code key={i} className="md-inline-code">
          {part.slice(1, -1)}
        </code>
      );
    }

    // Bold / strong: **...** or __...__
    if (
      (part.startsWith('**') && part.endsWith('**') && part.length >= 4) ||
      (part.startsWith('__') && part.endsWith('__') && part.length >= 4)
    ) {
      return (
        <span key={i} className="md-strong">
          {part.slice(2, -2)}
        </span>
      );
    }

    // Italic: *...* or _..._
    if (
      (part.startsWith('*') && part.endsWith('*') && part.length >= 2) ||
      (part.startsWith('_') && part.endsWith('_') && part.length >= 2)
    ) {
      return (
        <span key={i} className="md-em">
          {part.slice(1, -1)}
        </span>
      );
    }

    // Link: [text](url)
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      return (
        <a
          key={i}
          href={linkMatch[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="md-link"
        >
          {linkMatch[1]}
        </a>
      );
    }

    return part;
  });
}

/**
 * Safely transforms AI markdown text into rich, styled React elements.
 * Handles paragraphs, lists (bullet/numbered), blockquotes, code blocks, and inline formatting.
 */
export default function MarkdownText({ content = '' }) {
  if (!content) return null;

  // Split by code blocks first
  const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
  const blocks = [];
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      blocks.push({
        type: 'text',
        content: content.slice(lastIndex, match.index),
      });
    }
    blocks.push({
      type: 'code',
      lang: match[1],
      code: match[2],
    });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    blocks.push({
      type: 'text',
      content: content.slice(lastIndex),
    });
  }

  return (
    <div className="md-container">
      {blocks.map((block, bIdx) => {
        if (block.type === 'code') {
          return (
            <div key={bIdx} className="md-code-block-wrap">
              {block.lang && <div className="md-code-block-lang">{block.lang}</div>}
              <pre className="md-pre">
                <code>{block.code}</code>
              </pre>
            </div>
          );
        }

        // Process lines in text block
        const lines = block.content.split('\n');
        const elements = [];
        let currentList = null;

        lines.forEach((line) => {
          const trimmed = line.trim();

          // Bullet list: - or *
          const bulletMatch = line.match(/^(\s*)[-*]\s+(.+)$/);
          if (bulletMatch) {
            if (!currentList || currentList.type !== 'ul') {
              currentList = { type: 'ul', items: [] };
              elements.push(currentList);
            }
            currentList.items.push(bulletMatch[2]);
            return;
          }

          // Numbered list: 1.
          const numMatch = line.match(/^(\s*)\d+\.\s+(.+)$/);
          if (numMatch) {
            if (!currentList || currentList.type !== 'ol') {
              currentList = { type: 'ol', items: [] };
              elements.push(currentList);
            }
            currentList.items.push(numMatch[2]);
            return;
          }

          currentList = null;

          if (!trimmed) {
            elements.push({ type: 'break' });
            return;
          }

          // Headers
          if (trimmed.startsWith('### ')) {
            elements.push({ type: 'h3', content: trimmed.slice(4) });
            return;
          }
          if (trimmed.startsWith('## ')) {
            elements.push({ type: 'h2', content: trimmed.slice(3) });
            return;
          }
          if (trimmed.startsWith('# ')) {
            elements.push({ type: 'h1', content: trimmed.slice(2) });
            return;
          }

          // Blockquote
          if (trimmed.startsWith('> ')) {
            elements.push({ type: 'quote', content: trimmed.slice(2) });
            return;
          }

          // Regular paragraph
          elements.push({ type: 'p', content: line });
        });

        return (
          <div key={bIdx} className="md-text-block">
            {elements.map((el, elIdx) => {
              if (el.type === 'break') {
                return <div key={elIdx} className="md-line-gap" />;
              }
              if (el.type === 'ul') {
                return (
                  <ul key={elIdx} className="md-ul">
                    {el.items.map((it, iIdx) => (
                      <li key={iIdx} className="md-li">
                        {renderInline(it)}
                      </li>
                    ))}
                  </ul>
                );
              }
              if (el.type === 'ol') {
                return (
                  <ol key={elIdx} className="md-ol">
                    {el.items.map((it, iIdx) => (
                      <li key={iIdx} className="md-li">
                        {renderInline(it)}
                      </li>
                    ))}
                  </ol>
                );
              }
              if (el.type === 'h1' || el.type === 'h2' || el.type === 'h3') {
                return (
                  <div key={elIdx} className={`md-${el.type}`}>
                    {renderInline(el.content)}
                  </div>
                );
              }
              if (el.type === 'quote') {
                return (
                  <blockquote key={elIdx} className="md-quote">
                    {renderInline(el.content)}
                  </blockquote>
                );
              }
              return (
                <p key={elIdx} className="md-p">
                  {renderInline(el.content)}
                </p>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
