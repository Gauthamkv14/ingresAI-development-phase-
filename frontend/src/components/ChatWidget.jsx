// frontend/src/components/ChatWidget.jsx
import React, { useState } from "react";
import ChatInterface from "./ChatInterface";
import { Bot } from "lucide-react";
import "../styles/chatwidget.css";

export default function ChatWidget() {
  const [open, setOpen] = useState(false);

  return (
    <div className="chat-widget">
      {open && (
        <div className="chat-panel">
          <ChatInterface />
        </div>
      )}
      <button className="chat-toggle" onClick={() => setOpen(!open)} aria-label="Open chat">
        <Bot size={22} />
      </button>
    </div>
  );
}
