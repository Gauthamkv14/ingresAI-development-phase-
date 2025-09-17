// src/pages/Visualizations.jsx
import React, { useEffect, useState } from "react";
import Charts from "../components/Charts";
import "../styles/visualizations.css";
import { getStatesOverview } from "../api/ingresApi";

export default function Visualizations() {
  const [states, setStates] = useState([]);
  const [selected, setSelected] = useState("");
  const [districtsData, setDistrictsData] = useState(null);

  useEffect(()=> {
    loadStates();
  }, []);

  async function loadStates(){
    try {
      const s = await getStatesOverview();
      setStates(s || []);
    } catch (e) { console.error(e); }
  }

  async function onStateChange(e){
    const st = e.target.value;
    setSelected(st);
    if (!st) { setDistrictsData(null); return; }
    try {
      const res = await fetch(`/api/state/${encodeURIComponent(st)}/districts`);
      if (res.ok) {
        const data = await res.json();
        setDistrictsData(data);
      } else {
        setDistrictsData(null);
      }
    } catch (err) {
      console.error(err);
      setDistrictsData(null);
    }
  }

  return (
    <div className="visualizations">
      <div className="visual-header">
        <h2>Visualizations</h2>
        <p>District-level breakdowns and charts are available by selecting a state below.</p>
      </div>

      <div className="visual-body">
        <div className="left-col">
          <label htmlFor="stateSelect">State</label>
          <select id="stateSelect" value={selected} onChange={onStateChange}>
            <option value="">Select a state</option>
            {states.map(s => <option key={s.state} value={s.state}>{s.state}</option>)}
          </select>
        </div>

        <div className="chart-col">
          <div className="card">
            {!districtsData && <div className="placeholder">Select a state to load district trends.</div>}
            {districtsData && (
              <Charts districts={districtsData} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
