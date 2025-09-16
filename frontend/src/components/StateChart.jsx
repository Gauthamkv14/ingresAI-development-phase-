// src/components/StateChart.jsx
import React, { useEffect, useState } from "react";
import axios from "axios";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from "chart.js";
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

export default function StateChart({ initialState = null }) {
  const [states, setStates] = useState([]);
  const [selected, setSelected] = useState(initialState);
  const [chartData, setChartData] = useState(null);

  useEffect(() => {
    axios.get("/api/states").then((r) => {
      setStates(r.data);
      if (!selected && r.data.length) {
        setSelected(r.data[0].state);
      }
    });
  }, []);

  useEffect(() => {
    if (!selected) return;
    axios.get(`/api/state/${encodeURIComponent(selected)}`).then((r) => {
      // Build a simple single-value chart showing multiple aggregation columns
      const data = r.data;
      const labels = [
        "Annual Extractable Ground water Resource (ham)_C",
        "Net Annual Ground Water Availability for Future Use (ham)_C",
        "Total Ground Water Availability in Unconfined Aquifier (ham)_Fr",
        "Total Ground Water Availability in the area (ham)_Fresh",
      ];
      const values = labels.map((lbl) => (data[lbl] ? Number(data[lbl]) : 0));
      setChartData({
        labels,
        datasets: [
          {
            label: `${selected} - groundwater summary (ham)`,
            data: values,
            fill: false,
            tension: 0.3,
            pointRadius: 6,
            borderWidth: 2,
          },
        ],
      });
    });
  }, [selected]);

  return (
    <div>
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
        <select value={selected || ""} onChange={(e) => setSelected(e.target.value)}>
          {states.map((s) => (
            <option key={s.state} value={s.state}>
              {s.state}
            </option>
          ))}
        </select>
        <button onClick={() => {
            // refresh
            if (selected) setSelected(selected + " ");
            setTimeout(()=> setSelected(selected), 10);
        }}>Refresh</button>
      </div>
      {chartData ? (
        <Line
          data={chartData}
          options={{
            interaction: { mode: "nearest", axis: "x", intersect: false },
            plugins: {
              tooltip: {
                callbacks: {
                  label: function(context) {
                    const value = context.parsed.y;
                    return `${context.dataset.label || ""}: ${Number(value).toLocaleString()} ham`;
                  },
                },
              },
            },
            scales: {
              y: {
                beginAtZero: true,
                ticks: {
                  callback: function(value) {
                    return value.toLocaleString();
                  },
                },
              },
            },
          }}
        />
      ) : (
        <div>Loading chart...</div>
      )}
    </div>
  );
}
