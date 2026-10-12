"use client";

import Link from "next/link";
import { useEffect } from "react";

// The bar above the printable resume. It never prints. Opened from
// "Download PDF", it brings up the print window once the fonts are in.

export default function PrintBar({ auto }: { auto: boolean }) {
  useEffect(() => {
    if (!auto) return;
    let done = false;
    const go = () => {
      if (done) return;
      done = true;
      window.print();
    };
    const timer = setTimeout(go, 2500);
    document.fonts?.ready.then(go).catch(() => undefined);
    return () => clearTimeout(timer);
  }, [auto]);

  return (
    <div className="print-bar">
      <p>
        Your resume in the Yuhpp template. In the print window, choose <b>Save as PDF</b>.
      </p>
      <div className="row-actions">
        <button type="button" className="primary-button inline" onClick={() => window.print()}>
          Print or save as PDF
        </button>
        <Link href="/resume" className="quiet-link">
          Back to your resume
        </Link>
      </div>
    </div>
  );
}
