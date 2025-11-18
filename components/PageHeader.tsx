import React from "react";

export default function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="page-header mb-6">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <div>
            <h1
              className="text-3xl font-semibold"
              style={{ color: "rgb(var(--text-primary))" }}
            >
              {title}
            </h1>
            {subtitle && (
              <p
                className="mt-1 text-sm"
                style={{ color: "rgb(var(--muted))" }}
              >
                {subtitle}
              </p>
            )}
          </div>
          {actions && <div className="ml-4 page-header-actions">{actions}</div>}
        </div>
      </div>
    </div>
  );
}
