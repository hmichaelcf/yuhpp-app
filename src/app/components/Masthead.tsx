import Link from "next/link";
import SignOutButton from "./SignOutButton";

export default function Masthead({
  signedIn = false,
  admin = false,
  wide = false,
}: {
  signedIn?: boolean;
  admin?: boolean;
  /** Full width, to line up with the workspace rail. */
  wide?: boolean;
}) {
  return (
    <header className={wide ? "masthead wide" : "masthead"}>
      <div className="masthead-in">
        <Link href="/" className="wordmark">
          Yuhpp
          <span className="wm-long">
            {" "}
            <span className="bar">|</span> The Job Search System
          </span>
        </Link>
        <span className="tag">App</span>
        {signedIn ? (
          <div className="masthead-actions">
            <Link href="/profile" className="text-button">
              Profile
            </Link>
            {admin ? (
              <Link href="/admin" className="text-button">
                Admin
              </Link>
            ) : null}
            <SignOutButton />
          </div>
        ) : null}
      </div>
    </header>
  );
}
