// frontend/src/components/Charts.js
import React, { useEffect, useState } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { getStatesOverview, getStateAggregate } from '../ingresApi';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

const METRIC_LABELS = [
  "Annual Extractable Ground water Resource (ham)_C",
  "Net Annual Ground Water Availability for Future Use (ham)_C",
  "Total Ground Water Availability in Unconfined Aquifier (ham)_Fr",
  "Total Ground Water Availability in the area (ham)_Fresh",
];

const shortLabels = [
  "Annual Extractable (ham)",
  "Net Annual Available (ham)",
  "Unconfined Aquifer (ham)",
  "Total Availability (ham)"
];

export default function Charts() {
  const [states, setStates] = useState([]);
  const [selected, setSelected] = useState("");
  const [chartData, setChartData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getStatesOverview()
      .then((s) => {
        setStates(s || []);
        if (s && s.length) setSelected(s[0].state);
      })
      .catch((err) => console.error("Failed to load states:", err));
  }, []);

  useEffect(() => {
    if (!selected) return;
    setLoading(true);
    getStateAggregate(selected)
      .then((data) => {
        const vals = METRIC_LABELS.map((m) => Number(data[m] || 0));
        setChartData({
          labels: shortLabels,
          datasets: [
            {
              label: `${selected} (ham)`,
              data: vals,
              fill: false,
              tension: 0.25,
              pointRadius: 6,
              borderWidth: 2,
            },
          ],
        });
      })
      .catch((err) => {
        console.error("Failed to load state aggregate", err);
        setChartData(null);
      })
      .finally(() => setLoading(false));
  }, [selected]);

  return (
    <div style={{ padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          style={{ padding: 8 }}
        >
          {states.map((s) => (
            <option key={s.state} value={s.state}>
              {s.state}
            </option>
          ))}
        </select>
        <button onClick={() => { if (selected) setSelected(selected); }}>Refresh</button>
        <div style={{ marginLeft: 'auto', color: '#666' }}>
          {loading ? 'Loading...' : chartData ? 'Hover points for details' : 'Select a state'}
        </div>
      </div>

      <div style={{ height: 320 }}>
        {chartData ? (
          <Line
            data={chartData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              interaction: { mode: 'nearest', axis: 'x', intersect: false },
              plugins: {
                legend: { display: false },
                tooltip: {
                  callbacks: {
                    label: function (context) {
                      const v = context.parsed.y;
                      return `${context.dataset.label || ''}: ${Number(v).toLocaleString()} ham`;
                    },
                  },
                },
              },
              scales: {
                y: {
                  beginAtZero: true,
                  ticks: { callback: (v) => Number(v).toLocaleString() },
                },
              },
            }}
          />
        ) : (
          <div style={{ padding: 24 }}>No data available.</div>
        )}
      </div>
    </div>
  );
}
