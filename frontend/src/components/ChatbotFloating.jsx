import React, { useState } from "react";
import "./../styles/chatbotFloating.css";
import ChatInterface from "./ChatInterface";
import { FaRobot } from "react-icons/fa";

export default function ChatbotFloating() {
  const [open, setOpen] = useState(false);
  return (
    <div className={`chatbot-floating ${open ? "open" : ""}`}>
      {open && (
        <div className="chat-panel">
          <ChatInterface />
        </div>
      )}
      <button className="chat-toggle" onClick={() => setOpen(v => !v)} aria-label="Toggle chat">
        <span className="robot-emoji">🤖</span>
        <span className="bubble-text">Ask INGRES AI</span>
      </button>
    </div>
  );
}
