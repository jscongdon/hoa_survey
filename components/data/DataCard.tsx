import React from "react";
import clsx from "clsx";

export interface DataCardProps<T> {
  item: T;
  title: string | ((item: T) => string);
  subtitle?: string | ((item: T) => string);
  content?: React.ReactNode | ((item: T) => React.ReactNode);
  actions?: React.ReactNode | ((item: T) => React.ReactNode);
  className?: string;
  onClick?: (item: T) => void;
  badge?: string | ((item: T) => string);
  badgeColor?: string;
}

export function DataCard<T>({
  item,
  title,
  subtitle,
  content,
  actions,
  className,
  onClick,
  badge,
  badgeColor = "bg-blue-500",
}: DataCardProps<T>) {
  const titleContent = typeof title === "function" ? title(item) : title;
  const subtitleContent =
    typeof subtitle === "function" ? subtitle(item) : subtitle;
  const contentNode = typeof content === "function" ? content(item) : content;
  const actionsNode = typeof actions === "function" ? actions(item) : actions;
  const badgeContent = typeof badge === "function" ? badge(item) : badge;

  return (
    <div
      className={clsx(
        "bg-white dark:bg-gray-900 rounded-lg shadow p-4 sm:p-6",
        {
          "cursor-pointer hover:shadow-lg transition-shadow": onClick,
        },
        className
      )}
      onClick={() => onClick?.(item)}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white truncate">
              {titleContent}
            </h3>
            {badgeContent && (
              <span
                className={clsx(
                  "px-2 py-1 text-xs font-medium text-white rounded-full",
                  badgeColor
                )}
              >
                {badgeContent}
              </span>
            )}
          </div>
          {subtitleContent && (
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
              {subtitleContent}
            </p>
          )}
        </div>
      </div>

      {contentNode && <div className="mt-4">{contentNode}</div>}

      {actionsNode && (
        <div className="mt-4 flex flex-col sm:flex-row gap-2">
          {actionsNode}
        </div>
      )}
    </div>
  );
}
