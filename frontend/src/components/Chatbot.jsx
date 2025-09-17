// src/components/Chatbot.jsx
import React, { useState } from "react";

export default function Chatbot() {
  const [messages, setMessages] = useState([
    { from: 'bot', text: "Hello — ask me for a state's groundwater data (e.g. 'Show me Karnataka rainfall and recharge'), or compare two states." }
  ]);
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);

  const push = (m) => setMessages(prev => [...prev, m]);

  const formatNumber = (v) => {
    if (v === null || v === undefined || v === '') return '—';
    if (typeof v === 'number') return v.toLocaleString();
    const n = Number(String(v).replace(/,/g, ''));
    return Number.isFinite(n) ? n.toLocaleString() : String(v);
  };

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

      // never push raw json to messages. Convert to concise text answers only.
      const pushAnswer = (txt) => push({ from: 'bot', text: txt });

      // handle list states
      if (json.intent === 'list_states' && Array.isArray(json.states)) {
        const snippet = json.states.slice(0, 50).join(', ') + (json.states.length > 50 ? ", ..." : "");
        pushAnswer(`Available states: ${snippet}`);
        return;
      }

      // compare two states - produce a neat text table
      if (json.intent === 'compare_states' && json.left && json.right) {
        const left = json.left.metrics || json.left.metrics || json.left;
        const right = json.right.metrics || json.right.metrics || json.right;
        const leftName = json.left.state || json.left.state || 'Left';
        const rightName = json.right.state || json.right.state || 'Right';
        // chosen metrics to show
        const keys = [
          { k: "Total Ground Water Availability in the area (ham)_Fresh", label: "Total availability (ham)" },
          { k: "Annual Extractable Ground water Resource (ham)_C", label: "Extractable (ham)" },
          { k: "Net Annual Ground Water Availability for Future Use (ham)_C", label: "Net avail. (ham)" },
          { k: "Stage of Ground Water Extraction (%)_C", label: "Stage extraction (%)" },
          { k: "Rainfall (mm)_C", label: "Rainfall (mm)" }
        ];
        const header = `${'Metric'.padEnd(36)} | ${leftName.padEnd(16)} | ${rightName.padEnd(16)}`;
        const rows = keys.map(item => {
          const a = formatNumber(left[item.k] ?? left[item.key] ?? left[item.k.replace(/\s+/g, '_')] ?? null);
          const b = formatNumber(right[item.k] ?? right[item.key] ?? right[item.k.replace(/\s+/g, '_')] ?? null);
          return `${item.label.padEnd(36)} | ${a.toString().padEnd(16)} | ${b.toString().padEnd(16)}`;
        });
        pushAnswer([header, ...rows].join('\n'));
        return;
      }

      // district-level trends
      if (json.intent === 'state_districts' && json.districts) {
        const rows = json.districts;
        const key = "Annual Extractable Ground water Resource (ham)_C";
        const top = rows.slice().sort((a,b) => (b[key]||0) - (a[key]||0)).slice(0,6);
        const lines = top.map(r => `${r.district}: ${formatNumber(r[key])}`);
        pushAnswer(`Top districts in ${json.state} by extractable:\n${lines.join('\n')}`);
        return;
      }

      // state_metrics or state_overview
      if (json.intent === 'state_metrics' || json.intent === 'state_overview') {
        // If backend returned result.requested (user asked a specific metric)
        if (json.result && json.result.requested && Object.keys(json.result.requested).length > 0) {
          // print each requested metric succinctly
          const pairs = Object.entries(json.result.requested).map(([k, v]) => `${k}: ${formatNumber(v)}`);
          pushAnswer(pairs.join('\n'));
          return;
        }

        // If backend returned metrics object
        const metrics = json.metrics || (json.result && json.result.all) || (json.result && json.result.metrics) || json;
        const stateName = json.state || (json.result && json.result.state) || (json.metrics && json.metrics.state) || '';

        // If the user's query contains known metric keywords, try to return only that metric
        const qLower = q.toLowerCase();
        if (qLower.includes('rain') || qLower.includes('rainfall')) {
          const v = metrics['rainfall_avg_mm'] ?? metrics['Rainfall (mm)_C'] ?? null;
          pushAnswer(`The "rainfall_avg_mm" in ${stateName || 'the state'} is: ${formatNumber(v)}`);
          return;
        }
        if (qLower.includes('recharge')) {
          const v = metrics['annual_recharge_sum_ham'] ?? metrics['Annual Ground water Recharge (ham)_C'] ?? null;
          pushAnswer(`The "annual_recharge_sum_ham" in ${stateName || 'the state'} is: ${formatNumber(v)}`);
          return;
        }
        if (qLower.includes('extract') || qLower.includes('usable')) {
          const v = metrics['extractable_sum_ham'] ?? metrics['Annual Extractable Ground water Resource (ham)_C'] ?? null;
          pushAnswer(`The "Annual Extractable Ground water Resource (ham)_C" in ${stateName || 'the state'} is: ${formatNumber(v)}`);
          return;
        }
        if (qLower.includes('net') && (qLower.includes('available') || qLower.includes('future'))) {
          const v = metrics['net_avail_future_sum_ham'] ?? metrics['Net Annual Ground Water Availability for Future Use (ham)_C'] ?? null;
          pushAnswer(`The "Net Annual Ground Water Availability for Future Use (ham)_C" in ${stateName || 'the state'} is: ${formatNumber(v)}`);
          return;
        }
        if (qLower.includes('stage') || qLower.includes('stress') || qLower.includes('extraction %') || qLower.includes('extraction')) {
          const v = metrics['stage_extraction_pct_avg'] ?? metrics['Stage of Ground Water Extraction (%)_C'] ?? null;
          pushAnswer(`The "Stage of Ground Water Extraction (%)_C" (avg) in ${stateName || 'the state'} is: ${formatNumber(v)}`);
          return;
        }
        if (qLower.includes('availability') || qLower.includes('total')) {
          const v = metrics['Total Ground Water Availability in the area (ham)_Fresh'] ?? metrics['total_ground_water_ham'] ?? null;
          pushAnswer(`The "Total Ground Water Availability in the area (ham)_Fresh" in ${stateName || 'the state'} is: ${formatNumber(v)}`);
          return;
        }

        // default concise overview: three core numbers
        const t = metrics['Total Ground Water Availability in the area (ham)_Fresh'] ?? metrics['total_ground_water_ham'] ?? null;
        const ex = metrics['Annual Extractable Ground water Resource (ham)_C'] ?? metrics['extractable_sum_ham'] ?? null;
        const net = metrics['Net Annual Ground Water Availability for Future Use (ham)_C'] ?? metrics['net_avail_future_sum_ham'] ?? null;
        const outLines = [
          `State: ${stateName}`,
          `Total availability (stock): ${formatNumber(t)}`,
          `Extractable (usable): ${formatNumber(ex)}`,
          `Net available for future use: ${formatNumber(net)}`
        ];
        pushAnswer(outLines.join('\n'));
        return;
      }

      // fallback
      const fallback = json.answer || json.explanation || "Couldn't extract a concise answer. Try: 'Show Karnataka rainfall' or 'Compare Karnataka and Kerala'.";
      pushAnswer(fallback);
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
              whiteSpace: 'pre-wrap',
              fontFamily: 'Inter, Arial, sans-serif'
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
