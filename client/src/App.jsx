import { useState, useEffect, useRef, useCallback } from "react";
import Sidebar from "./components/Sidebar";
import ChatArea from "./components/ChatArea";
import InputBar from "./components/InputBar";
import StarField from "./components/StarField";
import WaveHero from "./components/WaveHero";
import { createConversation } from "./utils/conversations";

// Create the initial conversation once, outside component to avoid double-init
const INITIAL_CONV = createConversation();

export default function App() {
  const [conversations, setConversations] = useState([INITIAL_CONV]);
  const [activeId, setActiveId] = useState(INITIAL_CONV.id);
  const [sidebarOpen, setSidebarOpen] = useState(false); // default closed on mobile
  const [isLoading, setIsLoading] = useState(false);
  const chatRef = useRef(null);

  // Open sidebar by default only on desktop
  useEffect(() => {
    if (window.innerWidth >= 640) setSidebarOpen(true);
  }, []);

  const activeConv = conversations.find((c) => c.id === activeId);

  const updateMessages = useCallback((convId, updater) => {
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== convId) return c;
        const messages =
          typeof updater === "function" ? updater(c.messages) : updater;
        const firstUser = messages.find((m) => m.from === "user");
        return {
          ...c,
          messages,
          title: firstUser
            ? firstUser.content.slice(0, 30) +
              (firstUser.content.length > 30 ? "…" : "")
            : c.title,
        };
      }),
    );
  }, []);

  const newConversation = () => {
    // Check if there's already an empty new conversation
    const hasEmpty = conversations.some(
      (c) => c.title === "New conversation" && c.messages.length === 0,
    );
    if (hasEmpty) {
      // Just switch to the existing empty one
      const empty = conversations.find(
        (c) => c.title === "New conversation" && c.messages.length === 0,
      );
      setActiveId(empty.id);
    } else {
      const c = createConversation();
      setConversations((prev) => [c, ...prev]);
      setActiveId(c.id);
    }
    // Close sidebar on mobile after selecting
    if (window.innerWidth < 640) setSidebarOpen(false);
  };

  const handleSelect = (id) => {
    setActiveId(id);
    if (window.innerWidth < 640) setSidebarOpen(false);
  };

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatRef.current) {
      setTimeout(() => {
        chatRef.current?.scrollTo({
          top: chatRef.current.scrollHeight,
          behavior: "smooth",
        });
      }, 80);
    }
  }, [activeConv?.messages?.length]);

  const handleSend = async (input, fileContent, fileName) => {
    if (!input.trim() || isLoading || !activeId) return;
    const convId = activeId;

    const userMsg = {
      id: crypto.randomUUID(),
      from: "user",
      content: input,
      status: "success",
      hasFile: !!fileContent,
      fileName,
    };
    const aiMsg = {
      id: crypto.randomUUID(),
      from: "ai",
      content: "",
      status: "loading",
    };

    updateMessages(convId, (msgs) => [...msgs, userMsg, aiMsg]);
    setIsLoading(true);

    try {
      const res = await fetch("https://graphy-server.vercel.app/api/chart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: input, fileContent }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Server error ${res.status}`);
      }

      const config = await res.json();

      updateMessages(convId, (msgs) =>
        msgs.map((m) =>
          m.id === aiMsg.id ? { ...m, content: config, status: "success" } : m,
        ),
      );
    } catch (err) {
      updateMessages(convId, (msgs) =>
        msgs.map((m) =>
          m.id === aiMsg.id
            ? {
                ...m,
                content: err.message || "Failed to generate chart",
                status: "error",
              }
            : m,
        ),
      );
    } finally {
      setIsLoading(false);
    }
  };

  const hasMessages = activeConv?.messages?.length > 0;

  return (
    <>
      <StarField />
      <div className="app-shell">
        {/* Mobile backdrop */}
        {sidebarOpen && (
          <div
            className="sidebar-backdrop"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {sidebarOpen && (
          <Sidebar
            conversations={conversations}
            activeId={activeId}
            onSelect={handleSelect}
            onNew={newConversation}
            onClose={() => setSidebarOpen(false)}
          />
        )}

        <div className="main">
          {/* Topbar */}
          <div className="topbar">
            {!sidebarOpen && (
              <button
                className="icon-btn"
                onClick={() => setSidebarOpen(true)}
                aria-label="Open sidebar"
              >
                <MenuIcon />
              </button>
            )}
            <span className="topbar-title">
              {activeConv?.title || "Graph AI"}
            </span>
          </div>

          {/* Chat */}
          <div className="chat-area" ref={chatRef}>
            {!hasMessages ? (
              <WaveHero />
            ) : (
              <ChatArea messages={activeConv.messages} />
            )}
          </div>

          {/* Input */}
          <InputBar onSend={handleSend} isLoading={isLoading} />
        </div>
      </div>
    </>
  );
}

function MenuIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}
