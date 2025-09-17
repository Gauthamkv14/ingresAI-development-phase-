// frontend/src/components/StateSelector.jsx
import React from "react";

export default function StateSelector({ states = [], value, onChange }) {
  let items = [];
  if (!states) {
    items = [];
  } else if (Array.isArray(states)) {
    if (states.length > 0 && typeof states[0] === "object" && states[0] !== null) {
      items = states.map(s => (s.state ? String(s.state) : (s.name || s.STATE || JSON.stringify(s))));
    } else {
      items = states.map(s => String(s));
    }
  } else if (typeof states === "object") {
    items = Object.keys(states);
  } else {
    items = [];
  }

  return (
    <div className="state-selector" style={{ display: "flex", gap: 12, alignItems: "center" }}>
      <label style={{ fontWeight: 600 }}>State</label>
      <select
        className="state-selector-select"
        value={value || ""}
        onChange={(e) => onChange && onChange(e.target.value)}
      >
        <option value="">-- Select state --</option>
        {items.map((s, i) => (
          <option key={i} value={s}>
            {s}
          </option>
        ))}
      </select>
    </div>
  );
}
