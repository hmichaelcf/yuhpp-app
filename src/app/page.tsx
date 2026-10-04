import { redirect } from "next/navigation";
import Masthead from "./components/Masthead";
import { currentMember } from "@/lib/session";

// Signed-in home. Becomes the dashboard in later phases.
export const dynamic = "force-dynamic";

const COMING = [
  { phase: "Phase 2", text: "Onboarding: your direction, resume, and story bank." },
  { phase: "Phase 3", text: "Your jobs: constraint check, Match Meter, and applying." },
  { phase: "Phase 4", text: "Interviews: a prep stack for each round type." },
  { phase: "Phase 5", text: "Your weekly review and the practice loop." },
];

export default async function Home() {
  const member = await currentMember();
  if (!member) {
    redirect("/login");
  }

  return (
    <>
      <Masthead signedIn />
      <main className="page">
        <p className="eyebrow">Signed in</p>
        <h1 className="title">
          Welcome to <em>your workspace.</em>
        </h1>
        <p className="lede">
          You are signed in as <strong>{member.email ?? "a Yuhpp member"}</strong>. Your
          account is ready; the workspace fills in over the next phases.
        </p>

        <p className="section-label">What is coming</p>
        <ul className="checks">
          {COMING.map((item) => (
            <li key={item.phase} className="check pending">
              <span className="dot" aria-hidden="true" />
              <span className="label">{item.phase}</span>
              <span className="detail">{item.text}</span>
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
