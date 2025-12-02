"use client";

import React, { useEffect, useRef, useState } from "react";
import { useParams, useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { ListLayout } from "@/components/layouts";
import { DataTable } from "@/components/data";

type NonRespondent = {
  responseId: string;
  id: string;
  name: string;
  email?: string | null;
  lotNumber: string;
  address?: string | null;
  token: string;
};

export default function StreamingNonRespondents() {
  const router = useRouter();
  const params = useParams() as { id?: string };
  const surveyId = params?.id;
  const pathname = usePathname();
  const { refreshAuth } = useAuth();

  const [items, setItems] = useState<NonRespondent[]>([]);
  const [loading, setLoading] = useState(true);
  const [streaming, setStreaming] = useState(false);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const seenRef = useRef<Set<string>>(new Set());
  const itemsRef = useRef<NonRespondent[]>([]);
  const pathnameRef = useRef<string | null>(pathname || null);
  const runIdRef = useRef(0);
  const readerRef = useRef<any>(null);
  const autoResumeTriggeredRef = useRef(false);

  const saveCacheNow = React.useCallback((overrideItems?: NonRespondent[]) => {
    if (!surveyId) return;
    try {
      const key = `nonrespondents:${surveyId}`;
      const seen = Array.from(seenRef.current || []);
      const src = overrideItems ?? itemsRef.current ?? [];
      const snapshot = src.map((it) => ({
        responseId: it.responseId,
        id: it.id,
        name: it.name,
        email: it.email || "",
        lotNumber: it.lotNumber,
        address: it.address,
        token: it.token,
      }));
      const payload = {
        items: snapshot,
        seen,
        totalCount,
        ts: Date.now(),
      } as any;
      console.debug("Nonrespondents: immediate save cache", {
        key,
        count: snapshot.length,
        totalCount,
      });
      localStorage.setItem(key, JSON.stringify(payload));
      try {
        const check = localStorage.getItem(key);
        const parsedCheck = check ? JSON.parse(check) : null;
        const emailsSaved = Array.isArray(parsedCheck?.items)
          ? parsedCheck.items.filter((x: any) => x.email && x.email.length)
              .length
          : 0;
        console.debug("Nonrespondents: immediate save verified", {
          key,
          savedCount: parsedCheck?.items?.length ?? 0,
          emailsSaved,
        });
      } catch (e) {
        console.error("Nonrespondents: failed verify immediate save", e);
      }
    } catch (e) {
      console.error("Failed to save cached nonrespondents (immediate)", e);
    }
  }, [surveyId, totalCount]);
  const [remindStatus, setRemindStatus] = useState<Record<string, string>>({});
  const [retryKey, setRetryKey] = useState(0);
  const completedRef = useRef(false);
  const controllerRef = useRef<AbortController | null>(null);
  const [cacheLoaded, setCacheLoaded] = useState(false);
  // cache settings
  const CACHE_TTL_MS = 1000 * 60 * 60; // 1 hour
  const saveTimerRef = useRef<number | null>(null);

  // Filters
  const [lotFilter, setLotFilter] = useState("");
  const [nameFilter, setNameFilter] = useState("");
  const [addressFilter, setAddressFilter] = useState("");

  useEffect(() => {
    if (!surveyId) return;
    if (!cacheLoaded) return; // wait until cache load attempt finishes
    // create an AbortController for this run so we can cancel when the tab becomes hidden
    controllerRef.current = new AbortController();
    const signal = controllerRef.current.signal;

    const run = async () => {
      // mark this run id so other concurrent runs can be ignored
      const myRun = ++runIdRef.current;
      completedRef.current = false;
      // ensure seenRef contains any ids from current in-memory items (safety)
      try {
        for (const it of itemsRef.current || [])
          seenRef.current.add(it.responseId);
      } catch {}
      // ensure localStorage seen is merged too (defensive; may duplicate)
      try {
        console.debug("Nonrespondents: starting stream run", {
          surveyId,
          itemsLoaded: itemsRef.current.length,
          seen: seenRef.current.size,
          runId: myRun,
        });
        // rehydrate seen set from cache in case previous runs persisted it
        try {
          const key = `nonrespondents:${surveyId}`;
          const raw = localStorage.getItem(key);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && Array.isArray(parsed.seen)) {
              parsed.seen.forEach((id: string) => seenRef.current.add(id));
              console.debug(
                "Nonrespondents: merged seen from cache",
                seenRef.current.size
              );
            }
          }
        } catch (e) {
          /* ignore cache read errors */
        }
        const supportsStream =
          typeof window !== "undefined" && !!(window as any).ReadableStream;
        if (supportsStream) {
          setStreaming(true);
          console.debug("Nonrespondents: fetching stream endpoint");
          // if we already have items, ask server to start after the last seen id
          const last =
            itemsRef.current && itemsRef.current.length
              ? itemsRef.current[itemsRef.current.length - 1].responseId
              : undefined;
          const streamUrl = `/api/surveys/${surveyId}/nonrespondents?stream=1${last ? `&afterId=${encodeURIComponent(last)}` : ""}`;
          console.debug("Nonrespondents: stream url", streamUrl);
          const res = await fetch(streamUrl, {
            credentials: "include",
            signal,
          });

          console.debug("Nonrespondents: stream response", {
            ok: res.ok,
            status: res.status,
          });

          if (res.status === 401) {
            await refreshAuth();
            router.push("/login");
            return;
          }

          const ct = res.headers.get("content-type") || "";
          const headerTotal = res.headers.get("x-total-count");
          if (headerTotal && !Number.isNaN(Number(headerTotal)))
            setTotalCount(Number(headerTotal));

          console.debug(
            "Nonrespondents: content-type",
            ct,
            "has ndjson?",
            ct.includes("ndjson")
          );
          console.debug("Nonrespondents: x-total-count", headerTotal);

          if (myRun !== runIdRef.current) {
            console.debug("Nonrespondents: run invalidated before reading", {
              runId: myRun,
            });
            return;
          }
          if (res.ok && res.body && ct.includes("ndjson")) {
            console.debug("Nonrespondents: entering ndjson reader");
            const reader = res.body.getReader();
            readerRef.current = reader;
            const dec = new TextDecoder();
            let buf = "";
            const seen = seenRef.current;

            while (true) {
              let readResult;
              try {
                // before reading, ensure this run is still valid and on the right page
                if (myRun !== runIdRef.current) {
                  console.debug(
                    "Nonrespondents: detected stale run before read",
                    { runId: myRun }
                  );
                  try {
                    await reader.cancel();
                  } catch {}
                  return;
                }
                readResult = await reader.read();
              } catch (err: any) {
                // ignore aborts triggered by controller.abort()
                if (err && err.name === "AbortError") return;
                throw err;
              }
              const { done, value } = readResult;
              console.debug("Nonrespondents: reader.read", {
                done,
                bytes: value ? value.byteLength : 0,
              });
              if (done) break;
              const chunk = dec.decode(value, { stream: true });
              // small debug (truncate to avoid huge logs)
              console.debug(
                "Nonrespondents: stream chunk preview",
                chunk.slice(0, 200)
              );
              buf += chunk;
              const lines = buf.split("\n");
              buf = lines.pop() || "";

              for (const line of lines) {
                if (!line.trim()) continue;
                try {
                  const obj = JSON.parse(line) as NonRespondent;
                  if (!obj?.responseId) continue;
                  if (seen.has(obj.responseId)) {
                    console.debug(
                      "Nonrespondents: skipping duplicate from stream",
                      obj.responseId
                    );
                    continue;
                  }
                  // if route changed while streaming, abort to avoid appending off-page
                  const expectedPrefix = `/dashboard/surveys/${surveyId}/nonrespondents`;
                  if (
                    pathnameRef.current &&
                    !pathnameRef.current.startsWith(expectedPrefix)
                  ) {
                    console.debug(
                      "Nonrespondents: route changed during stream, aborting read",
                      { pathname: pathnameRef.current, runId: myRun }
                    );
                    // invalidate other runs and abort
                    runIdRef.current++;
                    if (controllerRef.current) {
                      controllerRef.current.abort();
                      controllerRef.current = null;
                    }
                    return;
                  }
                  seen.add(obj.responseId);
                  setItems((prev) => {
                    const next = [...prev, obj];
                    itemsRef.current = next;
                    saveCacheNow(next);
                    return next;
                  });
                  console.debug(
                    "Nonrespondents: appended from stream",
                    obj.responseId
                  );
                } catch {
                  // ignore malformed
                }
              }
              if (loading) setLoading(false);
            }

            // flush remainder
            if (buf.trim()) {
              const final = buf.split("\n");
              for (const line of final) {
                if (!line.trim()) continue;
                try {
                  const obj = JSON.parse(line) as NonRespondent;
                  if (!obj?.responseId) continue;
                  if (seen.has(obj.responseId)) continue;
                  if (myRun !== runIdRef.current) {
                    console.debug(
                      "Nonrespondents: run invalidated during final flush",
                      { runId: myRun }
                    );
                    return;
                  }
                  // abort if route changed
                  const expectedPrefix = `/dashboard/surveys/${surveyId}/nonrespondents`;
                  if (
                    pathnameRef.current &&
                    !pathnameRef.current.startsWith(expectedPrefix)
                  ) {
                    console.debug(
                      "Nonrespondents: route changed during final flush, aborting read",
                      { pathname: pathnameRef.current }
                    );
                    if (controllerRef.current) {
                      controllerRef.current.abort();
                      controllerRef.current = null;
                    }
                    return;
                  }
                  seen.add(obj.responseId);
                  setItems((prev) => {
                    const next = [...prev, obj];
                    itemsRef.current = next;
                    saveCacheNow(next);
                    return next;
                  });
                  console.debug(
                    "Nonrespondents: appended final from stream",
                    obj.responseId
                  );
                } catch {
                  // ignore
                }
              }
            }

            console.debug(
              "Nonrespondents: stream reader finished, items now",
              items.length,
              "totalCount",
              totalCount
            );
            // If server reported a total and we still have fewer items, try a fallback fetch to get remaining rows
            if (typeof totalCount === "number" && items.length < totalCount) {
              console.debug(
                "Nonrespondents: stream ended but items < totalCount, fetching remainder",
                { itemsLoaded: items.length, totalCount }
              );
              try {
                const rmore = await fetch(
                  `/api/surveys/${surveyId}/nonrespondents`,
                  { credentials: "include", signal }
                );
                if (rmore.ok) {
                  const bodyMore = await rmore.json();
                  const arr = Array.isArray(bodyMore)
                    ? bodyMore
                    : bodyMore && Array.isArray((bodyMore as any).items)
                      ? (bodyMore as any).items
                      : [];
                  const seenNow = seenRef.current;
                  const toAdd: NonRespondent[] = [];
                  for (const it of arr) {
                    const id = it.responseId || it.id || it.response_id;
                    if (!id) continue;
                    if (seenNow.has(id)) continue;
                    seenNow.add(id);
                    toAdd.push({
                      responseId: id,
                      id: it.id || id,
                      name: it.name || "",
                      email: it.email || it.member?.email || "",
                      lotNumber: it.lotNumber || it.lot || "",
                      address: it.address || null,
                      token: it.token || "",
                    });
                  }
                  if (toAdd.length)
                    setItems((prev) => {
                      const next = [...prev, ...toAdd];
                      itemsRef.current = next;
                      saveCacheNow(next);
                      return next;
                    });
                }
              } catch (e) {
                console.error("Nonrespondents: failed to fetch remainder", e);
              }
            }

            setStreaming(false);
            setLoading(false);
            completedRef.current = true;
            controllerRef.current = null;
            try {
              if (readerRef.current) {
                await readerRef.current.releaseLock?.();
                readerRef.current = null;
              }
            } catch {}
            console.debug(
              "Nonrespondents: stream completed, final items",
              items.length
            );
            return;
          }
        }

        // fallback: fetch full array
        console.debug("Nonrespondents: falling back to full fetch");
        const r2 = await fetch(`/api/surveys/${surveyId}/nonrespondents`, {
          credentials: "include",
          signal,
        });
        if (r2.status === 401) {
          await refreshAuth();
          router.push("/login");
          return;
          controllerRef.current = null;
        }
        if (!r2.ok) throw new Error("fetch failed");
        const body = await r2.json();
        if (Array.isArray(body)) {
          // merge missing items (don't overwrite cached/loaded items)
          const seen = seenRef.current;
          const toAdd: NonRespondent[] = [];
          for (const it of body) {
            const id = it.responseId || it.id || it.response_id;
            if (!id) continue;
            if (seen.has(id)) continue;
            seen.add(id);
            toAdd.push({
              responseId: id,
              id: it.id || id,
              name: it.name || "",
              email: it.email || it.member?.email || "",
              lotNumber: it.lotNumber || it.lot || "",
              address: it.address || null,
              token: it.token || "",
            });
          }
          if (toAdd.length)
            setItems((prev) => {
              const next = [...prev, ...toAdd];
              itemsRef.current = next;
              saveCacheNow(next);
              return next;
            });
          setTotalCount(body.length);
          completedRef.current = true;
        } else if (body && Array.isArray((body as any).items)) {
          const arr = (body as any).items as any[];
          const seen = seenRef.current;
          const toAdd: NonRespondent[] = [];
          for (const it of arr) {
            const id = it.responseId || it.id || it.response_id;
            if (!id) continue;
            if (seen.has(id)) continue;
            seen.add(id);
            toAdd.push({
              responseId: id,
              id: it.id || id,
              name: it.name || "",
              email: it.email || it.member?.email || "",
              lotNumber: it.lotNumber || it.lot || "",
              address: it.address || null,
              token: it.token || "",
            });
          }
          if (toAdd.length)
            setItems((prev) => {
              const next = [...prev, ...toAdd];
              itemsRef.current = next;
              saveCacheNow(next);
              return next;
            });
          setTotalCount((body as any).total ?? arr.length);
          completedRef.current = true;
        } else {
          setError("Unexpected response shape");
        }
      } catch (err) {
        // ignore AbortError caused by controller.abort()
        if ((err as any)?.name === "AbortError") {
          return;
        }
        setError(String(err));
      } finally {
        setLoading(false);
        setStreaming(false);
        controllerRef.current = null;
      }
    };

    run();
    const thisRun = runIdRef.current;
    return () => {
      // abort any in-flight fetch/reader for this run
      if (controllerRef.current) {
        try {
          // Do not mutate runIdRef here (it may be updated by other runs)
        } catch {}
        try {
          controllerRef.current.abort();
        } catch {}
        controllerRef.current = null;
      }
      if (readerRef.current) {
        try {
          readerRef.current.cancel?.();
        } catch (e) {}
        readerRef.current = null;
      }
    };
  }, [surveyId, refreshAuth, router, retryKey, saveCacheNow, cacheLoaded, items.length, loading, totalCount]);

  // If the user switches tabs or the window regains focus, attempt to resume streaming
  useEffect(() => {
    const onVisible = () => {
      if (typeof document === "undefined") return;
      if (document.visibilityState === "visible") {
        if (!completedRef.current && !streaming) setRetryKey((k) => k + 1);
      } else {
        // when tab becomes hidden, abort any in-progress stream so we can restart cleanly later
        if (controllerRef.current && !completedRef.current) {
          // invalidate current run and abort
          runIdRef.current++;
          controllerRef.current.abort();
          controllerRef.current = null;
          setStreaming(false);
        }
      }
    };

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [streaming]);

  // Abort stream if route/path changes away from this nonrespondents page
  useEffect(() => {
    if (!surveyId || !pathname) return;
    // keep pathnameRef updated
    pathnameRef.current = pathname;
    const expectedPrefix = `/dashboard/surveys/${surveyId}/nonrespondents`;
    if (pathname.startsWith(expectedPrefix)) {
      // when arriving at the page, allow auto-resume to trigger
      autoResumeTriggeredRef.current = false;
    } else {
      if (controllerRef.current && !completedRef.current) {
        console.debug("Nonrespondents: route changed away, aborting stream", {
          pathname,
        });
        // invalidate current run and abort
        runIdRef.current++;
        controllerRef.current.abort();
        controllerRef.current = null;
        setStreaming(false);
      }
    }
  }, [pathname, surveyId]);

  // When the cache load completes and we are on the page, auto-trigger a resume once
  useEffect(() => {
    if (!surveyId) return;
    if (!cacheLoaded) return;
    // only once per visit; reset on navigation back to page
    if (autoResumeTriggeredRef.current) return;
    if (completedRef.current) return;
    if (streaming) return;
    // if we already have all items, nothing to resume
    if (typeof totalCount === "number" && itemsRef.current.length >= totalCount)
      return;
    // ensure we're actually on the expected page
    const expectedPrefix = `/dashboard/surveys/${surveyId}/nonrespondents`;
    if (!pathnameRef.current || !pathnameRef.current.startsWith(expectedPrefix))
      return;

    console.debug("Nonrespondents: auto-triggering resume on page open");
    setRetryKey((k) => k + 1);
    autoResumeTriggeredRef.current = true;
  }, [cacheLoaded, surveyId, totalCount, streaming, saveCacheNow, CACHE_TTL_MS]);

  // Load cached nonrespondents for this survey (if any and not expired)
  useEffect(() => {
    if (!surveyId) return;
    try {
      const key = `nonrespondents:${surveyId}`;
      const raw = localStorage.getItem(key);
      if (!raw) {
        setCacheLoaded(true);
        return;
      }
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") {
        setCacheLoaded(true);
        return;
      }
      const {
        items: cachedItems,
        seen: cachedSeen,
        totalCount: cachedTotal,
        ts,
      } = parsed as any;
      if (!Array.isArray(cachedItems) || !ts) {
        setCacheLoaded(true);
        return;
      }
      if (Date.now() - ts > CACHE_TTL_MS) {
        // stale
        localStorage.removeItem(key);
        setCacheLoaded(true);
        return;
      }

      // defensive mapping: ensure each cached item has responseId and token
      const mapped: NonRespondent[] = cachedItems
        .map((it: any) => ({
          responseId: it.responseId || it.id || it.response_id || "",
          id: it.id || it.memberId || it.responseId || "",
          name: it.name || "",
          email: it.email || it.member?.email || "",
          lotNumber: it.lotNumber || it.lot || "",
          address: it.address || it.addr || null,
          token: it.token || "",
        }))
        .filter((x) => x.responseId);

      // restore
      if (mapped.length) {
        setItems(mapped);
      }
      if (typeof cachedTotal === "number") setTotalCount(cachedTotal);
      const seen = seenRef.current;
      if (Array.isArray(cachedSeen))
        cachedSeen.forEach((id: string) => seen.add(id));
      setLoading(false);
      console.debug("Nonrespondents: loaded cached items", mapped.length);
    } catch (e) {
      // ignore cache errors
      console.error("Failed to load cached nonrespondents", e);
    } finally {
      setCacheLoaded(true);
    }
  }, [surveyId, CACHE_TTL_MS]);

  // Persist cache when items change (debounced)
  useEffect(() => {
    if (!surveyId) return;
    // clear previous timer
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current as any);

    const doSave = () => {
      try {
        const key = `nonrespondents:${surveyId}`;
        const seen = Array.from(seenRef.current || []);
        // snapshot plain objects to avoid any unexpected properties
        const src = itemsRef.current || items;
        const snapshot = src.map((it) => ({
          responseId: it.responseId,
          id: it.id,
          name: it.name,
          email: it.email || "",
          lotNumber: it.lotNumber,
          address: it.address,
          token: it.token,
        }));
        const payload = {
          items: snapshot,
          seen,
          totalCount,
          ts: Date.now(),
        } as any;
        console.debug("Nonrespondents: saving cache", {
          key,
          count: snapshot.length,
          totalCount,
        });
        localStorage.setItem(key, JSON.stringify(payload));
        try {
          const check = localStorage.getItem(key);
          const parsedCheck = check ? JSON.parse(check) : null;
          const emailsSaved = Array.isArray(parsedCheck?.items)
            ? parsedCheck.items.filter((x: any) => x.email && x.email.length)
                .length
            : 0;
          console.debug("Nonrespondents: debounced save verified", {
            key,
            savedCount: parsedCheck?.items?.length ?? 0,
            emailsSaved,
          });
        } catch (e) {
          console.error("Nonrespondents: failed verify debounced save", e);
        }
      } catch (e) {
        console.error("Failed to save cached nonrespondents", e);
      }
    };

    saveTimerRef.current = window.setTimeout(() => {
      doSave();
      saveTimerRef.current = null;
    }, 500);

    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current as any);
        saveTimerRef.current = null;
      }
      // flush immediately on cleanup
      try {
        doSave();
      } catch (e) {
        /* ignore */
      }
    };
  }, [items, totalCount, surveyId]);

  // keep a stable ref of items so other async callbacks can access latest
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const loaded = items.length;

  // Prompt and send individual reminder
  const confirmAndSend = async (rid: string, displayLabel: string) => {
    if (!surveyId) return;
    const proceed = window.confirm(
      `Send reminder to ${displayLabel}? This will email the resident.`
    );
    if (!proceed) return;
    setRemindStatus((s) => ({ ...s, [rid]: "Sending..." }));
    try {
      const res = await fetch(`/api/surveys/${surveyId}/remind/${rid}`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        setRemindStatus((s) => ({ ...s, [rid]: `Reminder sent!` }));
        setTimeout(
          () =>
            setRemindStatus((s) => {
              const n = { ...s };
              delete n[rid];
              return n;
            }),
          3000
        );
      } else {
        let data: any = {};
        try {
          data = await res.json();
        } catch {}
        setRemindStatus((s) => ({
          ...s,
          [rid]: data?.error || "Failed to send reminder",
        }));
        setTimeout(
          () =>
            setRemindStatus((s) => {
              const n = { ...s };
              delete n[rid];
              return n;
            }),
          3000
        );
      }
    } catch (e) {
      setRemindStatus((s) => ({ ...s, [rid]: "Error sending reminder" }));
      setTimeout(
        () =>
          setRemindStatus((s) => {
            const n = { ...s };
            delete n[rid];
            return n;
          }),
        3000
      );
    }
  };

  const subtitle = (
    <span className="flex items-center space-x-3">
      <span className="text-sm text-gray-600 dark:text-gray-400">
        Loaded {loaded}
        {totalCount !== null ? ` / ${totalCount}` : ""} nonrespondents
      </span>
      {streaming && (
        <svg className="animate-spin h-4 w-4 text-blue-600" viewBox="0 0 24 24">
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth={4}
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      )}
    </span>
  );

  // apply filters
  const lcLot = lotFilter.trim().toLowerCase();
  const lcName = nameFilter.trim().toLowerCase();
  const lcAddr = addressFilter.trim().toLowerCase();

  const filtered = items.filter((r) => {
    const lotMatch =
      !lcLot || (r.lotNumber || "").toLowerCase().includes(lcLot);
    const nameMatch = !lcName || (r.name || "").toLowerCase().includes(lcName);
    const addrMatch =
      !lcAddr || ((r.address || "") as string).toLowerCase().includes(lcAddr);
    return lotMatch && nameMatch && addrMatch;
  });

  const actions = [
    {
      label: "Dashboard",
      onClick: () => router.push("/dashboard"),
      variant: "secondary" as const,
    },
  ];

  return (
    <ListLayout
      title="Nonrespondents"
      subtitle={subtitle}
      isLoading={loading}
      actions={actions}
    >
      <div className="mb-4 grid grid-cols-1 md:grid-cols-4 gap-4">
        <input
          type="text"
          placeholder="Filter by Lot"
          value={lotFilter}
          onChange={(e) => setLotFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        />
        <input
          type="text"
          placeholder="Filter by Name"
          value={nameFilter}
          onChange={(e) => setNameFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        />
        <input
          type="text"
          placeholder="Filter by Address"
          value={addressFilter}
          onChange={(e) => setAddressFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        />
        <div>
          <button
            onClick={() => {
              setLotFilter("");
              setNameFilter("");
              setAddressFilter("");
            }}
            className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
          >
            Clear
          </button>
        </div>
      </div>

      {/* compute filtered items */}
      {/** Keep original order but apply client-side filters */}
      {/* no-op: filtered computed below */}

      <div className="overflow-x-auto">
        <div className="hidden md:block">
          <DataTable
            data={filtered}
            keyField="responseId"
            emptyMessage={
              items.length === 0
                ? "All members have responded to this survey."
                : "No nonrespondents match the current filters."
            }
            columns={[
              {
                key: "lotNumber",
                header: "Lot",
                render: (v) => <span className="font-medium">{v}</span>,
              },
              {
                key: "name",
                header: "Name",
                render: (v) => <span className="font-medium">{v}</span>,
              },
              {
                key: "email",
                header: "Email",
                render: (v) =>
                  v ? (
                    <a
                      className="text-blue-600 hover:underline"
                      href={`mailto:${v}`}
                    >
                      {v}
                    </a>
                  ) : (
                    <span className="text-sm text-gray-500 italic">
                      No email
                    </span>
                  ),
              },
              { key: "address", header: "Address", render: (v) => v || "N/A" },
              {
                key: "actions",
                header: "Actions",
                render: (_v, row) => (
                  <div className="flex gap-2">
                    <button
                      onClick={() => router.push(`/survey/${row.token}`)}
                      className="px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
                    >
                      Submit Response
                    </button>
                    <button
                      onClick={() =>
                        confirmAndSend(
                          row.responseId as string,
                          `${row.name || row.lotNumber || "member"}`
                        )
                      }
                      disabled={!!remindStatus[row.responseId]}
                      className="px-3 py-1 bg-indigo-500 text-white text-xs rounded hover:bg-indigo-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      {remindStatus[row.responseId]
                        ? remindStatus[row.responseId]
                        : "Remind"}
                    </button>
                  </div>
                ),
              },
            ]}
          />
        </div>

        <div className="block md:hidden space-y-4">
          {items.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              All members have responded to this survey.
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              No nonrespondents match the current filters.
            </div>
          ) : (
            filtered.map((r) => (
              <div
                key={r.responseId}
                className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900 dark:text-white truncate">
                        {r.name}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Lot {r.lotNumber}
                    </div>
                    {r.email ? (
                      <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        <a
                          className="text-blue-600 hover:underline"
                          href={`mailto:${r.email}`}
                        >
                          {r.email}
                        </a>
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500 dark:text-gray-400 mt-1 italic">
                        No email
                      </div>
                    )}
                    {r.address && (
                      <div className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                        {r.address}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 justify-end">
                  <button
                    onClick={() => router.push(`/survey/${r.token}`)}
                    className="px-4 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 w-full sm:w-auto"
                  >
                    Submit Response
                  </button>
                  <button
                    onClick={() =>
                      confirmAndSend(
                        r.responseId,
                        `${r.name || r.lotNumber || "member"}`
                      )
                    }
                    disabled={!!remindStatus[r.responseId]}
                    className="px-4 py-2 bg-indigo-500 text-white text-sm rounded-lg hover:bg-indigo-600 w-full sm:w-auto disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {remindStatus[r.responseId]
                      ? remindStatus[r.responseId]
                      : "Remind"}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </ListLayout>
  );
}
