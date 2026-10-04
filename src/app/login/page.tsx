import { redirect } from "next/navigation";
import AuthForm from "../components/AuthForm";
import Masthead from "../components/Masthead";
import { currentMember } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata = { title: "Sign in | Yuhpp" };

export default async function LoginPage() {
  if (await currentMember()) {
    redirect("/");
  }

  return (
    <>
      <Masthead />
      <main className="page narrow">
        <p className="eyebrow">Your workspace</p>
        <h1 className="title">
          Pick up <em>where you left off.</em>
        </h1>
        <p className="lede">
          Sign in to your Yuhpp workspace, or create an account to start your search.
        </p>
        <AuthForm />
      </main>
    </>
  );
}
