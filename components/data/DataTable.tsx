import React from "react";
import clsx from "clsx";

export interface Column<T> {
  key: keyof T | string;
  header: string;
  render?: (value: any, item: T) => React.ReactNode;
  className?: string;
  sortable?: boolean;
}

export interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyField: keyof T;
  loading?: boolean;
  emptyMessage?: string;
  className?: string;
  onRowClick?: (item: T) => void;
  striped?: boolean;
  hover?: boolean;
}

export function DataTable<T extends object>({
  data,
  columns,
  keyField,
  loading = false,
  emptyMessage = "No data available",
  className,
  onRowClick,
  striped = true,
  hover = true,
}: DataTableProps<T>) {
  if (loading) {
    return (
      <div
        className={clsx(
          "bg-white dark:bg-gray-900 rounded-lg shadow overflow-hidden",
          className
        )}
      >
        <div className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-2 text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div
        className={clsx(
          "bg-white dark:bg-gray-900 rounded-lg shadow overflow-hidden",
          className
        )}
      >
        <div className="p-8 text-center">
          <p className="text-gray-600 dark:text-gray-400">{emptyMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={clsx(
        "bg-white dark:bg-gray-900 rounded-lg shadow overflow-hidden",
        className
      )}
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-full">
          <thead className="bg-gray-100 dark:bg-gray-800">
            <tr>
              {columns.map((column, index) => (
                <th
                  key={(column.key as string) || index}
                  className={clsx(
                    "px-3 py-3 text-left text-xs sm:text-sm font-semibold text-gray-900 dark:text-white",
                    column.className
                  )}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((item, index) => (
              <tr
                key={item[keyField] as any}
                className={clsx(
                  "border-t border-gray-200 dark:border-gray-700",
                  {
                    "bg-gray-50 dark:bg-gray-800": striped && index % 2 === 1,
                    "hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors":
                      hover,
                    "cursor-pointer": onRowClick,
                  }
                )}
                onClick={() => onRowClick?.(item)}
              >
                {columns.map((column, colIndex) => {
                  const value =
                    column.key in item
                      ? item[column.key as keyof T]
                      : undefined;
                  const content = column.render
                    ? column.render(value, item)
                    : String(value ?? "");

                  return (
                    <td
                      key={(column.key as string) || colIndex}
                      className={clsx(
                        "px-3 py-3 text-xs sm:text-sm text-gray-900 dark:text-white break-words align-top",
                        column.className
                      )}
                    >
                      {content}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
