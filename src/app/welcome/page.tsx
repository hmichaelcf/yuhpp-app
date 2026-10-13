import Link from "next/link";
import { redirect } from "next/navigation";
import Masthead from "../components/Masthead";
import PhasePicker from "../components/PhasePicker";
import { isAdmin } from "@/lib/admin";
import { isPhase } from "@/lib/phases";
import { currentMember } from "@/lib/session";

// /app/welcome: "Where are you in your search?" Shown once to new members
// before Home, and whenever they choose Change where I am.

export const dynamic = "force-dynamic";

export const metadata = { title: "Where are you in your search? | Yuhpp" };

export default async function WelcomePage() {
  const member = await currentMember();
  if (!member) redirect("/login");
  const current = isPhase(member.current_phase) ? member.current_phase : null;

  return (
    <>
      <Masthead signedIn admin={isAdmin(member)} />
      <main className="page where-page">
        <p className="eyebrow">{current ? "Change where you are" : "One question before we start"}</p>
        <h1 className="title">
          Where are you in <em>your search?</em>
        </h1>
        <p className="lede">
          Pick the line that sounds most like your week. Home will put the right next step in front of you. You can
          change this any time from Home.
        </p>
        <PhasePicker current={current} />
        {current ? (
          <p className="more-link">
            <Link href="/">Back to Home</Link>
          </p>
        ) : null}
      </main>
    </>
  );
}
