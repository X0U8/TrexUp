import { NODE_LIFECYCLE_DEFINITIONS } from '../../tools/nodeLifecycleTools';
import { ENGINE_TOOL_DEFINITIONS } from '../../tools/engine';
import './ToolsPage.css';

const CATEGORY_MAP = {
  list_explorations: 'Discovery',
  search_nodes: 'Inspection',
  create_node: 'Lifecycle',
  create_nodes: 'Lifecycle',
  get_node: 'Inspection',
  update_node: 'Modification',
  update_node_status: 'Verification',
  delete_node: 'Lifecycle',
  connect_nodes: 'Relationships',
  get_connections: 'Relationships',
  update_connection: 'Relationships',
  remove_connection: 'Relationships',
  list_engines: 'Discovery',
  get_engine: 'Inspection',
  create_engine: 'Lifecycle',
  update_engine: 'Modification',
  test_engine: 'Testing',
};

const TOOL_SECTIONS = [
  {
    id: 'investigation',
    title: 'Investigation Tools',
    subtitle: 'Predefined workspace actions the AI calls to inspect, structure, and verify the investigation graph.',
    tools: NODE_LIFECYCLE_DEFINITIONS,
  },
  {
    id: 'engine',
    title: 'Engine Tools',
    subtitle: 'Let the AI create, edit, and test engines: Python scripts with a MANIFEST and run(input_data, context). Edits are exact-string replacements, not full rewrites.',
    tools: ENGINE_TOOL_DEFINITIONS,
  },
];

export default function ToolsPage() {
  return (
    <div className="tools-container">
      <div className="tools-content-box">
        {TOOL_SECTIONS.map((section) => (
          <section key={section.id} className="tools-section">
            <div className="tools-header-block">
              <h2 className="tools-heading">
                {section.title}
                <span className="tools-count">{section.tools.length}</span>
              </h2>
              <p className="tools-subheading">{section.subtitle}</p>
            </div>

            <div className="tools-table">
              <div className="tools-table-head">
                <span className="col-name">Tool</span>
                <span className="col-category">Category</span>
                <span className="col-desc">Purpose</span>
                <span className="col-params">Parameters</span>
              </div>

              <div className="tools-table-body">
                {section.tools.map((tool) => {
                  const category = CATEGORY_MAP[tool.name] || 'General';
                  const props = tool.parameters?.properties || {};
                  const requiredList = tool.parameters?.required || [];
                  const paramKeys = Object.keys(props);

                  return (
                    <div key={tool.name} className="tools-table-row">
                      <div className="col-name">
                        <code className="tool-code-name">{tool.name}</code>
                      </div>

                      <div className="col-category">
                        <span className="tool-category-badge">{category}</span>
                      </div>

                      <div className="col-desc">
                        <p className="tool-desc-text">{tool.description}</p>
                      </div>

                      <div className="col-params">
                        {paramKeys.length === 0 ? (
                          <span className="tool-param-none">None</span>
                        ) : (
                          <div className="tool-params-list">
                            {paramKeys.map((p) => {
                              const isReq = requiredList.includes(p);
                              return (
                                <span
                                  key={p}
                                  className={`tool-param-chip ${isReq ? 'required' : 'optional'}`}
                                  title={props[p]?.description || p}
                                >
                                  {p}
                                  {isReq && <span className="req-star">*</span>}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
