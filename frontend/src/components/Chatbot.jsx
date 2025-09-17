// src/components/Chatbot.jsx
import React, { useState } from 'react';
import '../styles/chatbot.css';

export default function Chatbot({ onClose }) {
  const [messages, setMessages] = useState([{ from: 'bot', text: "Hello — ask me for a state's groundwater data, e.g. 'Show me Karnataka groundwater data'." }]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const send = async () => {
    const q = text.trim();
    if (!q) return;
    setMessages(m => [...m, { from: 'user', text: q }]);
    setText('');
    setSending(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q })
      });
      const json = await res.json();
      if (json.intent === 'state_aggregate') {
        setMessages(m => [...m, { from: 'bot', text: json.explanation }]);
      } else if (json.intent === 'list_states') {
        setMessages(m => [...m, { from: 'bot', text: 'Available states:\n' + (json.states || []).join(', ') }]);
      } else {
        setMessages(m => [...m, { from: 'bot', text: json.answer || JSON.stringify(json) }]);
      }
    } catch (e) {
      setMessages(m => [...m, { from: 'bot', text: 'Error: could not reach server.' }]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="chat-root">
      <div className="chat-history">
        {messages.map((m, i) => (
          <div key={i} className={`chat-msg ${m.from}`}>
            <div className="chat-text" style={{ whiteSpace: 'pre-wrap' }}>{m.text}</div>
          </div>
        ))}
      </div>

      <div className="chat-compose">
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') send(); }} placeholder="Ask something..." />
        <button onClick={send} disabled={sending}>{sending ? '…' : '➤'}</button>
      </div>
    </div>
  );
}
