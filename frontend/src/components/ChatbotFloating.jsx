// src/components/ChatbotFloating.jsx
import React, { useState, useRef, useEffect } from 'react';
import '../styles/chatbotFloating.css'; // keep existing CSS path

function numberWithCommas(x) {
  if (x === null || x === undefined || x === '') return x;
  if (typeof x === 'number') return x.toLocaleString();
  const n = Number(x);
  if (Number.isFinite(n)) return n.toLocaleString();
  return String(x);
}

export default function ChatbotFloating() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([]); // {role:'user'|'assistant', text}
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  // close when clicking outside
  useEffect(() => {
    function onDoc(e) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  // metric mapping (frontend mirror of backend metrics)
  const METRIC_MAP = [
    { keys: ['rainfall', 'rain'], labels: ['Rainfall (mm)_C', 'rainfall_avg_mm'], unit: 'mm' },
    { keys: ['recharge'], labels: ['Annual Ground water Recharge (ham)_C', 'annual_recharge_sum_ham'], unit: 'ham' },
    { keys: ['extractable', 'usable'], labels: ['Annual Extractable Ground water Resource (ham)_C', 'extractable_sum_ham'], unit: 'ham' },
    { keys: ['extraction', 'demand'], labels: ['Ground Water Extraction for all uses (ha.m)_Total_26', 'extraction_sum_ham'], unit: 'ham' },
    { keys: ['stage', 'stress'], labels: ['Stage of Ground Water Extraction (%)_C', 'stage_extraction_pct_avg'], unit: '%' },
    { keys: ['net available', 'net availability', 'net'], labels: ['Net Annual Ground Water Availability for Future Use (ham)_C', 'net_avail_future_sum_ham'], unit: 'ham' },
    { keys: ['quality', 'quality tag', 'quality_tag'], labels: ['Quality Tagging_Major Parameter Present_C', 'quality_count'], unit: '' },
    { keys: ['total availability', 'availability', 'stock', 'total'], labels: ['Total Ground Water Availability in the area (ham)_Fresh', 'Total Ground Water Availability in Unconfined Aquifier (ham)_Fr'], unit: 'ham' },
    { keys: ['wells', 'no_of_wells', 'wells_total'], labels: ['No_of_wells', 'WELLS', 'wells'], unit: '' }
  ];

  // helper - given backend JSON and candidate label keys, find numeric/text value
  const findValueInResponse = (resp, candidates) => {
    if (!resp) return null;
    // check result.requested
    if (resp.result && resp.result.requested) {
      for (const k of candidates) {
        if (k in resp.result.requested && resp.result.requested[k] != null) return resp.result.requested[k];
      }
    }
    // check result.all
    if (resp.result && resp.result.all) {
      for (const k of candidates) {
        if (k in resp.result.all && resp.result.all[k] != null) return resp.result.all[k];
      }
    }
    // check top-level metrics object (state_metrics or state_overview sometimes uses 'metrics')
    if (resp.metrics) {
      for (const k of candidates) {
        if (k in resp.metrics && resp.metrics[k] != null) return resp.metrics[k];
      }
    }
    // compare_states structure: left.metrics / right.metrics
    if (resp.left && resp.left.metrics) {
      for (const k of candidates) {
        if (k in resp.left.metrics && resp.left.metrics[k] != null) return resp.left.metrics[k];
      }
    }
    if (resp.right && resp.right.metrics) {
      for (const k of candidates) {
        if (k in resp.right.metrics && resp.right.metrics[k] != null) return resp.right.metrics[k];
      }
    }
    // fallback: top-level keys
    for (const k of candidates) {
      if (k in resp && resp[k] != null) return resp[k];
    }
    return null;
  };

  // given resp and user query text, pick the best metric to show and return friendly sentence
  const formatShortAnswer = (resp, originalQuery) => {
    // safety
    if (!resp) return 'No response from backend.';

    const q = (originalQuery || '').toLowerCase();

    // 1) list states intent
    if (resp.intent === 'list_states' && Array.isArray(resp.states)) {
      const shown = resp.states.slice(0, 12).join(', ');
      return `Available states: ${shown}${resp.states.length > 12 ? '…' : ''}`;
    }

    // 2) compare_states intent: create side-by-side summary using total availability if possible
    if (resp.intent === 'compare_states' && resp.left && resp.right) {
      const pickAvail = (side) => {
        const candidates = ['Total Ground Water Availability in the area (ham)_Fresh', 'Total Ground Water Availability in Unconfined Aquifier (ham)_Fr'];
        const val = findValueInResponse(side, candidates);
        return val;
      };
      const la = pickAvail(resp.left);
      const ra = pickAvail(resp.right);
      const leftLabel = resp.left.state || 'Left';
      const rightLabel = resp.right.state || 'Right';
      if (la != null || ra != null) {
        return `${leftLabel}: ${la != null ? numberWithCommas(la) + ' ham' : '—'}  —  ${rightLabel}: ${ra != null ? numberWithCommas(ra) + ' ham' : '—'}`;
      }
      // fallback: show a shorttle for both using any numeric metric
      const bestLeft = Object.values(resp.left.metrics || {}).find(v => typeof v === 'number' || /^\d/.test(String(v)));
      const bestRight = Object.values(resp.right.metrics || {}).find(v => typeof v === 'number' || /^\d/.test(String(v)));
      return `${leftLabel}: ${bestLeft ?? '—'}  —  ${rightLabel}: ${bestRight ?? '—'}`;
    }

    // 3) state-level intents (state_metrics, state_overview, state_districts, etc.)
    // Determine metric of interest - priority:
    //  a) if resp.result.requested exists and has keys -> show those
    //  b) else try to detect a metric word in original query
    //  c) else fallback to showing Total Ground Water Availability
    const requestedKeys = resp.result && resp.result.requested ? Object.keys(resp.result.requested) : [];
    if (requestedKeys && requestedKeys.length > 0) {
      // map requested keys to user-friendly labels (prefer showing what user requested)
      const parts = [];
      for (const rk of requestedKeys) {
        const rawVal = resp.result.requested[rk];
        // try to find friendly unit based on rk or mapping
        let unit = '';
        for (const m of METRIC_MAP) {
          if (m.labels.includes(rk) || m.labels.some(l => l.toLowerCase() === rk.toLowerCase())) {
            unit = m.unit;
            break;
          }
        }
        const pretty = (unit === '%') ? `${rawVal}` : numberWithCommas(rawVal);
        parts.push(`${rk}: ${pretty}${unit ? ' ' + unit : ''}`);
      }
      return `${resp.state || ''} — ${parts.join(' · ')}`;
    }

    // 4) If user asked for a particular metric word, try to match from METRIC_MAP
    for (const metric of METRIC_MAP) {
      for (const kw of metric.keys) {
        if (q.includes(kw)) {
          // try to find value using mapped labels
          const val = findValueInResponse(resp, metric.labels);
          if (val != null) {
            const pretty = (metric.unit === '%') ? `${Number(val).toFixed(2)}%` : (metric.unit ? `${numberWithCommas(val)} ${metric.unit}` : numberWithCommas(val));
            const friendlyLabel = metric.labels[0] === 'Rainfall (mm)_C' ? 'Rainfall' :
                                  metric.labels[0].includes('Extractable') ? 'Extractable' :
                                  metric.labels[0].includes('Total Ground Water Availability') ? 'Total availability' :
                                  metric.labels[0];
            return `${friendlyLabel} in ${resp.state || ''}: ${pretty}`;
          }
        }
      }
    }

    // 5) if resp.result.all contains "Total Ground Water Availability in the area (ham)_Fresh", show that
    if (resp.result && resp.result.all) {
      const all = resp.result.all;
      const totKey = 'Total Ground Water Availability in the area (ham)_Fresh';
      if (totKey in all && all[totKey] != null) {
        return `Total Ground Water Availability in ${resp.state || ''}: ${numberWithCommas(all[totKey])} ham`;
      }
      // if rainfall present
      if ('rainfall_avg_mm' in all && all['rainfall_avg_mm'] != null) {
        return `Rainfall in ${resp.state || ''}: ${numberWithCommas(all['rainfall_avg_mm'])} mm`;
      }
    }

    // 6) if top-level 'metrics' exists (sometimes used by backend)
    if (resp.metrics && typeof resp.metrics === 'object') {
      const metrics = resp.metrics;
      if (metrics.rainfall_avg_mm != null) return `Rainfall in ${resp.state || ''}: ${numberWithCommas(metrics.rainfall_avg_mm)} mm`;
      if (metrics.annual_recharge_sum_ham != null) return `Annual recharge in ${resp.state || ''}: ${numberWithCommas(metrics.annual_recharge_sum_ham)} ham`;
      if (metrics.extractable_sum_ham != null) return `Extractable in ${resp.state || ''}: ${numberWithCommas(metrics.extractable_sum_ham)} ham`;
      // fallback show a key
      const anyKey = Object.keys(metrics).find(k => metrics[k] != null);
      if (anyKey) return `${anyKey} for ${resp.state || ''}: ${numberWithCommas(metrics[anyKey])}`;
    }

    // 7) fallback: if explanation present, return it
    if (resp.explanation) return resp.explanation;

    // 8) as final fallback, attempt to show a small summary
    // Prefer showing total availability if present anywhere
    const fallbackCandidates = [
      'Total Ground Water Availability in the area (ham)_Fresh',
      'Total Ground Water Availability in Unconfined Aquifier (ham)_Fr',
      'annual_recharge_sum_ham',
      'extractable_sum_ham',
      'rainfall_avg_mm'
    ];
    const fallbackVal = findValueInResponse(resp, fallbackCandidates);
    if (fallbackVal != null) {
      // determine unit by key found (approx)
      const unit = String(fallbackVal).includes('.') ? '' : '';
      return `Value for ${resp.state || ''}: ${numberWithCommas(fallbackVal)}${unit ? ' ' + unit : ''}`;
    }

    // last resort
    return 'No concise answer available for that query.';
  };

  const sendQuery = async () => {
    const q = (query || '').trim();
    if (!q) return;
    setLoading(true);

    // push user's message
    setMessages(prev => [...prev, { role: 'user', text: q }]);
    setQuery('');

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q })
      });
      const data = await res.json();
      const short = formatShortAnswer(data, q);
      setMessages(prev => [...prev, { role: 'assistant', text: short }]);
    } catch (err) {
      const errText = 'Error contacting backend: ' + (err.message || err);
      setMessages(prev => [...prev, { role: 'assistant', text: errText }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current && inputRef.current.focus(), 60);
    }
  };

  const onKey = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!loading) sendQuery();
    }
    if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const messagesEndRef = useRef(null);
  useEffect(() => {
    if (messagesEndRef.current) messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, open]);

  return (
    <div ref={containerRef}>
      {/* floating bubble (always present) */}
      <div
        className="chatbot-floating"
        role="button"
        onClick={() => setOpen(prev => !prev)}
        title="Ask INGRES AI"
        style={{ position: 'fixed', right: 20, bottom: 20, zIndex: 9998 }}
      >
        <div className="chatbot-bubble" style={{ padding: '10px 14px', fontWeight: 700 }}>
          Ask INGRES AI
        </div>
        <div className="chatbot-icon" style={{ fontSize: 20, marginLeft: 8 }}>🤖</div>
      </div>

      {/* large chat-window popover */}
      {open && (
        <div
          style={{
            position: 'fixed',
            right: 24,
            bottom: 88,
            width: 420,
            maxWidth: 'calc(100vw - 48px)',
            height: 480,
            zIndex: 9999,
            boxShadow: '0 20px 40px rgba(15,15,20,0.2)',
            borderRadius: 12,
            background: '#fff',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}
        >
          {/* header */}
          <div style={{
            padding: '12px 14px',
            borderBottom: '1px solid #f0f0f0',
            display: 'flex',
            alignItems: 'center',
            gap: 10
          }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'linear-gradient(135deg,#7c3aed,#c084fc)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontWeight: 700
            }}>AI</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700 }}>Ask INGRES AI</div>
              <div style={{ fontSize: 12, color: '#666' }}>Quick answers without leaving the page</div>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close"
              style={{
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                fontSize: 18,
                color: '#666'
              }}
            >✕</button>
          </div>

          {/* messages area */}
          <div style={{
            padding: 12,
            flex: 1,
            overflowY: 'auto',
            background: '#fbfbfd'
          }}>
            {messages.length === 0 && (
              <div style={{ color: '#888', padding: '36px 8px' }}>
                Ask about state metrics (e.g. "rainfall in Karnataka", "compare Kerala and Karnataka").
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} style={{
                display: 'flex',
                justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
                marginBottom: 10
              }}>
                {m.role === 'assistant' && (
                  <div style={{
                    maxWidth: '78%',
                    background: '#f3f4f6',
                    padding: '10px 12px',
                    borderRadius: 10,
                    color: '#111',
                    boxShadow: '0 3px 10px rgba(0,0,0,0.04)'
                  }}>
                    {m.text}
                  </div>
                )}
                {m.role === 'user' && (
                  <div style={{
                    maxWidth: '78%',
                    background: 'linear-gradient(90deg,#7c3aed,#c084fc)',
                    color: 'white',
                    padding: '10px 12px',
                    borderRadius: 10,
                    boxShadow: '0 6px 18px rgba(124,58,237,0.12)'
                  }}>
                    {m.text}
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* input / actions */}
          <div style={{ padding: 12, borderTop: '1px solid #f0f0f0' }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                ref={inputRef}
                placeholder="Type a question (e.g. 'rainfall in Karnataka')"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKey}
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1px solid #e6e6e9',
                  outline: 'none',
                  fontSize: 14
                }}
              />
              <button
                onClick={() => { if (!loading) sendQuery(); }}
                disabled={loading}
                style={{
                  padding: '10px 14px',
                  borderRadius: 8,
                  background: '#6b46ff',
                  color: '#fff',
                  border: 'none',
                  cursor: 'pointer',
                  minWidth: 64
                }}
              >
                {loading ? '…' : 'Go'}
              </button>
            </div>
            <div style={{ marginTop: 8, fontSize: 12, color: '#777' }}>
              Tip: ask state-level questions like "rainfall in Karnataka" or "compare Karnataka and Kerala".
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
