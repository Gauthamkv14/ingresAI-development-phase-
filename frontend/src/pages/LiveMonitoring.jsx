// src/pages/LiveMonitoring.jsx
import React, { useEffect, useState } from "react";
import Charts from "../components/Charts";
import "../styles/live.css";
import { getStatesOverview } from "../api/ingresApi";

export default function LiveMonitoring(){
  const [states, setStates] = useState([]);
  const [selected, setSelected] = useState("");
  const [metric, setMetric] = useState("Total Ground Water Availability in the area (ham)_Fresh");

  useEffect(()=>{ loadStates(); }, []);

  async function loadStates(){
    try {
      const s = await getStatesOverview();
      setStates(s || []);
      if (s && s.length) {
        setSelected(s[0].state);
      }
    } catch (e) { console.error(e); }
  }

  return (
    <div className="live-page">
      <h2>Live Monitoring Data</h2>

      <div className="live-controls">
        <div className="control-left">
          <label htmlFor="liveState">State</label>
          <select id="liveState" value={selected} onChange={(e)=>setSelected(e.target.value)}>
            <option value="">Select state</option>
            {states.map(s => <option key={s.state} value={s.state}>{s.state}</option>)}
          </select>
        </div>

        <div className="control-right">
          <label htmlFor="metricSelect">Metric</label>
          <select id="metricSelect" value={metric} onChange={(e)=>setMetric(e.target.value)}>
            <option value="Total Ground Water Availability in the area (ham)_Fresh">Total Availability (Fresh)</option>
            <option value="Annual Extractable Ground water Resource (ham)_C">Annual Extractable</option>
            <option value="Net Annual Ground Water Availability for Future Use (ham)_C">Net Annual Available</option>
            <option value="Total Ground Water Availability in Unconfined Aquifier (ham)_Fr">Unconfined Aquifer</option>
          </select>
        </div>
      </div>

      <div className="card">
        <h3>Trends for {selected || "—"}</h3>
        <div className="trends-area">
          <Charts stateName={selected} metric={metric} />
        </div>
      </div>
    </div>
  );
}
