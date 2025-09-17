// frontend/src/components/Chatbot.jsx
import React, { useState, Suspense } from "react";
import axios from "axios";

const Plot = React.lazy(() => import('react-plotly.js'));

export default function Chatbot() {
  const [messages, setMessages] = useState([
    { from: "bot", text: "Hello — ask me for a state's groundwater data, e.g. 'Show me Karnataka groundwater data'." }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const addMessage = (m) => setMessages(prev => [...prev, m]);

  const send = async (text) => {
    if (!text) return;
    addMessage({ from: "user", text });
    setInput("");
    setLoading(true);
    try {
      const res = await axios.post("/api/chat", { query: text });
      const data = res.data;

      if (data.intent === "state_aggregate") {
        addMessage({ from: "bot", text: data.explanation });
        addMessage({ from: "bot", aggregate: data.aggregates, counts: data.counts, districts: data.districts });
      } else if (data.intent === "compare") {
        addMessage({ from: "bot", compare: data.compare, state1: data.state1, state2: data.state2 });
      } else if (data.intent === "district_aggregate") {
        addMessage({ from: "bot", text: `District ${data.district} aggregates:`, aggregate: data.aggregate });
      } else if (data.intent === "state_trend" || data.intent === "district_trend") {
        // the backend returns time_series: [{month: 'YYYY-MM', value: x}, ...]
        if (data.time_series && data.time_series.length > 0) {
          addMessage({ from: "bot", text: `Here is the time series for ${data.metric_column ? data.metric_column : 'metric'} in ${data.state || data.district}`, time_series: data.time_series, title: (data.district ? `${data.district}, ${data.state}` : data.state) });
        } else {
          addMessage({ from: "bot", text: "No time-series data available for that query (CSV may lack timestamps)." });
        }
      } else if (data.intent === "list_states") {
        addMessage({ from: "bot", text: `Available states: ${data.states.join(", ")}` });
      } else if (data.intent === "none") {
        addMessage({ from: "bot", text: data.answer || "I couldn't understand your request." });
      } else {
        addMessage({ from: "bot", text: data.answer || "Response received." });
      }
    } catch (err) {
      console.error(err);
      addMessage({ from: "bot", text: "Server error — please try again." });
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = (e) => {
    e.preventDefault();
    if (input.trim()) send(input.trim());
  };

  const renderAggregateCard = (agg, counts, districts) => (
    <div style={{ background: "#fafafa", padding: 12, borderRadius: 8 }}>
      <div style={{ fontWeight: 700 }}>{agg.state}</div>
      <table style={{ width: "100%", marginTop: 8 }}>
        <tbody>
          {Object.keys(agg).filter(k => !k.startsWith("state") && k !== "num_districts").map((k) => (
            <tr key={k}>
              <td style={{ padding: 6 }}>{k}</td>
              <td style={{ padding: 6, textAlign: "right" }}>{Number(agg[k] || 0).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {counts && <div style={{ marginTop: 8 }}>
        <strong>Counts</strong>
        <div>Critical: {counts.critical ?? "—"} — Tanks/Ponds (sum): {counts.tanks_ponds_sum ?? "—"}</div>
      </div>}
      {districts && districts.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <em>Districts included: {districts.length}</em>
        </div>
      )}
    </div>
  );

  const renderCompare = (compare, s1, s2) => (
    <div style={{ overflowX: "auto", background: "#fff", padding: 8, borderRadius: 8 }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", padding: 8 }}>Metric</th>
            <th style={{ textAlign: "right", padding: 8 }}>{s1}</th>
            <th style={{ textAlign: "right", padding: 8 }}>{s2}</th>
          </tr>
        </thead>
        <tbody>
          {compare.map((r, idx) => (
            <tr key={idx}>
              <td style={{ padding: 8 }}>{r.metric}</td>
              <td style={{ padding: 8, textAlign: "right" }}>{Number(r.state1 || 0).toLocaleString()}</td>
              <td style={{ padding: 8, textAlign: "right" }}>{Number(r.state2 || 0).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderTimeSeries = (ts, title) => {
    // ts: [{month: 'YYYY-MM', value: x}, ...]
    const x = ts.map(d => d.month);
    const y = ts.map(d => d.value);
    return (
      <div style={{ background: "#fff", padding: 8, borderRadius: 8 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>{title}</div>
        <Suspense fallback={<div>Loading chart…</div>}>
          <Plot
            data={[{ x, y, type: 'scatter', mode: 'lines+markers' }]}
            layout={{ margin: { t: 20, r: 10, l: 40, b: 80 }, height: 300, xaxis: { tickangle: -45 } }}
            style={{ width: '100%' }}
          />
        </Suspense>
      </div>
    );
  };

  return (
    <div style={{ background: "#fff", borderRadius: 10, padding: 12 }}>
      <div style={{ maxHeight: 420, overflowY: "auto", marginBottom: 8 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ marginBottom: 10, display: "flex", justifyContent: m.from === "user" ? "flex-end" : "flex-start" }}>
            <div style={{
              background: m.from === "user" ? "linear-gradient(90deg,#a84ef0,#ff6fb3)" : "#f1f1f1",
              color: m.from === "user" ? "#fff" : "#111",
              padding: 12, borderRadius: 12, maxWidth: "75%"
            }}>
              {m.text && <div style={{ marginBottom: 6 }}>{m.text}</div>}
              {m.aggregate && renderAggregateCard(m.aggregate, m.counts, m.districts)}
              {m.compare && renderCompare(m.compare, m.state1, m.state2)}
              {m.time_series && renderTimeSeries(m.time_series, m.title || "Time Series")}
              {m.districts && Array.isArray(m.districts) && m.districts.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <strong>Districts ({m.districts.length})</strong>
                  <div style={{ fontSize: 12 }}>
                    {m.districts.slice(0, 6).map(d => <div key={d.district}>{d.district}</div>)}
                    {m.districts.length > 6 && <div>...and others</div>}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={onSubmit} style={{ display: "flex", gap: 8 }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask something..." style={{ flex: 1, padding: "12px 14px", borderRadius: 24, border: "1px solid #ddd" }} />
        <button type="submit" disabled={loading} style={{ padding: "10px 14px", borderRadius: 12, background: "#6B46C1", color: "#fff", border: "none" }}>{loading ? "…" : "▶"}</button>
      </form>
    </div>
  );
}
