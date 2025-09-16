// frontend/src/components/OverviewCards.jsx
import React, { useEffect, useState } from "react";
import { getOverview } from "../ingresApi";

export default function OverviewCards() {
  const [ov, setOv] = useState(null);

  useEffect(() => {
    getOverview().then(r => setOv(r)).catch(() => {});
  }, []);

  return (
    <div style={{ marginTop: 20 }}>
      <div className="card stat-card">
        <div className="stat-value">{ov ? ov.total_points : "—"}</div>
        <div className="stat-label">MONITORING POINTS</div>
      </div>

      <div className="card stat-card">
        <div className="stat-value">{ov ? ov.critical : "—"}</div>
        <div className="stat-label">CRITICAL AREAS</div>
      </div>
    </div>
  );
}
