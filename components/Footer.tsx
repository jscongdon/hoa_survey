"use client";

import ThemeToggle from "./ThemeToggle";

export default function Footer() {
  return (
    <footer
      className="mt-auto"
      style={{
        borderTop: "1px solid rgba(var(--muted)/0.12)",
        backgroundColor: "rgb(var(--surface))",
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="text-sm" style={{ color: "rgb(var(--muted))" }}>
            © {new Date().getFullYear()} HOA Survey System
          </div>
          <ThemeToggle />
        </div>
      </div>
    </footer>
  );
}
