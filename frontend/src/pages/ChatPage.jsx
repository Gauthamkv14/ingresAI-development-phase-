// src/pages/ChatPage.jsx
import React from 'react';
import Chatbot from '../components/Chatbot.jsx';

export default function ChatPage() {
  return (
    <div className="page">
      <h2>AI Chat</h2>
      <div className="card">
        <Chatbot />
      </div>
    </div>
  );
}
