"use client";

import { useEffect } from "react";

// On a phone the rail is a sideways row of chips; this brings the current
// stop into view so a page deep in the route does not open with it hidden.

export default function RailScroll() {
  useEffect(() => {
    // Desktop shows the rail as a column; only the phone row scrolls sideways.
    if (!window.matchMedia("(max-width: 900px)").matches) return;
    const rail = document.querySelector<HTMLElement>(".rail");
    const active = rail?.querySelector<HTMLElement>(".stop.is-active");
    if (!rail || !active || rail.scrollWidth <= rail.clientWidth) return;
    const a = active.getBoundingClientRect();
    const r = rail.getBoundingClientRect();
    rail.scrollLeft += a.left - r.left - (rail.clientWidth - a.width) / 2;
  }, []);
  return null;
}
