import React from "react";
import clsx from "clsx";
import { DataCard, DataCardProps } from "./DataCard";

export interface DataGridProps<T> {
  data: T[];
  cardProps: Omit<DataCardProps<T>, "item">;
  loading?: boolean;
  emptyMessage?: string;
  className?: string;
  columns?: {
    default: number;
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
  };
}

export function DataGrid<T>({
  data,
  cardProps,
  loading = false,
  emptyMessage = "No data available",
  className,
  columns = { default: 1, sm: 2, lg: 3 },
}: DataGridProps<T>) {
  if (loading) {
    return (
      <div className={clsx("grid gap-6", className)}>
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="bg-white dark:bg-gray-900 rounded-lg shadow p-4 sm:p-6 animate-pulse"
          >
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-4"></div>
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full mb-2"></div>
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
          </div>
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className={clsx("text-center py-12", className)}>
        <p className="text-gray-600 dark:text-gray-400">{emptyMessage}</p>
      </div>
    );
  }

  const gridClasses = clsx(
    "grid gap-6",
    `grid-cols-${columns.default}`,
    columns.sm && `sm:grid-cols-${columns.sm}`,
    columns.md && `md:grid-cols-${columns.md}`,
    columns.lg && `lg:grid-cols-${columns.lg}`,
    columns.xl && `xl:grid-cols-${columns.xl}`,
    className
  );

  return (
    <div className={gridClasses}>
      {data.map((item, index) => (
        <DataCard key={index} item={item} {...cardProps} />
      ))}
    </div>
  );
}
