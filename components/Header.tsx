"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const [hoaName, setHoaName] = useState<string>("HOA Survey");
  const [hoaLogoUrl, setHoaLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (!mounted) return;
        if (res.ok) {
          const data = await res.json();
          setRole(data.role || null);
        } else {
          setRole(null);
        }
      } catch (err) {
        console.error("Failed to fetch admin role:", err);
        setRole(null);
      }
      // fetch public HOA name and optional logo for display in header
      try {
        const r = await fetch("/api/public/hoa-name");
        if (!mounted) return;
        if (r.ok) {
          const d = await r.json();
          if (d?.hoaName) setHoaName(d.hoaName);
          if (d?.hoaLogoUrl) setHoaLogoUrl(d.hoaLogoUrl);
        }
      } catch (e) {
        // ignore
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Listen for logo update/remove broadcasts from other tabs
  useEffect(() => {
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel("hoa-branding");
      bc.onmessage = (ev) => {
        if (!ev?.data) return;
        const { type } = ev.data;
        if (type === "logo-updated" || type === "logo-removed") {
          // refetch public branding to get latest logo URL
            (async () => {
              try {
                const r = await fetch("/api/public/hoa-name");
                if (r.ok) {
                  const d = await r.json();
                  setHoaName(d.hoaName || "HOA Survey");
                  setHoaLogoUrl(d.hoaLogoUrl || null);
                  try {
                    router.refresh();
                  } catch (err) {
                    // router.refresh may not be available in some environments; ignore
                  }
                }
              } catch (e) {
                // ignore
              }
            })();
        }
      };
    } catch (e) {
      // BroadcastChannel not available; nothing to do
    }
    return () => {
      try {
        if (bc) bc.close();
      } catch (e) {
        /* ignore */
      }
    };
  }, []);

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (e) {
      console.error("Logout failed", e);
    } finally {
      router.push("/login");
    }
  }

  // Hide the entire header on the login page
  if (pathname && (pathname === "/login" || pathname.startsWith("/login/"))) {
    return null;
  }

  return (
    <header className="w-full py-4 flex items-center justify-between border-b border-gray-200 dark:border-gray-700 mb-8 px-4 sm:px-6 lg:px-8">
      <div className="flex items-center">
        <Image
          src={hoaLogoUrl || "/hoasurvey_logo.png"}
          alt={hoaName ? `${hoaName} logo` : "HOA Survey Logo"}
          width={48}
          height={48}
          className="mr-3"
        />
        <span className="text-2xl font-bold tracking-tight">
          {hoaName + " Surveys"}
        </span>
      </div>

      <div className="relative">
        <button
          onClick={() => setOpen((s) => !s)}
          aria-expanded={open}
          aria-haspopup="menu"
          className="inline-flex items-center px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          Menu
          <svg
            className="ml-2 h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden
          >
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 011.08 1.04l-4.25 4.25a.75.75 0 01-1.06 0L5.21 8.27a.75.75 0 01.02-1.06z"
              clipRule="evenodd"
            />
          </svg>
        </button>

        {open && (
          <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg z-20">
            <ul className="py-1">
              <li>
                <button
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                  onClick={() => {
                    setOpen(false);
                    router.push("/dashboard");
                  }}
                >
                  Dashboard
                </button>
              </li>
              {role === "FULL" && (
                <>
                  <li>
                    <button
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                      onClick={() => {
                        setOpen(false);
                        router.push("/dashboard/surveys/create");
                      }}
                    >
                      Create Survey
                    </button>
                  </li>
                  <li>
                    <button
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                      onClick={() => {
                        setOpen(false);
                        router.push("/dashboard/settings");
                      }}
                    >
                      Settings
                    </button>
                  </li>
                </>
              )}
              <li>
                <button
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                  onClick={() => {
                    setOpen(false);
                    handleLogout();
                  }}
                >
                  Logout
                </button>
              </li>
            </ul>
          </div>
        )}
      </div>
    </header>
  );
}
