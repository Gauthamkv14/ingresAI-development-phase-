// src/components/ChatbotFloating.jsx
import React, { useState } from 'react';
import Chatbot from './Chatbot.jsx';
import '../styles/chatbotFloating.css';

export default function ChatbotFloating() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className={`chatbot-floating ${open ? 'open' : ''}`} onClick={() => setOpen(true)}>
        <div className="robot">🤖</div>
        <div className="bubble">Ask INGRES AI</div>
      </div>

      {open && (
        <div className="chatbot-modal" role="dialog" aria-modal="true">
          <div className="chatbot-header">
            <div>INGRES AI Assistant</div>
            <button className="close-btn" onClick={() => setOpen(false)}>✕</button>
          </div>
          <div className="chatbot-panel">
            <Chatbot onClose={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
