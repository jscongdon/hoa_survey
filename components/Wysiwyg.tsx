"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";

type Props = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
};

export default function Wysiwyg({
  value,
  onChange,
  placeholder,
  className,
}: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  // Save selection range when interacting with the editor so actions like
  // creating a link still apply after clicking toolbar buttons
  const savedRange = useRef<Range | null>(null);

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) {
      ref.current.innerHTML = value || "";
      // Update placeholder state based on new value
      const empty = (ref.current?.textContent || "").trim().length === 0;
      setIsEmpty(empty);
      // Ensure we set placeholder visibility based on content
    }
  }, [value]);

  const restoreSelection = () => {
    try {
      const sel = document.getSelection();
      if (!sel || !savedRange.current) return;
      sel.removeAllRanges();
      sel.addRange(savedRange.current);
    } catch (e) {
      // ignore if selection can't be restored
    }
  };

  const saveSelection = () => {
    try {
      const sel = document.getSelection();
      if (!sel || sel.rangeCount === 0) {
        savedRange.current = null;
        return;
      }
      const range = sel.getRangeAt(0);
      savedRange.current = range.cloneRange();
    } catch (e) {
      savedRange.current = null;
    }
  };

  const findAnchorInSelection = (): HTMLAnchorElement | null => {
    try {
      const sel = document.getSelection();
      if (!sel || sel.rangeCount === 0) return null;
      const node = sel.anchorNode;
      if (!node) return null;
      // Walk up ancestors to find a containing anchor (covers collapsed selections)
      let el: HTMLElement | null =
        node.nodeType === Node.ELEMENT_NODE
          ? (node as HTMLElement)
          : node.parentElement;
      while (el && el !== ref.current) {
        if (el.tagName === "A") return el as HTMLAnchorElement;
        el = el.parentElement;
      }
      // If selection spans multiple nodes, try to locate the first anchor within the range
      if (sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        const walker = document.createTreeWalker(
          range.commonAncestorContainer,
          NodeFilter.SHOW_ELEMENT,
          {
            acceptNode(node: Node) {
              if (node instanceof HTMLAnchorElement)
                return NodeFilter.FILTER_ACCEPT;
              return NodeFilter.FILTER_SKIP;
            },
          } as any
        );
        let n = walker.nextNode() as HTMLAnchorElement | null;
        while (n) {
          // Ensure anchor intersects with the selection range
          const r = document.createRange();
          r.selectNodeContents(n);
          if (
            range.compareBoundaryPoints(Range.END_TO_START, r) < 0 &&
            range.compareBoundaryPoints(Range.START_TO_END, r) > 0
          ) {
            return n;
          }
          n = walker.nextNode() as HTMLAnchorElement | null;
        }
      }
    } catch (e) {
      // ignore
    }
    return null;
  };

  const exec = (cmd: string, arg?: string) => {
    // Focus the editor and restore selection before executing command
    if (ref.current) ref.current.focus();
    restoreSelection();
    try {
      document.execCommand(cmd, false, arg);
    } catch (e) {
      // ignore
    }
    if (ref.current) onChange(ref.current.innerHTML);
  };

  // Normalize URLs before creating links
  const normalizeUrl = (url: string): string => {
    if (!url) return url;
    const trimmed = url.trim();
    if (/^mailto:/i.test(trimmed)) return trimmed;
    if (/^tel:/i.test(trimmed)) return trimmed;
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    // If it looks like host:port or includes a dot, default to https
    if (/^[\w-]+(\.[\w-]+)+/.test(trimmed)) {
      return `https://${trimmed}`;
    }
    return `https://${trimmed}`;
  };

  // When a link is created by exec('createLink'), ensure noreferrer/internal attributes
  const postProcessCreatedLink = () => {
    try {
      const sel = document.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const a = findAnchorInSelection();
      if (!a) return;
      a.setAttribute("target", "_blank");
      a.setAttribute("rel", "noopener noreferrer");
    } catch (e) {
      // ignore
    }
  };

  // Apply a font size by wrapping selection in a span with style font-size
  const applyFontSize = (sizePx: number) => {
    restoreSelection();
    const sel = document.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (range.collapsed) return;
    const span = document.createElement("span");
    span.style.fontSize = `${sizePx}px`;
    try {
      range.surroundContents(span);
    } catch (e) {
      // SurroundContents can throw if selection contains partially selected nodes; fall back to execCommand
      document.execCommand(
        "insertHTML",
        false,
        `<span style="font-size:${sizePx}px">${range.toString()}</span>`
      );
    }
    if (ref.current) onChange(ref.current.innerHTML);
  };

  // Create or update an anchor around the selection
  const createOrUpdateLink = (href: string) => {
    restoreSelection();
    const sel = document.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (range.collapsed) return;
    // Create anchor and set attributes
    const a = document.createElement("a");
    a.href = href;
    a.setAttribute("target", "_blank");
    a.setAttribute("rel", "noopener noreferrer");
    try {
      a.appendChild(range.extractContents());
      range.insertNode(a);
    } catch (e) {
      // If that fails, fallback to execCommand
      try {
        document.execCommand("createLink", false, href);
      } catch (ex) {
        // ignore
      }
    }
    if (ref.current) onChange(ref.current.innerHTML);
  };

  // Debounce change updates to avoid frequent re-renders
  const changeTimeout = useRef<number | null>(null);
  const scheduleChange = useCallback((cb: () => void) => {
    if (changeTimeout.current) window.clearTimeout(changeTimeout.current);
    changeTimeout.current = window.setTimeout(() => {
      changeTimeout.current = null;
      cb();
    }, 200);
  }, []);

  // Keyboard shortcuts for formatting
  const onEditorKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const meta = e.ctrlKey || e.metaKey;
    if (meta && e.key.toLowerCase() === "b") {
      e.preventDefault();
      exec("bold");
    }
    if (meta && e.key.toLowerCase() === "i") {
      e.preventDefault();
      exec("italic");
    }
    if (meta && e.key.toLowerCase() === "u") {
      e.preventDefault();
      exec("underline");
    }
  };

  const [isEmpty, setIsEmpty] = useState(() => {
    if (!value) return true;
    // Strip HTML tags to determine if the supplied value contains visible text
    const text = value.replace(/<[^>]+>/g, "").trim();
    return text.length === 0;
  });

  const onInputDebounced = () => {
    if (!ref.current) return;
    scheduleChange(() => onChange(ref.current?.innerHTML || ""));
    const empty = (ref.current?.textContent || "").trim().length === 0;
    setIsEmpty(empty);
  };

  return (
    <div className={`${className ?? ""} wysiwyg-wrapper`}>
      <div
        role="toolbar"
        aria-label="Formatting toolbar"
        className="wysiwyg-toolbar mb-2 flex gap-1"
      >
        <button
          type="button"
          onMouseDown={() => saveSelection()}
          onClick={() => exec("bold")}
          className="wysiwyg-btn"
        >
          B
        </button>
        <button
          type="button"
          onMouseDown={() => saveSelection()}
          onClick={() => exec("italic")}
          className="wysiwyg-btn"
        >
          I
        </button>
        <button
          type="button"
          onMouseDown={() => saveSelection()}
          onClick={() => exec("underline")}
          className="wysiwyg-btn"
        >
          U
        </button>
        <button
          type="button"
          onMouseDown={() => saveSelection()}
          onClick={() => exec("insertUnorderedList")}
          className="wysiwyg-btn"
        >
          • List
        </button>
        <button
          type="button"
          onMouseDown={() => saveSelection()}
          onClick={() => exec("insertOrderedList")}
          className="wysiwyg-btn"
        >
          1. List
        </button>
        <button
          type="button"
          onMouseDown={() => saveSelection()}
          onClick={() => {
            // If selection inside an anchor, prefill prompt with existing href and allow editing
            const anchor = findAnchorInSelection();
            const initial = anchor?.getAttribute("href") || "https://";
            const url = window.prompt("Link URL (https://...)", initial);
            if (url === null) return; // cancelled
            const trimmed = url.trim();
            if (!trimmed) {
              // Remove link if blank
              if (anchor) {
                // Unwrap anchor by replacing it with its text content
                const text = anchor.textContent || "";
                const span = document.createTextNode(text);
                anchor.parentElement?.replaceChild(span, anchor);
                if (ref.current) onChange(ref.current.innerHTML);
              } else {
                exec("unlink");
              }
              return;
            }
            if (anchor) {
              // Edit existing anchor by updating href
              anchor.setAttribute("href", normalizeUrl(trimmed));
              anchor.setAttribute("target", "_blank");
              anchor.setAttribute("rel", "noopener noreferrer");
              if (ref.current) onChange(ref.current.innerHTML);
            } else {
              createOrUpdateLink(normalizeUrl(trimmed));
            }
          }}
          className="wysiwyg-btn"
          aria-label="Add or edit link"
        >
          Link
        </button>
        <button
          type="button"
          onMouseDown={() => saveSelection()}
          onClick={() => exec("formatBlock", "<h3>")}
          className="wysiwyg-btn"
          aria-label="Heading 3"
        >
          H3
        </button>
        <button
          type="button"
          onMouseDown={() => saveSelection()}
          onClick={() => exec("removeFormat")}
          className="wysiwyg-btn"
        >
          Clear
        </button>
        <div className="ml-2 flex items-center gap-1">
          <button
            title="Small text"
            type="button"
            className="wysiwyg-btn"
            onMouseDown={() => saveSelection()}
            onClick={() => applyFontSize(12)}
            aria-label="Small text"
          >
            A-
          </button>
          <button
            title="Normal text"
            type="button"
            className="wysiwyg-btn"
            onMouseDown={() => saveSelection()}
            onClick={() => applyFontSize(16)}
            aria-label="Normal text"
          >
            A
          </button>
          <button
            title="Large text"
            type="button"
            className="wysiwyg-btn"
            onMouseDown={() => saveSelection()}
            onClick={() => applyFontSize(22)}
            aria-label="Large text"
          >
            A+
          </button>
        </div>
      </div>
      <div
        ref={ref}
        onInput={() => onInputDebounced()}
        onKeyDown={(e) => onEditorKeyDown(e)}
        contentEditable
        role="textbox"
        aria-multiline
        suppressContentEditableWarning
        className={`wysiwyg-editor min-h-[100px] px-3 py-2 border rounded ${isEmpty ? "empty" : ""}`}
        data-placeholder={placeholder}
      />
    </div>
  );
}
