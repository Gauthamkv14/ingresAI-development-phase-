// frontend/src/components/ChatInterface.jsx
import React, { useState, useEffect, useRef } from 'react';
import { postChat } from "../ingresApi";
import { Send } from "lucide-react";
import "../styles/chatinterface.css";

export default function ChatInterface() {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    setMessages([{
      id: "welcome",
      type: "bot",
      content: "Hello! I'm your INGRES AI Assistant. Try: 'Show me Tamil Nadu groundwater data'."
    }]);
  }, []);

  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), [messages]);

  const send = async () => {
    const text = inputValue.trim();
    if (!text) return;
    const userMsg = { id: Date.now().toString(), type: "user", content: text };
    setMessages(prev => [...prev, userMsg]);
    setInputValue("");
    setIsTyping(true);
    try {
      const data = await postChat(text);
      const botText = data?.explanation || data?.answer || data?.message || "I processed your request.";
      setMessages(prev => [...prev, { id: (Date.now()+1).toString(), type: "bot", content: botText }]);
    } catch (e) {
      console.error("Chat error", e);
      setMessages(prev => [...prev, { id: (Date.now()+2).toString(), type: "bot", content: "Sorry, failed to reach the server." }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="chat-interface">
      <div className="chat-messages">
        {messages.map(m => (
          <div key={m.id} className={`message ${m.type}`}>{m.content}</div>
        ))}
        {isTyping && <div className="message bot">...</div>}
        <div ref={endRef} />
      </div>

      <div className="chat-input">
        <input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Ask something..."
        />
        <button onClick={send}><Send /></button>
      </div>
    </div>
  );
}
