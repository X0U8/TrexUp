import { useEffect, useRef } from 'react';
import { EditorView, basicSetup } from 'codemirror';
import { python } from '@codemirror/lang-python';
import { keymap } from '@codemirror/view';
import { indentWithTab } from '@codemirror/commands';
import { EditorState } from '@codemirror/state';
import { linter, lintGutter } from '@codemirror/lint';
import { syntaxTree } from '@codemirror/language';

// Real-time browser-based Python syntax and contract linter
const pythonBrowserLinter = linter((view) => {
  const diagnostics = [];
  const doc = view.state.doc;
  const code = doc.toString();

  // 1. Lezer Incremental AST Syntax Errors
  try {
    const tree = syntaxTree(view.state);
    tree.iterate({
      enter: (node) => {
        if (node.type.isError) {
          const from = node.from;
          const to = Math.max(node.to, node.from + 1);
          const line = doc.lineAt(from);
          diagnostics.push({
            from,
            to,
            severity: 'error',
            message: `Syntax error on line ${line.number}: invalid syntax or unexpected token`,
          });
        }
      },
    });
  } catch {
    // Graceful fallback if AST traversal is interrupted
  }

  // 2. Engine Contract Rule Validation (Defines def run(...) entry point)
  if (!code.match(/def\s+run\s*\([^)]*\)/)) {
    diagnostics.push({
      from: 0,
      to: Math.min(code.length, 30),
      severity: 'warning',
      message: 'Missing engine entry point: def run(input_data, context=None)',
    });
  }

  return diagnostics;
}, { delay: 250 });

const trexTheme = EditorView.theme({
  '&': {
    height: '100%',
    width: '100%',
    fontSize: '13px',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    backgroundColor: '#ffffff',
    color: '#0f172a',
    userSelect: 'text',
    WebkitUserSelect: 'text',
  },
  '.cm-content': {
    padding: '16px 0',
    caretColor: '#0f172a',
    userSelect: 'text',
    WebkitUserSelect: 'text',
  },
  '.cm-line': {
    padding: '0 16px',
    lineHeight: '1.6',
  },
  '&.cm-focused': {
    outline: 'none',
  },
  '.cm-gutters': {
    backgroundColor: '#fafbfc',
    color: '#94a3b8',
    borderRight: '1px solid #f1f5f9',
    paddingRight: '8px',
    userSelect: 'none',
  },
  '.cm-activeLine': {
    backgroundColor: '#f8fafc',
  },
  '.cm-activeLineGutter': {
    backgroundColor: '#f8fafc',
    color: '#1e293b',
    fontWeight: '500',
  },
  '.cm-selectionMatch': {
    backgroundColor: '#e2e8f080',
  },
  '&.cm-focused .cm-cursor': {
    borderLeftColor: '#0f172a',
  },
  '&.cm-focused .cm-selectionBackground, ::selection': {
    backgroundColor: '#dbeafe',
  },
  '.cm-scroller': {
    overflow: 'auto',
    fontFamily: 'inherit',
  },
  // Sleek lint error squigglies and tooltips
  '.cm-lintRange-error': {
    backgroundImage: `url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='6' height='3'%3E%3Cpath d='m0 3 l3 -3 l3 3' stroke='%23ef4444' fill='none' stroke-width='1.2'/%3E%3C/svg%3E")`,
    backgroundPosition: 'left bottom',
    backgroundRepeat: 'repeat-x',
    paddingBottom: '2px',
  },
  '.cm-lintRange-warning': {
    backgroundImage: `url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='6' height='3'%3E%3Cpath d='m0 3 l3 -3 l3 3' stroke='%23f59e0b' fill='none' stroke-width='1.2'/%3E%3C/svg%3E")`,
    backgroundPosition: 'left bottom',
    backgroundRepeat: 'repeat-x',
    paddingBottom: '2px',
  },
  '.cm-lint-marker': {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    marginLeft: '2px',
  },
  '.cm-lint-marker-error': {
    backgroundColor: '#ef4444',
  },
  '.cm-lint-marker-warning': {
    backgroundColor: '#f59e0b',
  },
  '.cm-tooltip-lint': {
    backgroundColor: '#1e293b',
    color: '#f8fafc',
    border: '1px solid #334155',
    borderRadius: '6px',
    padding: '6px 10px',
    fontSize: '11.5px',
    boxShadow: '0 8px 16px rgba(0,0,0,0.15)',
  },
});

export default function EngineCodeEditor({ value, onChange }) {
  const containerRef = useRef(null);
  const viewRef = useRef(null);
  const isInternalChangeRef = useRef(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!containerRef.current) return;

    const startState = EditorState.create({
      doc: value || '',
      extensions: [
        basicSetup,
        python(),
        keymap.of([indentWithTab]),
        lintGutter(),
        pythonBrowserLinter,
        trexTheme,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            isInternalChangeRef.current = true;
            const nextVal = update.state.doc.toString();
            onChangeRef.current?.(nextVal);
            setTimeout(() => {
              isInternalChangeRef.current = false;
            }, 20);
          }
        }),
      ],
    });

    const view = new EditorView({
      state: startState,
      parent: containerRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  // Sync external changes (e.g. switching engine tab) without interrupting typing
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    if (isInternalChangeRef.current) return;

    const currentDoc = view.state.doc.toString();
    if (value !== undefined && value !== null && value !== currentDoc) {
      view.dispatch({
        changes: {
          from: 0,
          to: currentDoc.length,
          insert: value,
        },
      });
    }
  }, [value]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        userSelect: 'text',
        WebkitUserSelect: 'text',
      }}
    />
  );
}
