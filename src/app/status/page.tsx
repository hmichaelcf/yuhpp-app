import Masthead from "../components/Masthead";
import { setupChecks } from "@/lib/config";
import { storageChecks } from "@/lib/cloudflare";
import { appPath } from "@/lib/paths";

// Render on each request so the checks reflect the live environment.
export const dynamic = "force-dynamic";

export const metadata = { title: "Status | Yuhpp" };

export default async function StatusPage() {
  const checks = [...setupChecks(), ...(await storageChecks())];

  return (
    <>
      <Masthead />
      <main className="page">
        <p className="eyebrow">System status</p>
        <h1 className="title">
          Deployment <em>checks.</em>
        </h1>
        <p className="lede">Configuration and storage for the Yuhpp app. No secret values are shown.</p>

        <p className="section-label">Checks</p>
        <ul className="checks">
          {checks.map((check) => (
            <li key={check.label} className={check.ok ? "check ok" : "check"}>
              <span className="dot" aria-hidden="true" />
              <span className="label">{check.label}</span>
              <span className="detail">{check.detail}</span>
            </li>
          ))}
        </ul>
        <p className="note">
          Machine-readable status: <a href={appPath("/api/health")}>{appPath("/api/health")}</a>
        </p>
      </main>
    </>
  );
}
