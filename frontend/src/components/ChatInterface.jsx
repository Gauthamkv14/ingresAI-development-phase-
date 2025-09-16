import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { Send } from "lucide-react";
import "../styles/chatinterface.css";

function NumberCell({ value }) {
  if (value === null || value === undefined) return <span className="na">—</span>;
  if (typeof value === "number") return <span>{value.toLocaleString()}</span>;
  return <span>{String(value)}</span>;
}

export default function ChatInterface() {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    setMessages([
      {
        id: "welcome",
        type: "bot",
        content:
          "Hello! I'm your INGRES AI Assistant. Try: 'Show me Tamil Nadu groundwater data' or 'Compare Karnataka with Kerala'.",
      },
    ]);
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    const text = inputValue.trim();
    if (!text) return;
    const userMsg = { id: Date.now().toString(), type: "user", content: text };
    setMessages((m) => [...m, userMsg]);
    setInputValue("");
    setIsTyping(true);
    try {
      const res = await axios.post("/api/chat", { query: text });
      const data = res.data;
      const botMsg = {
        id: (Date.now() + 1).toString(),
        type: "bot",
        raw: data,
        content: data?.explanation || data?.answer || data?.message || (data.intent === "list_states" ? "States: " + (data.states || []).join(", ") : "Done."),
      };
      setMessages((m) => [...m, botMsg]);
    } catch (err) {
      console.error(err);
      setMessages((m) => [...m, { id: (Date.now()+2).toString(), type: "bot", content: "Server error. Try again." }]);
    } finally {
      setIsTyping(false);
    }
  };

  function renderAggregates(agg) {
    if (!agg) return null;
    const keys = Object.keys(agg || {}).filter(k => agg[k] !== null && agg[k] !== undefined);
    return (
      <div className="agg-grid">
        {keys.map(k => (
          <div className="agg-item" key={k}>
            <div className="agg-key">{k}</div>
            <div className="agg-val"><NumberCell value={agg[k]} /></div>
          </div>
        ))}
      </div>
    );
  }

  // ... other render helpers unchanged (renderMetrics, renderComparison)

  return (
    <div className="chat-interface">
      <div className="chat-messages">
        {messages.map((m) => (
          <div key={m.id} className={`message ${m.type}`}>
            {m.type === "user" ? (
              <div className="user-text">{m.content}</div>
            ) : (
              <>
                <div className="bot-text">{m.content}</div>
                {m.raw && m.raw.intent === "state_aggregate" && (
                  <div className="card">
                    <h4>{m.raw.state}</h4>
                    <div className="explanation">{m.raw.explanation}</div>
                    {renderAggregates(m.raw.aggregates || m.raw)}
                  </div>
                )}
                {/* additional payload renderers here as needed */}
              </>
            )}
          </div>
        ))}
        {isTyping && <div className="message bot">...</div>}
        <div ref={endRef} />
      </div>

      <div className="chat-input">
        <input
          placeholder="Ask something..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          style={{ color: "#000" }}
        />
        <button onClick={send}><Send /></button>
      </div>
    </div>
  );
}
