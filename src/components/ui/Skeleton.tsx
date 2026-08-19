"use client";
import React from "react";

export interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  radius?: string;
}

export function Skeleton({ width = "100%", height = 16, radius = "var(--radius-sm)" }: SkeletonProps) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: radius,
        background: "linear-gradient(90deg, var(--surface-card) 25%, var(--surface-card-hover) 37%, var(--surface-card) 63%)",
        backgroundSize: "400% 100%",
        animation: "harmony-shimmer 1.6s ease-in-out infinite",
      }}
    />
  );
}
