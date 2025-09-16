// src/utils/charts.js
export function formatNumber(n) {
  if (n === null || n === undefined) return "N/A";
  if (typeof n !== "number") n = Number(n) || 0;
  return n.toLocaleString();
}

export const defaultChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: "nearest", axis: "x", intersect: false },
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        label: function(context) {
          const v = context.parsed.y;
          return `${context.dataset.label || ""}: ${formatNumber(v)} ham`;
        }
      }
    }
  },
  scales: {
    y: {
      beginAtZero: true,
      ticks: {
        callback: function(value) {
          return value.toLocaleString();
        }
      }
    }
  }
};
