let Chart: any = null;

async function ensureChart() {
  if (!Chart) {
    const mod = await import("chart.js/auto");
    Chart = mod.default;
  }
  return Chart;
}

export interface NeoChartOptions {
  canvas: HTMLCanvasElement;
  type: "line" | "doughnut" | "bar";
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    color: string;
    fill?: boolean;
    colors?: string[];
  }[];
  grid?: boolean;
}

const PALETTE = ["#ff4d6d", "#f59e0b", "#7c6cf0", "#16a34a"];

export async function makeChart(opts: NeoChartOptions): Promise<any> {
  const C = await ensureChart();
  const datasets = opts.datasets.map((d, i) => ({
    label: d.label,
    data: d.data,
    borderColor: d.colors || d.color,
    backgroundColor: d.colors || (d.fill ? hexToRgba(d.color, 0.16) : d.color),
    borderWidth: d.colors ? 2 : 3,
    hoverOffset: 6,
    fill: d.fill ?? false,
    tension: 0.38,
    pointRadius: 4,
    pointHoverRadius: 6,
    pointBorderColor: "#171717",
    pointBorderWidth: 2,
    pointBackgroundColor: d.color,
    borderRadius: 6,
    maxBarThickness: 34,
  }));

  const isDoughnut = opts.type === "doughnut";
  const chart = new C(opts.canvas, {
    type: opts.type,
    data: { labels: opts.labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: isDoughnut ? "72%" : undefined,
      plugins: {
        legend: {
          display: datasets.length > 1,
          position: "bottom",
          labels: {
            usePointStyle: true,
            pointStyle: "rect",
            padding: 16,
            boxWidth: 10,
            boxHeight: 10,
            color: "#4a4a4a",
            font: { family: "inherit", weight: "bold" as any, size: 12 },
          },
        },
        tooltip: {
          backgroundColor: "#ffffff",
          titleColor: "#171717",
          bodyColor: "#171717",
          borderColor: "#171717",
          borderWidth: 2,
          cornerRadius: 0,
          padding: 10,
          boxPadding: 4,
          titleFont: { family: "inherit", weight: "bold" as any },
          bodyFont: { family: "inherit" },
        },
      },
      scales: opts.type === "doughnut"
        ? undefined
        : {
            x: {
              grid: { display: false, drawBorder: false },
              ticks: { color: "#8a8a8a", font: { family: "inherit", size: 11 } },
            },
            y: {
              beginAtZero: true,
              grid: { display: true, color: "rgba(23,23,23,.12)", drawBorder: false },
              ticks: { color: "#8a8a8a", font: { family: "inherit", size: 11 }, precision: 0 },
            },
          },
    },
  });
  return chart;
}

export function hexToRgba(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

export function scatterColors(labels: string[]): string[] {
  return labels.map((_, i) => PALETTE[i % PALETTE.length]);
}

export { PALETTE };