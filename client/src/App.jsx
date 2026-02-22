import { useState, useEffect, useRef, useCallback } from "react";
import Sidebar from "./components/Sidebar";
import ChatArea from "./components/ChatArea";
import InputBar from "./components/InputBar";
import StarField from "./components/StarField";
import WaveHero from "./components/WaveHero";
import { createConversation } from "./utils/conversations";

export default function App() {
  const [conversations, setConversations] = useState(() => {
    const first = createConversation();
    return [first];
  });
  const [activeId, setActiveId] = useState(() => {
    const first = createConversation();
    setConversations([first]);
    return first.id;
  });
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const chatRef = useRef(null);

  // Fix double-init from useState lazy
  useEffect(() => {
    const first = createConversation();
    setConversations([first]);
    setActiveId(first.id);
  }, []);

  const activeConv = conversations.find((c) => c.id === activeId);

  const updateMessages = useCallback((convId, updater) => {
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== convId) return c;
        const messages = typeof updater === "function" ? updater(c.messages) : updater;
        const firstUser = messages.find((m) => m.from === "user");
        return {
          ...c,
          messages,
          title: firstUser
            ? firstUser.content.slice(0, 30) + (firstUser.content.length > 30 ? "…" : "")
            : c.title,
        };
      })
    );
  }, []);

  const newConversation = () => {

    if (conversations.map((c) => c.title).includes("New conversation")) {

      alert("Please rename or delete the existing 'New conversation' before creating another.");
    }else{
      const c = createConversation();
      setConversations((prev) => [c, ...prev]);
      setActiveId(c.id);
    }
  };

  // Auto-scroll
  useEffect(() => {
    if (chatRef.current) {
      setTimeout(
        () => chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" }),
        80
      );
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
    const aiMsg = { id: crypto.randomUUID(), from: "ai", content: "", status: "loading" };

    updateMessages(convId, (msgs) => [...msgs, userMsg, aiMsg]);
    setIsLoading(true);

    try {
      const res = await fetch("http://localhost:3001/api/chart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: input, fileContent }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Server error");
      }

      const config = await res.json();

      updateMessages(convId, (msgs) =>
        msgs.map((m) => (m.id === aiMsg.id ? { ...m, content: config, status: "success" } : m))
      );
    } catch (err) {
      updateMessages(convId, (msgs) =>
        msgs.map((m) =>
          m.id === aiMsg.id
            ? { ...m, content: err.message || "Failed to generate chart", status: "error" }
            : m
        )
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
        {sidebarOpen && (
          <Sidebar
            conversations={conversations}
            activeId={activeId}
            onSelect={setActiveId}
            onNew={newConversation}
            onClose={() => setSidebarOpen(false)}
          />
        )}

        <div className="main">
          {/* Topbar */}
          <div className="topbar">
            {!sidebarOpen && (
              <button className="icon-btn" onClick={() => setSidebarOpen(true)}>
                <MenuIcon />
              </button>
            )}
            <span className="topbar-title">{activeConv?.title || "Graph AI"}</span>
          </div>

          {/* Chat */}
          <div className="chat-area" ref={chatRef}>
            {!hasMessages ? <WaveHero /> : <ChatArea messages={activeConv.messages} />}
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
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}
