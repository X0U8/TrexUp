import { useState, useEffect } from 'react';
import './ThreadConditionModal.css';

export const OPERATORS = [
  { value: '==', label: '==' },
  { value: '!=', label: '!=' },
  { value: '>', label: '>' },
  { value: '>=', label: '>=' },
  { value: '<', label: '<' },
  { value: '<=', label: '<=' },
  { value: 'in', label: 'in' },
  { value: 'not in', label: 'not in' },
  { value: 'is', label: 'is' },
  { value: 'is not', label: 'is not' },
  { value: 'startswith', label: 'startswith' },
  { value: 'endswith', label: 'endswith' },
];

export function compileRulesToExpression(rules) {
  if (!rules || rules.length === 0) return '';
  const valid = rules.filter((r) => r.field && r.field.trim());
  if (valid.length === 0) return '';

  const clauses = valid.map((r) => {
    const f = r.field.trim();
    const op = r.op || '==';
    let val = (r.value ?? '').trim();
    if (val === '') val = "''";

    if (op === 'contains') {
      return `${val} in ${f}`;
    } else if (op === 'startswith') {
      return `${f}.startswith(${val})`;
    } else if (op === 'endswith') {
      return `${f}.endswith(${val})`;
    } else {
      return `${f} ${op} ${val}`;
    }
  });

  if (clauses.length === 1) return clauses[0];

  const hasAnd = valid.slice(0, -1).some((r) => (r.logic || 'and').toLowerCase() === 'and');
  const hasOr = valid.slice(0, -1).some((r) => (r.logic || 'and').toLowerCase() === 'or');

  // If not mixed (pure ANDs or pure ORs), format linearly without brackets
  if (!hasAnd || !hasOr) {
    let res = clauses[0];
    for (let i = 1; i < clauses.length; i++) {
      const logic = (valid[i - 1]?.logic || 'and').toLowerCase();
      res += ` ${logic} ${clauses[i]}`;
    }
    return res;
  }

  // If mixed AND and OR, group AND blocks in brackets for unambiguous precedence
  const orGroups = [];
  let currentGroup = [clauses[0]];

  for (let i = 1; i < clauses.length; i++) {
    const prevLogic = (valid[i - 1]?.logic || 'and').toLowerCase();
    if (prevLogic === 'or') {
      orGroups.push(currentGroup);
      currentGroup = [clauses[i]];
    } else {
      currentGroup.push(clauses[i]);
    }
  }
  orGroups.push(currentGroup);

  return orGroups
    .map((grp) => (grp.length > 1 ? `(${grp.join(' and ')})` : grp[0]))
    .join(' or ');
}

export function parseExpressionToRules(expr = '') {
  const clean = expr.trim();
  if (!clean || clean.toLowerCase() === 'always') return [];

  // Strip outer group brackets for cleaner rule parsing
  const unbracketed = clean.replace(/^\((.*)\)$/, '$1');
  const parts = unbracketed.split(/\s+(and|or)\s+/i);
  const rules = [];

  for (let i = 0; i < parts.length; i += 2) {
    let clause = parts[i]?.trim();
    const logic = (parts[i + 1] || 'and').toLowerCase();
    if (!clause) continue;

    clause = clause.replace(/^\((.*)\)$/, '$1').trim();

    const ops = ['not in', '==', '!=', '>=', '<=', '>', '<', 'in', 'is not', 'is'];
    let matched = false;

    const swMatch = clause.match(/^(\w+)\.startswith\((.*)\)$/);
    if (swMatch) {
      rules.push({ field: swMatch[1], op: 'startswith', value: swMatch[2], logic });
      continue;
    }
    const ewMatch = clause.match(/^(\w+)\.endswith\((.*)\)$/);
    if (ewMatch) {
      rules.push({ field: ewMatch[1], op: 'endswith', value: ewMatch[2], logic });
      continue;
    }

    for (const op of ops) {
      const regex = new RegExp(`^([\\w.]+)\\s+${op.replace(/\s+/g, '\\s+')}\\s+(.*)$`);
      const m = clause.match(regex);
      if (m) {
        rules.push({ field: m[1], op, value: m[2], logic });
        matched = true;
        break;
      }
    }

    if (!matched) {
      rules.push({ field: clause, op: '==', value: 'True', logic });
    }
  }

  return rules.length > 0 ? rules : [{ field: '', op: '==', value: '', logic: 'AND' }];
}

export function evaluateThreadCondition(condition, outputPayload = {}) {
  if (!condition || !condition.trim() || condition.trim().toLowerCase() === 'always') {
    return true;
  }
  try {
    let jsExpr = condition
      .replace(/\band\b/gi, '&&')
      .replace(/\bor\b/gi, '||')
      .replace(/\bnot\b/gi, '!')
      .replace(/\bTrue\b/g, 'true')
      .replace(/\bFalse\b/g, 'false')
      .replace(/\bNone\b/g, 'null')
      .replace(/(\w+)\.startswith\(([^)]+)\)/g, 'String($1).startsWith($2)')
      .replace(/(\w+)\.endswith\(([^)]+)\)/g, 'String($1).endsWith($2)')
      .replace(/([^\s]+)\s+in\s+([^\s&|]+)/g, '($2 && (Array.isArray($2) ? $2.includes($1) : String($2).includes(String($1))))');

    const keys = Object.keys(outputPayload);
    const values = Object.values(outputPayload);
    const fn = new Function(...keys, `return Boolean(${jsExpr});`);
    return Boolean(fn(...values));
  } catch {
    return false;
  }
}

export default function ThreadConditionModal({
  isOpen,
  thread,
  fromNode,
  toNode,
  onClose,
  onSaveCondition,
  onDeleteThread,
}) {
  const [rules, setRules] = useState([
    { field: '', op: '==', value: '', logic: 'AND' },
  ]);

  useEffect(() => {
    if (thread) {
      const initial = parseExpressionToRules(thread.condition || '');
      setRules(
        initial.length > 0
          ? initial
          : [{ field: '', op: '==', value: '', logic: 'AND' }]
      );
    }
  }, [thread, isOpen]);

  if (!isOpen || !thread) return null;

  const compiledExpr = compileRulesToExpression(rules);

  const handleRuleChange = (index, key, val) => {
    setRules((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [key]: val };
      return copy;
    });
  };

  const handleToggleLogic = (index) => {
    setRules((prev) => {
      const copy = [...prev];
      const current = copy[index].logic || 'AND';
      copy[index] = { ...copy[index], logic: current === 'AND' ? 'OR' : 'AND' };
      return copy;
    });
  };

  const handleAddClause = (logicType = 'AND') => {
    setRules((prev) => {
      const copy = [...prev];
      if (copy.length > 0) {
        copy[copy.length - 1] = { ...copy[copy.length - 1], logic: logicType };
      }
      return [...copy, { field: '', op: '==', value: '', logic: 'AND' }];
    });
  };

  const handleRemoveClause = (index) => {
    setRules((prev) => {
      if (prev.length <= 1) {
        return [{ field: '', op: '==', value: '', logic: 'AND' }];
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleSave = () => {
    onSaveCondition?.(thread.id, compiledExpr.trim());
    onClose();
  };

  const handleDelete = () => {
    onDeleteThread?.(thread.id, thread.from, thread.to);
    onClose();
  };

  const formatNodeLabel = (node, fallback) => {
    if (!node) return fallback;
    if (node.type === 'engine') {
      return node.engineId || node.sub || node.title || fallback;
    }
    return node.title || node.id || fallback;
  };

  const fromLabel = formatNodeLabel(fromNode, thread.from || 'Source');
  const toLabel = formatNodeLabel(toNode, thread.to || 'Target');

  return (
    <div className="thread-cond-backdrop" onClick={onClose}>
      <div className="thread-cond-card" onClick={(e) => e.stopPropagation()}>
        {/* Header with Clean Mini Mode Connection (Unboxed, No Dots) */}
        <div className="thread-cond-header">
          <div className="thread-cond-title-block">
            <div className="thread-cond-meta-wrap">
              <h3 className="thread-cond-title">Branch Condition</h3>
              {thread?.id && (
                <span className="thread-cond-subid">Thread ID: {thread.id}</span>
              )}
            </div>

            <div className="mini-connection-stage">
              <div className="mini-node-card">
                <span className="mini-node-name">{fromLabel}</span>
              </div>

              <svg width="24" height="12" viewBox="0 0 24 12" className="mini-wire-svg">
                <line x1="2" y1="6" x2="19" y2="6" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
                <polyline points="15,2 19,6 15,10" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>

              <div className="mini-node-card">
                <span className="mini-node-name">{toLabel}</span>
              </div>
            </div>
          </div>

          <button type="button" className="thread-cond-close-btn" onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="thread-cond-body">
          <p className="thread-cond-hint">
            Execution proceeds down this thread when conditions match. If they fail, this branch skips cleanly.
          </p>

          {/* Dynamic Clauses List */}
          <div className="thread-clauses-container">
            {rules.map((rule, idx) => (
              <div key={idx} className="thread-clause-block">
                {idx > 0 && (
                  <div className="thread-logic-connector">
                    <button
                      type="button"
                      className={`thread-logic-tag ${(rules[idx - 1]?.logic || 'AND').toLowerCase()}`}
                      onClick={() => handleToggleLogic(idx - 1)}
                      title="Click to toggle between AND / OR"
                    >
                      {rules[idx - 1]?.logic || 'AND'}
                    </button>
                    <div className="thread-connector-line" />
                  </div>
                )}

                <div className="thread-clause-row">
                  {/* Left: Input Field (Clean text input, no dropdown) */}
                  <div className="clause-col col-field">
                    <label className="clause-sublabel">Field</label>
                    <input
                      type="text"
                      className="clause-input field-input"
                      placeholder="e.g. category"
                      value={rule.field}
                      onChange={(e) => handleRuleChange(idx, 'field', e.target.value)}
                    />
                  </div>

                  {/* Center: Operator Select */}
                  <div className="clause-col col-op">
                    <label className="clause-sublabel">Operator</label>
                    <select
                      className="clause-select op-select"
                      value={rule.op || '=='}
                      onChange={(e) => handleRuleChange(idx, 'op', e.target.value)}
                    >
                      {OPERATORS.map((op) => (
                        <option key={op.value} value={op.value}>
                          {op.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Right: Value Input */}
                  <div className="clause-col col-val">
                    <label className="clause-sublabel">Value</label>
                    <input
                      type="text"
                      className="clause-input val-input"
                      placeholder="e.g. 'image', 50, True"
                      value={rule.value}
                      onChange={(e) => handleRuleChange(idx, 'value', e.target.value)}
                    />
                  </div>

                  {/* Delete Clause Action */}
                  {rules.length > 1 && (
                    <button
                      type="button"
                      className="clause-remove-btn"
                      onClick={() => handleRemoveClause(idx)}
                      title="Remove this condition"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Add Clause Action Buttons: AND / OR */}
          <div className="thread-add-clause-row">
            <span className="add-clause-prompt">Add Condition:</span>
            <div className="add-clause-btns">
              <button
                type="button"
                className="add-clause-btn and-btn"
                onClick={() => handleAddClause('AND')}
              >
                &&
              </button>
              <button
                type="button"
                className="add-clause-btn or-btn"
                onClick={() => handleAddClause('OR')}
              >
                ||
              </button>
            </div>
          </div>

          {/* Live Expression Preview */}
          <div className="thread-cond-preview">
            <span className="preview-label">Expression:</span>
            <div className="preview-pill">
              <span className={`preview-dot ${compiledExpr ? 'active' : 'always'}`} />
              <code className="preview-text">
                {compiledExpr ? compiledExpr : 'unconditional'}
              </code>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="thread-cond-footer">
          <button
            type="button"
            className="thread-btn-delete"
            onClick={handleDelete}
            title="Delete this connection between nodes"
          >
            Remove Connection
          </button>

          <div className="thread-footer-actions">
            <button type="button" className="thread-btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="thread-btn-primary" onClick={handleSave}>
              Save Condition
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
