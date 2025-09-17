// src/components/ChatbotFloating.jsx
import React, { useState } from "react";
import Chatbot from "./Chatbot";

export default function ChatbotFloating() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          position: "fixed",
          right: 24,
          bottom: 24,
          width: 64,
          height: 64,
          borderRadius: 32,
          background: "linear-gradient(135deg,#ff6ad5,#7b61ff)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
          cursor: "pointer",
          zIndex: 1200
        }}
        title="Ask INGRES AI"
      >
        <img src="/bot-icon.png" alt="bot" style={{ width: 36, height: 36 }} />
      </div>

      {open && (
        <div style={{
          position: "fixed",
          right: 24,
          bottom: 100,
          width: 420,
          maxWidth: "calc(100% - 48px)",
          zIndex: 1200
        }}>
          <Chatbot onClose={() => setOpen(false)} />
        </div>
      )}
    </>
  );
}
