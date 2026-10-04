import { setupChecks } from "@/lib/config";
import { appPath } from "@/lib/paths";

// Render on each request so the checks reflect the live environment.
export const dynamic = "force-dynamic";

export default function Home() {
  const checks = setupChecks();

  return (
    <>
      <header className="masthead">
        <div className="masthead-in">
          <p className="wordmark">
            Yuhpp <span className="bar">|</span> The Job Search System
          </p>
          <span className="tag">App</span>
        </div>
      </header>

      <main className="page">
        <p className="eyebrow">Coming soon</p>
        <h1 className="title">
          Your whole search, <em>in one place.</em>
        </h1>
        <p className="lede">
          The Yuhpp app is under construction. Soon you will sign in, add the jobs you are
          going after, and run every step of the method here, with your work saved as you
          go.
        </p>

        <p className="section-label">Deployment checks</p>
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
