"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import type { BankSummary } from "@/lib/story-bank-summary";
import { groupByTheme } from "@/lib/story-themes";

// Points a run at particular stories without typing their names: the bank
// grouped by theme, as on the STAR stories page. What it adds to the message
// is the stories' labels; the run already holds their full text.

export default function StoryPicker({
  bank,
  onAdd,
  onClose,
  ignore,
}: {
  bank: BankSummary;
  onAdd: (text: string) => void;
  onClose: () => void;
  /** The button that opens the picker; clicking it is not "outside". */
  ignore: RefObject<HTMLElement | null>;
}) {
  const [chosen, setChosen] = useState<Set<number>>(new Set());
  const panel = useRef<HTMLDivElement>(null);
  const { groups, untagged } = groupByTheme(bank.stories);
  const sections = [...groups, ...(untagged.length ? [{ key: "untagged", name: "No theme yet", stories: untagged }] : [])];
  const all = bank.stories.length;

  // The latest onClose, so the listener below is set up once, not on every render.
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });

  useEffect(() => {
    panel.current?.querySelector<HTMLElement>("input")?.focus();
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panel.current?.contains(t) || ignore.current?.contains(t)) return;
      close.current();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [ignore]);

  function toggle(id: number) {
    setChosen((c) => {
      const next = new Set(c);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function add() {
    if (chosen.size === 0) return;
    if (chosen.size === all) return onAdd("Use my whole story bank.");
    const labels = bank.stories.filter((s) => chosen.has(s.id)).map((s) => `"${s.label}"`);
    onAdd(`From my story bank: ${labels.join(", ")}.`);
  }

  return (
    <div
      ref={panel}
      className="picker"
      role="dialog"
      aria-label="Add stories from your bank"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <div className="picker-head">
        <span className="picker-title">Add stories from your bank</span>
        <button type="button" className="text-button" onClick={() => onAdd("Use my whole story bank.")}>
          Use all {all}
        </button>
      </div>
      <div className="picker-body">
        {sections.map((g) => (
          <fieldset key={g.key} className={g.key === "untagged" ? "picker-theme untagged" : "picker-theme"}>
            <legend>{g.name}</legend>
            {g.stories.map((s) => (
              <label key={s.id} className={chosen.has(s.id) ? "picker-row on" : "picker-row"}>
                <input type="checkbox" checked={chosen.has(s.id)} onChange={() => toggle(s.id)} />
                <span className="picker-label">
                  {s.company ? (
                    <>
                      <span className="story-company">{s.company}</span>
                      <span className="story-sep">
                        <span aria-hidden="true">|</span>
                        <span className="sr-only">, </span>
                      </span>
                    </>
                  ) : null}
                  <span className="story-name">{s.title}</span>
                </span>
                {s.complete ? null : <span className="picker-todo">incomplete</span>}
              </label>
            ))}
          </fieldset>
        ))}
      </div>
      <div className="picker-foot">
        <button type="button" className="text-button" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="primary-button inline" onClick={add} disabled={chosen.size === 0}>
          {chosen.size === 0
            ? "Choose stories"
            : `Add ${chosen.size === 1 ? "1 story" : `${chosen.size} stories`} to message`}
        </button>
      </div>
    </div>
  );
}
