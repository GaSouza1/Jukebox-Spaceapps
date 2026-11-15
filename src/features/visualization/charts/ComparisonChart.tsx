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
import { formatMonth, indicators, type IndicatorId } from "../../data/demoData";
import type { RegionSeries } from "../../../types/data";
import { StableText } from "../../../components/StableText";
import { describeSeries, round, signed, type SeriesStats } from "../../data/seriesStats";

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
  const indicator = indicators[seriesA.indicator as IndicatorId];
  const unit = seriesA.unit;
  const statsA = describeSeries(seriesA);
  const statsB = describeSeries(seriesB);
  const meanGap = statsA.mean - statsB.mean;
  const first = seriesA.data[0]?.date;
  const last = seriesA.data.at(-1)?.date;

  // Remounts data-dependent text when the comparison changes (see StableText).
  const dataKey = `${seriesA.indicator}-${seriesA.region.id}-${seriesB.region.id}-${first}-${last}`;
  const regionSentence = (series: RegionSeries, stats: SeriesStats, key: string) =>
    `${series.region.name} (${key}): average ${round(stats.mean)} ${unit}, lowest ${stats.minPoint.value} ${unit} in ${formatMonth(stats.minPoint.date)}, highest ${stats.maxPoint.value} ${unit} in ${formatMonth(stats.maxPoint.date)}. ` +
    (stats.firstYearLabel !== stats.lastYearLabel
      ? `Its ${stats.lastYearLabel} average is ${signed(stats.lastYearMean - stats.firstYearMean)} ${unit} compared with ${stats.firstYearLabel}.`
      : "");

  return (
    <section className="chart-card" aria-labelledby="chart-title">
      <div className="chart-header">
        <div>
          <span className="eyebrow">03 / DATA COMPARISON</span>
          <h2 id="chart-title">
            <StableText>{`Monthly ${indicator.shortLabel.toLowerCase()} history`}</StableText>
          </h2>
        </div>
        {/* Visual readout only: the player announces position changes itself. */}
        <div className="live-values">
          <span className="blue">
            <StableText>{`${activeDate ? formatMonth(activeDate) : ""} · A · ${seriesA.region.name}`}</StableText>
            <StableText as="strong">{`${currentA} ${unit}`}</StableText>
          </span>
          <span className="orange">
            <StableText>{`B · ${seriesB.region.name}`}</StableText>
            <StableText as="strong">{`${currentB} ${unit}`}</StableText>
          </span>
        </div>
      </div>
      <span id="chart-legend-label" className="sr-only">
        Chart legend
      </span>
      <ul className="legend" aria-labelledby="chart-legend-label">
        <li className="blue">
          <i aria-hidden="true" />{" "}
          <StableText>{`Region A · ${seriesA.region.name} (solid line)`}</StableText>
        </li>
        <li className="orange">
          <i aria-hidden="true" className="dashed" />{" "}
          <StableText>{`Region B · ${seriesB.region.name} (dashed line)`}</StableText>
        </li>
      </ul>
      <figure
        className="chart-figure"
        aria-labelledby="chart-title"
        aria-describedby="chart-summary"
      >
        {/* The SVG is decorative for assistive tech; the summary and table below carry the data. */}
        <div className="chart-container" aria-hidden="true">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 12, right: 16, bottom: 5, left: -8 }}
              accessibilityLayer={false}
            >
              <CartesianGrid stroke="#28364a" vertical={false} strokeDasharray="3 4" />
              <XAxis
                dataKey="date"
                tickFormatter={(v) => v.slice(0, 4)}
                minTickGap={55}
                stroke="#8d9aae"
                tickLine={false}
              />
              <YAxis
                unit={` ${unit}`}
                stroke="#8d9aae"
                tickLine={false}
                axisLine={false}
                width={70}
              />
              <Tooltip
                labelFormatter={(label) => formatMonth(String(label))}
                contentStyle={{
                  background: "#101b29",
                  border: "1px solid #314057",
                  borderRadius: 8,
                }}
                formatter={(value, name) => [
                  `${value} ${unit}`,
                  name === "a" ? seriesA.region.name : seriesB.region.name,
                ]}
              />
              {activeDate && (
                <ReferenceLine x={activeDate} stroke="#edf5ff" strokeDasharray="4 4" />
              )}
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
                strokeDasharray="7 4"
                dot={false}
                strokeWidth={2.5}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        {/* One string per summary, so translation sees whole sentences. */}
        <figcaption id="chart-summary" className="chart-summary">
          <strong>Summary.</strong>{" "}
          <StableText>
            {`Line chart of ${indicator.label.toLowerCase()} in ${unit}, one point per month from ${first ? formatMonth(first) : ""} to ${last ? formatMonth(last) : ""} (${seriesA.data.length} months). ${regionSentence(seriesA, statsA, "Region A")} ${regionSentence(seriesB, statsB, "Region B")} Over the whole period, ${seriesA.region.name}'s average is ${Math.abs(round(meanGap))} ${unit} ${meanGap >= 0 ? "higher" : "lower"} than ${seriesB.region.name}'s. Values are synthetic demonstration data.`}
          </StableText>
        </figcaption>
      </figure>
      <details className="data-table" id="data-table">
        <summary>
          <StableText>{`Data table: all ${seriesA.data.length} monthly values`}</StableText>
        </summary>
        {/* Focusable so keyboard users can scroll it; region role makes the label valid. */}
        <div
          className="table-scroll"
          tabIndex={0}
          role="region"
          aria-labelledby="data-table-caption"
        >
          <table>
            <caption id="data-table-caption">
              <StableText>{`Monthly ${indicator.label.toLowerCase()} (${unit}), ${seriesA.region.name} and ${seriesB.region.name}`}</StableText>
            </caption>
            <thead key={`head-${dataKey}`}>
              <tr>
                <th scope="col">Month</th>
                <th scope="col">{`Region A · ${seriesA.region.name}`}</th>
                <th scope="col">{`Region B · ${seriesB.region.name}`}</th>
                <th scope="col">Difference (A − B)</th>
              </tr>
            </thead>
            <tbody key={`body-${dataKey}`}>
              {chartData.map((row, index) => (
                <tr key={row.date} aria-current={index === currentIndex ? "true" : undefined}>
                  <th scope="row">{formatMonth(row.date)}</th>
                  <td>{`${row.a} ${unit}`}</td>
                  <td>{`${row.b} ${unit}`}</td>
                  <td>{row.b === undefined ? "—" : `${signed(row.a - row.b)} ${unit}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
