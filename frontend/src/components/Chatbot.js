// frontend/src/components/Chatbot.js
import React, { useState, useEffect } from "react";
import { postChat } from "../api/ingresApi"; // use API helper
import { toast } from "react-toastify";

// Simple Chatbot component
export default function Chatbot() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    // Welcome message
    setMessages([
      {
        id: "welcome",
        type: "bot",
        content:
          "Hello! I'm your INGRES AI Assistant. Ask me for groundwater stats, e.g. 'Show me Tamil Nadu groundwater data'.",
      },
    ]);
  }, []);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text) return;

    const userMsg = { id: Date.now().toString(), type: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    try {
      const data = await postChat(text);
      const botText =
        data?.explanation ||
        data?.answer ||
        data?.message ||
        "I processed your request.";

      const botMsg = {
        id: (Date.now() + 1).toString(),
        type: "bot",
        content: botText,
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      console.error("Chat request failed:", err);
      toast.error("Failed to reach chat API");
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 2).toString(),
          type: "bot",
          content: "Sorry, something went wrong.",
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="chatbot-root">
      <div className="messages">
        {messages.map((m) => (
          <div key={m.id} className={`message ${m.type}`}>
            {m.content}
          </div>
        ))}
        {isTyping && <div className="message bot">...</div>}
      </div>

      <div className="input-area">
        <input
          placeholder="Ask something..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") sendMessage();
          }}
        />
        <button onClick={sendMessage}>Send</button>
      </div>
    </div>
  );
}
