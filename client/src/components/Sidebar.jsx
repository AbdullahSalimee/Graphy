export default function Sidebar({ conversations, activeId, onSelect, onNew, onClose }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-brand">
          <span className="brand-icon">📊</span>
          <span className="brand-name">Graph AI</span>
        </div>
        <button className="icon-btn" onClick={onClose} title="Close sidebar">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <div className="sidebar-body">
        <button className="new-chat-btn" onClick={onNew}>
          <span>+</span> New conversation
        </button>

        <div className="conv-label">History</div>

        {conversations.length === 0 && (
          <div className="conv-empty">No chats yet</div>
        )}

        {conversations.map((c) => (
          <button
            key={c.id}
            className={`conv-item ${c.id === activeId ? "active" : ""}`}
            onClick={() => onSelect(c.id)}
          >
            <span className="conv-dot" />
            {c.title}
          </button>
        ))}
      </div>
    </aside>
  );
}
