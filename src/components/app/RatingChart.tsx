"use client";

import dynamic from "next/dynamic";
import { ChartSkeleton } from "./LoadingSkeletons";
import type { RatingChartProps, RatingSparklineProps } from "./RatingChart.impl";

/**
 * Bklit-charts (visx + motion, ~9k regels) worden pas geladen als een chart
 * echt op het scherm komt (next/dynamic, ssr:false) — ze zitten dus niet in
 * de gedeelde bundle van elke pagina.
 *
 *   const series = toRatingSeries(history);           // uit ./rating-series
 *   <RatingChart data={series} tierSize={config.tierSize} />
 *   <RatingSparkline data={series} />                  // in StatCard `trailing`
 */
export const RatingChart = dynamic<RatingChartProps>(() => import("./RatingChart.impl"), {
  ssr: false,
  loading: () => <ChartSkeleton aspectRatio="16 / 9" />,
});

export const RatingSparkline = dynamic<RatingSparklineProps>(
  () => import("./RatingChart.impl").then((mod) => mod.RatingSparklineImpl),
  { ssr: false, loading: () => <ChartSkeleton aspectRatio="3 / 1" label="Sparkline laden…" /> },
);

export type { RatingChartProps, RatingSparklineProps };
