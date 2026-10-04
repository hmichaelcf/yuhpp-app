import SignOutButton from "./SignOutButton";

export default function Masthead({ signedIn = false }: { signedIn?: boolean }) {
  return (
    <header className="masthead">
      <div className="masthead-in">
        <p className="wordmark">
          Yuhpp <span className="bar">|</span> The Job Search System
        </p>
        <span className="tag">App</span>
        {signedIn ? (
          <div className="masthead-actions">
            <SignOutButton />
          </div>
        ) : null}
      </div>
    </header>
  );
}
