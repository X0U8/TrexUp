import { NODE_LIFECYCLE_DEFINITIONS } from '../../tools/nodeLifecycleTools';
import './ToolsPage.css';

const CATEGORY_MAP = {
  list_explorations: 'Discovery',
  search_nodes: 'Inspection',
  create_node: 'Lifecycle',
  get_node: 'Inspection',
  update_node: 'Modification',
  update_node_status: 'Verification',
  delete_node: 'Lifecycle',
  connect_nodes: 'Relationships',
  get_connections: 'Relationships',
  update_connection: 'Relationships',
  remove_connection: 'Relationships',
};

export default function ToolsPage() {
  return (
    <div className="tools-container">
      <div className="tools-content-box">
        <div className="tools-header-block">
          <h2 className="tools-heading">Investigation Tools</h2>
          <p className="tools-subheading">
            Predefined workspace actions the AI calls to inspect, structure, and verify the investigation graph.
          </p>
        </div>

        <div className="tools-table">
          <div className="tools-table-head">
            <span className="col-name">Tool</span>
            <span className="col-category">Category</span>
            <span className="col-desc">Purpose</span>
            <span className="col-params">Parameters</span>
          </div>

          <div className="tools-table-body">
            {NODE_LIFECYCLE_DEFINITIONS.map((tool) => {
              const category = CATEGORY_MAP[tool.name] || 'General';
              const props = tool.parameters?.properties || {};
              const requiredList = tool.parameters?.required || [];
              const paramKeys = Object.keys(props);

              return (
                <div key={tool.name} className="tools-table-row">
                  {/* Tool Name */}
                  <div className="col-name">
                    <code className="tool-code-name">{tool.name}</code>
                  </div>

                  {/* Category */}
                  <div className="col-category">
                    <span className="tool-category-badge">{category}</span>
                  </div>

                  {/* Purpose / Description */}
                  <div className="col-desc">
                    <p className="tool-desc-text">{tool.description}</p>
                  </div>

                  {/* Parameters */}
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
      </div>
    </div>
  );
}
