"use client";

import { useReducedMotion } from "motion/react";
import { useMemo } from "react";
import { Area, AreaChart } from "@/components/charts/area-chart";
import { Grid } from "@/components/charts/grid";
import { Line, LineChart } from "@/components/charts/line-chart";
import { ChartYDomainFit } from "@/components/charts/time-series-chart-shell";
import { ChartTooltip } from "@/components/charts/tooltip/chart-tooltip";
import { XAxis } from "@/components/charts/x-axis";
import { YAxis } from "@/components/charts/y-axis";
import { cn } from "@/lib/utils";
import { formatRating } from "./format";
import { type RatingPoint, tierBoundaries } from "./rating-series";


export type RatingChartProps = {
  /** Oplopend gesorteerd — gebruik toRatingSeries() op API-data. */
  data: RatingPoint[];
  /** Tekent gestippelde hulplijnen op de tier-grenzen (waarde uit de API/platform_config). */
  tierSize?: number;
  aspectRatio?: string;
  className?: string;
  /** Toegankelijke samenvatting; standaard "Rating van X naar Y". */
  label?: string;
};

function defaultLabel(data: RatingPoint[]) {
  if (data.length === 0) return "Geen ratinggeschiedenis";
  const first = data[0].rating;
  const last = data[data.length - 1].rating;
  return `Ratingverloop over ${data.length - 1} wedstrijden: van ${formatRating(first)} naar ${formatRating(last)}`;
}

export default function RatingChartImpl({ data, tierSize, aspectRatio = "16 / 9", className, label }: RatingChartProps) {
  const reduceMotion = useReducedMotion();
  const chartData = useMemo(() => data.map((p) => ({ date: p.date, rating: p.rating })), [data]);
  const boundaries = useMemo(() => {
    if (!tierSize || data.length === 0) return [];
    let min = Infinity;
    let max = -Infinity;
    for (const p of data) {
      if (p.rating < min) min = p.rating;
      if (p.rating > max) max = p.rating;
    }
    return tierBoundaries(min, max, tierSize);
  }, [data, tierSize]);

  return (
    <figure className={cn("m-0", className)}>
      <figcaption className="sr-only">{label ?? defaultLabel(data)}</figcaption>
      <ChartYDomainFit>
      <AreaChart
        data={chartData}
        aspectRatio={aspectRatio}
        margin={{ top: 16, right: 16, bottom: 36, left: 48 }}
        animationDuration={reduceMotion ? 0 : 900}
      >
        <Grid
          horizontal
          numTicksRows={4}
          highlightRowValues={boundaries}
          highlightRowStroke="var(--chart-foreground-muted)"
          highlightRowStrokeOpacity={0.5}
          highlightRowStrokeDasharray="2,4"
        />
        <Area dataKey="rating" fill="var(--chart-1)" stroke="var(--chart-1)" strokeWidth={2.5} fadeEdges={false} />
        <YAxis numTicks={4} formatValue={(v) => formatRating(v)} />
        <XAxis numTicks={4} />
        <ChartTooltip
          rows={(point) => [
            { color: "var(--chart-1)", label: "Rating", value: formatRating(Number(point.rating)) },
          ]}
        />
      </AreaChart>
      </ChartYDomainFit>
    </figure>
  );
}

export type RatingSparklineProps = {
  data: RatingPoint[];
  className?: string;
  label?: string;
};

/** Mini-lijn zonder assen/tooltip; kleur volgt de trend (win/loss). */
export function RatingSparklineImpl({ data, className, label }: RatingSparklineProps) {
  const chartData = useMemo(() => data.map((p) => ({ date: p.date, rating: p.rating })), [data]);
  const trendUp = data.length < 2 || data[data.length - 1].rating >= data[0].rating;
  const color = trendUp ? "var(--win)" : "var(--loss)";

  if (data.length < 2) return null;

  return (
    <div role="img" aria-label={label ?? defaultLabel(data)} className={cn("pointer-events-none", className)}>
      <ChartYDomainFit>
      <LineChart data={chartData} aspectRatio="3 / 1" margin={{ top: 4, right: 3, bottom: 4, left: 3 }} animationDuration={0}>
        <Line dataKey="rating" stroke={color} strokeWidth={2} fadeEdges={false} showHighlight={false} animate={false} />
      </LineChart>
      </ChartYDomainFit>
    </div>
  );
}
