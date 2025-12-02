"use client";

import React, { useEffect, useRef } from "react";

type Props = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
};

export default function Wysiwyg({ value, onChange, placeholder, className }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  // Save selection range when interacting with the editor so actions like
  // creating a link still apply after clicking toolbar buttons
  const savedRange = useRef<Range | null>(null);

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) {
      ref.current.innerHTML = value || "";
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
      let el: HTMLElement | null = node.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : node.parentElement;
      while (el && el !== ref.current) {
        if (el.tagName === 'A') return el as HTMLAnchorElement;
        el = el.parentElement;
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

  return (
    <div className={`${className ?? ""} wysiwyg-wrapper`}>
      <div className="wysiwyg-toolbar mb-2 flex gap-1">
        <button type="button" onMouseDown={() => saveSelection()} onClick={() => exec("bold")} className="wysiwyg-btn">B</button>
        <button type="button" onMouseDown={() => saveSelection()} onClick={() => exec("italic")} className="wysiwyg-btn">I</button>
        <button type="button" onMouseDown={() => saveSelection()} onClick={() => exec("underline")} className="wysiwyg-btn">U</button>
        <button type="button" onMouseDown={() => saveSelection()} onClick={() => exec("insertUnorderedList")} className="wysiwyg-btn">• List</button>
        <button type="button" onMouseDown={() => saveSelection()} onClick={() => exec("insertOrderedList")} className="wysiwyg-btn">1. List</button>
        <button
          type="button"
          onMouseDown={() => saveSelection()}
          onClick={() => {
            // If selection inside an anchor, prefill prompt with existing href and allow editing
            const anchor = findAnchorInSelection();
            const initial = anchor?.getAttribute('href') || 'https://';
            const url = window.prompt('Link URL (https://...)', initial);
            if (url === null) return; // cancelled
            const trimmed = url.trim();
            if (!trimmed) {
              // Remove link if blank
              if (anchor) {
                // Unwrap anchor by replacing it with its text content
                const text = anchor.textContent || '';
                const span = document.createTextNode(text);
                anchor.parentElement?.replaceChild(span, anchor);
                if (ref.current) onChange(ref.current.innerHTML);
              } else {
                exec('unlink');
              }
              return;
            }
            if (anchor) {
              // Edit existing anchor by updating href
              anchor.setAttribute('href', trimmed);
              if (ref.current) onChange(ref.current.innerHTML);
            } else {
              exec('createLink', trimmed);
            }
          }}
          className="wysiwyg-btn"
        >
          Link
        </button>
        <button type="button" onMouseDown={() => saveSelection()} onClick={() => exec("formatBlock", "<h3>") } className="wysiwyg-btn">H3</button>
        <button type="button" onMouseDown={() => saveSelection()} onClick={() => exec("removeFormat")} className="wysiwyg-btn">Clear</button>
      </div>
      <div
        ref={ref}
        onInput={() => onChange(ref.current?.innerHTML || "")}
        contentEditable
        suppressContentEditableWarning
        className="wysiwyg-editor min-h-[100px] px-3 py-2 border rounded"
        data-placeholder={placeholder}
      />
    </div>
  );
}
