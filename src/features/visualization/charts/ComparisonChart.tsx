import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMonth } from "../../data/demoData";
import type { RegionSeries } from "../../../types/data";

interface Props {
  seriesA: RegionSeries;
  seriesB: RegionSeries;
  currentIndex: number;
}

export function ComparisonChart({ seriesA, seriesB, currentIndex }: Props) {
  const chartData = seriesA.data.map((point, index) => ({
    date: point.date,
    a: point.value,
    b: seriesB.data[index]?.value,
  }));
  const activeDate = chartData[currentIndex]?.date;
  const currentA = seriesA.data[currentIndex]?.value;
  const currentB = seriesB.data[currentIndex]?.value;

  return (
    <section className="chart-card" aria-labelledby="chart-title">
      <div className="chart-header">
        <div>
          <span className="eyebrow">03 / DATA COMPARISON</span>
          <h2 id="chart-title">
            Monthly {seriesA.indicator === "T2M" ? "temperature" : "precipitation"} history
          </h2>
        </div>
        <div className="live-values" aria-live="polite">
          <span className="blue">
            {seriesA.region.name}{" "}
            <strong>
              {currentA} {seriesA.unit}
            </strong>
          </span>
          <span className="orange">
            {seriesB.region.name}{" "}
            <strong>
              {currentB} {seriesB.unit}
            </strong>
          </span>
        </div>
      </div>
      <div className="legend" aria-label="Chart legend">
        <span className="blue">
          <i /> Region A · {seriesA.region.name}
        </span>
        <span className="orange">
          <i /> Region B · {seriesB.region.name}
        </span>
      </div>
      <div className="chart-container" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 12, right: 16, bottom: 5, left: -8 }}>
            <CartesianGrid stroke="#28364a" vertical={false} strokeDasharray="3 4" />
            <XAxis
              dataKey="date"
              tickFormatter={(v) => v.slice(0, 4)}
              minTickGap={55}
              stroke="#718097"
              tickLine={false}
            />
            <YAxis
              unit={` ${seriesA.unit}`}
              stroke="#718097"
              tickLine={false}
              axisLine={false}
              width={70}
            />
            <Tooltip
              labelFormatter={(label) => formatMonth(String(label))}
              contentStyle={{ background: "#101b29", border: "1px solid #314057", borderRadius: 8 }}
              formatter={(value, name) => [
                `${value} ${seriesA.unit}`,
                name === "a" ? seriesA.region.name : seriesB.region.name,
              ]}
            />
            {activeDate && <ReferenceLine x={activeDate} stroke="#edf5ff" strokeDasharray="4 4" />}
            <Line
              type="monotone"
              dataKey="a"
              stroke="#47a9ff"
              dot={false}
              strokeWidth={2.5}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="b"
              stroke="#ff9b55"
              dot={false}
              strokeWidth={2.5}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="sr-only">
        Line chart comparing monthly values. Current month{" "}
        {activeDate ? formatMonth(activeDate) : ""}: {seriesA.region.name} {currentA} {seriesA.unit}
        ;{seriesB.region.name} {currentB} {seriesB.unit}.
      </p>
    </section>
  );
}
