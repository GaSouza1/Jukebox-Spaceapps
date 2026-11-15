import { useMemo } from "react";
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
import { StableText } from "../../../components/StableText";
import { summarizeDifference, type ComparisonData } from "../../data/comparison";
import { formatDay, formatMonth } from "../../data/format";
import { indicatorOf } from "../../data/indicators";
import { describeSide, round, signed, type SideStats } from "../../data/seriesStats";

interface Props {
  /** null while the data is loading or could not be loaded. */
  data: ComparisonData | null;
  currentIndex: number;
  /** Shown instead of the chart when there is no data. */
  pendingText: string;
}

const NO_DATA = "No data";

export function ComparisonChart({ data, currentIndex, pendingText }: Props) {
  // Recomputed only when the comparison changes, not at every playback step.
  const summary = useMemo(() => (data ? summarize(data) : null), [data]);
  const chartData = useMemo(
    () => data?.rows.map((row) => ({ date: row.date, a: row.a, b: row.b })) ?? [],
    [data],
  );

  if (!data || !summary) {
    return (
      <section className="chart-card" aria-labelledby="chart-title">
        <div className="chart-header">
          <div>
            <span className="eyebrow">03 / DATA COMPARISON</span>
            <h2 id="chart-title">Monthly history</h2>
          </div>
        </div>
        <p className="chart-pending">
          <StableText>{pendingText}</StableText>
        </p>
      </section>
    );
  }

  const { regionA, regionB, unit, spokenUnit } = data;
  const indicator = indicatorOf(data.indicatorId);
  const active = data.rows[currentIndex];
  const valueOrNone = (value: number | null | undefined) =>
    value === null || value === undefined ? NO_DATA : `${value} ${unit}`;
  const dataKey = `${data.indicatorId}-${regionA.id}-${regionB.id}-${data.period.start}-${data.period.end}`;

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
            <StableText>{`${active ? formatMonth(active.date) : ""} · A · ${regionA.name}`}</StableText>
            <StableText as="strong">{valueOrNone(active?.a)}</StableText>
          </span>
          <span className="orange">
            <StableText>{`B · ${regionB.name}`}</StableText>
            <StableText as="strong">{valueOrNone(active?.b)}</StableText>
          </span>
        </div>
      </div>
      <span id="chart-legend-label" className="sr-only">
        Chart legend
      </span>
      <ul className="legend" aria-labelledby="chart-legend-label">
        <li className="blue">
          <i aria-hidden="true" />{" "}
          <StableText>{`Region A · ${regionA.name} (solid line)`}</StableText>
        </li>
        <li className="orange">
          <i aria-hidden="true" className="dashed" />{" "}
          <StableText>{`Region B · ${regionB.name} (dashed line)`}</StableText>
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
                domain={["auto", "auto"]}
              />
              <Tooltip
                labelFormatter={(label) => formatMonth(String(label))}
                contentStyle={{
                  background: "#101b29",
                  border: "1px solid #314057",
                  borderRadius: 8,
                }}
                formatter={(value, name) => [
                  valueOrNone(value as number | null),
                  name === "a" ? regionA.name : regionB.name,
                ]}
              />
              {active && <ReferenceLine x={active.date} stroke="#edf5ff" strokeDasharray="4 4" />}
              {/* Gaps stay gaps: a missing month is never drawn as a value. */}
              <Line
                type="monotone"
                dataKey="a"
                stroke="#47a9ff"
                dot={false}
                strokeWidth={2.5}
                connectNulls={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="b"
                stroke="#ff9b55"
                strokeDasharray="7 4"
                dot={false}
                strokeWidth={2.5}
                connectNulls={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        {/* One string per summary, so translation sees whole sentences. */}
        <figcaption id="chart-summary" className="chart-summary">
          <strong>Summary.</strong> <StableText>{summary.text}</StableText>
        </figcaption>
      </figure>
      <details className="data-table" id="data-table">
        <summary>
          <StableText>{`Data table: all ${data.rows.length} monthly values`}</StableText>
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
              <StableText>{`Monthly ${indicator.label.toLowerCase()} in ${spokenUnit} (${unit}), ${regionA.name} and ${regionB.name}. "${NO_DATA}" marks a month without a value; differences use only months with both values.`}</StableText>
            </caption>
            <thead key={`head-${dataKey}`}>
              <tr>
                <th scope="col">Month</th>
                <th scope="col">{`Region A · ${regionA.name}`}</th>
                <th scope="col">{`Region B · ${regionB.name}`}</th>
                <th scope="col">Difference (A − B)</th>
              </tr>
            </thead>
            <tbody key={`body-${dataKey}`}>
              {data.rows.map((row, index) => (
                <tr key={row.date} aria-current={index === currentIndex ? "true" : undefined}>
                  <th scope="row">{formatMonth(row.date)}</th>
                  <td className={row.a === null ? "no-data" : undefined}>{valueOrNone(row.a)}</td>
                  <td className={row.b === null ? "no-data" : undefined}>{valueOrNone(row.b)}</td>
                  <td className={row.difference === null ? "no-data" : undefined}>
                    {row.difference === null ? "—" : `${signed(row.difference)} ${unit}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}

/** The figure's text alternative. Every number can be found in the table. */
function summarize(data: ComparisonData) {
  const { regionA, regionB, spokenUnit: u } = data;
  const indicator = indicatorOf(data.indicatorId);
  const statsA = describeSide(data.rows, "a");
  const statsB = describeSide(data.rows, "b");
  const diff = summarizeDifference(data);
  const source = data.provenance.a;

  const regionSentence = (name: string, key: string, s: SideStats) => {
    if (s.mean === null || !s.minPoint || !s.maxPoint)
      return `${name} (${key}) has no data in this period.`;
    const trend =
      s.firstYear && s.lastYear
        ? ` Its ${s.lastYear.year} average is ${signed(s.lastYear.mean - s.firstYear.mean)} ${u} compared with ${s.firstYear.year} (complete years only; two single years do not show a trend).`
        : "";
    return `${name} (${key}): average ${round(s.mean)} ${u}, lowest ${s.minPoint.value} ${u} in ${formatMonth(s.minPoint.date)}, highest ${s.maxPoint.value} ${u} in ${formatMonth(s.maxPoint.date)}.${trend}`;
  };
  const gap =
    diff.meanDifference === null
      ? "No month has data for both regions, so they are not compared."
      : `In the ${diff.monthsUsed} months with data for both, ${regionA.name} averages ${Math.abs(round(diff.meanDifference))} ${u} ${diff.meanDifference >= 0 ? "higher" : "lower"} than ${regionB.name}, and is higher in ${diff.sign.aHigher} of them.`;
  const missing =
    statsA.missing || statsB.missing
      ? ` Months without data: ${regionA.name} ${statsA.missing}, ${regionB.name} ${statsB.missing}; they are left out of every average.`
      : "";

  return {
    text: `Line chart of ${indicator.label.toLowerCase()} in ${u}, one point per month from ${formatMonth(data.period.start)} to ${formatMonth(data.period.end)} (${data.rows.length} months). ${regionSentence(regionA.name, "Region A", statsA)} ${regionSentence(regionB.name, "Region B", statsB)} ${gap}${missing} Source: ${source.provider}, MERRA-2 reanalysis, retrieved ${formatDay(source.retrievedAt)}.`,
  };
}
