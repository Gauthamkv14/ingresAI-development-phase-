// src/components/ChatbotFloating.jsx
import React from 'react';
import '../styles/chatbotFloating.css'; // <- updated path to styles folder

export default function ChatbotFloating() {
  const openChat = () => {
    window.dispatchEvent(new CustomEvent('openChat'));
  };

  return (
    <div className="chatbot-floating" role="button" onClick={openChat} title="Ask INGRES AI">
      <div className="chatbot-bubble">Ask INGRES AI</div>
      <div className="chatbot-icon">🤖</div>
    </div>
  );
}
