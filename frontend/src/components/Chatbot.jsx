// src/components/Chatbot.jsx
import React, { useState } from "react";

export default function Chatbot() {
  const [messages, setMessages] = useState([
    { from: 'bot', text: "Hello — ask me for a state's groundwater data (e.g. 'Show me Karnataka rainfall and recharge'), or compare two states." }
  ]);
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);

  const push = (m) => setMessages(prev => [...prev, m]);

  const sendQuery = async (q) => {
    if (!q || loading) return;
    push({ from: 'user', text: q });
    setValue('');
    setLoading(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q })
      });
      const json = await res.json();

      // Format response concisely
      if (json.intent === 'list_states') {
        push({ from: 'bot', text: `Available states: ${json.states.slice(0,50).join(', ')}${json.states.length>50 ? ', ...' : ''}` });
      } else if (json.intent === 'compare_states' && json.left && json.right) {
        const a = json.left.metrics;
        const b = json.right.metrics;
        const leftName = json.left.state;
        const rightName = json.right.state;
        // show only a few key metrics for comparison
        const keys = [
          "Annual Extractable Ground water Resource (ham)_C",
          "Total Ground Water Availability in the area (ham)_Fresh",
          "Net Annual Ground Water Availability for Future Use (ham)_C",
          "Stage of Ground Water Extraction (%)_C"
        ];
        const lines = keys.map(k => {
          const av = a[k] !== undefined && a[k] !== null ? a[k] : '—';
          const bv = b[k] !== undefined && b[k] !== null ? b[k] : '—';
          return `${k}: ${leftName}=${av} | ${rightName}=${bv}`;
        }).join('\n');
        push({ from: 'bot', text: `Comparison (${leftName} vs ${rightName}):\n${lines}` });
      } else if (json.intent === 'state_metrics' || json.intent === 'state_overview') {
        // If user asked specific metric words, backend normally returns "requested" inside result
        if (json.result && json.result.requested && Object.keys(json.result.requested).length > 0) {
          const pairs = Object.entries(json.result.requested).map(([k, v]) => `${k}: ${v === null ? '—' : v}`);
          push({ from: 'bot', text: pairs.join('\n') });
        } else if (json.metrics) {
          // concise summary of the most relevant numbers
          const m = json.metrics;
          const summary = [
            `State: ${json.state}`,
            `Total availability (stock): ${m["Total Ground Water Availability in the area (ham)_Fresh"] ?? '—'}`,
            `Extractable (usable): ${m["Annual Extractable Ground water Resource (ham)_C"] ?? '—'}`,
            `Net available for future use: ${m["Net Annual Ground Water Availability for Future Use (ham)_C"] ?? '—'}`,
            `Stage of extraction (avg%): ${m.stage_extraction_pct_avg ?? '—'}`,
          ].join('\n');
          push({ from: 'bot', text: summary });
        } else {
          push({ from: 'bot', text: json.explanation || json.answer || "Got it — but couldn't produce a concise metric." });
        }
      } else if (json.intent === 'state_districts') {
        // give short top-5 district summary by extractable
        const rows = json.districts || [];
        const extractableKey = "Annual Extractable Ground water Resource (ham)_C";
        const top = rows.slice().sort((a,b) => (b[extractableKey] || 0) - (a[extractableKey] || 0)).slice(0,5);
        const lines = top.map(r => `${r.district}: ${r[extractableKey] ?? '—'}`);
        push({ from: 'bot', text: `Top districts by extractable:\n${lines.join('\n')}` });
      } else if (json.intent === 'none') {
        push({ from: 'bot', text: json.answer || "I couldn't detect a state or metric. Try: 'Show Karnataka rainfall' or 'Compare Karnataka and Kerala'." });
      } else {
        // default fallback: show short explanation only
        const out = json.explanation || (json.answer && typeof json.answer === 'string' ? json.answer : "Here's what I found.");
        push({ from: 'bot', text: out });
      }
    } catch (err) {
      console.error(err);
      push({ from: 'bot', text: "Sorry — couldn't reach backend. Try again." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="chat-container" style={{ padding: 12 }}>
      <div className="chat-messages" style={{ maxHeight: 420, overflowY: 'auto', marginBottom: 8 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ marginBottom: 8, textAlign: m.from === 'bot' ? 'left' : 'right' }}>
            <div style={{
              display: 'inline-block',
              padding: '10px 14px',
              borderRadius: 14,
              background: m.from === 'bot' ? '#eee' : 'linear-gradient(90deg,#9b5cff,#ff67c0)',
              color: m.from === 'bot' ? '#222' : '#fff',
              maxWidth: '82%',
              whiteSpace: 'pre-wrap'
            }}>
              {m.text}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') sendQuery(value); }}
          placeholder="Ask something..."
          style={{ flex: 1, padding: '10px 12px', borderRadius: 999, border: '1px solid #ddd' }}
        />
        <button onClick={() => sendQuery(value)} disabled={loading} style={{ padding: '10px 12px', borderRadius: 8 }}>
          {loading ? '...' : 'Send'}
        </button>
      </div>
    </div>
  );
}
// 