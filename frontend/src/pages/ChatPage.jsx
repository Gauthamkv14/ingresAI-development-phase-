import React from "react";
import ChatInterface from "../components/ChatInterface";

export default function ChatPage() {
  return (
    <div className="card" style={{ minHeight: 600 }}>
      <h2>AI Chat</h2>
      <ChatInterface />
    </div>
  );
}
