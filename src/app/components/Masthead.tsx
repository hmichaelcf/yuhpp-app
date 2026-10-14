import Link from "next/link";
import SignOutButton from "./SignOutButton";

/**
 * The Route wordmark: the guide's rail (two stops done, one ahead) and
 * "yuhpp" in Instrument Sans 600, outlined. Colors come from the tokens in
 * globals.css (.wm-*), so the mark follows light and dark mode. The same
 * drawing is on the Webflow site and in the Yuhpp design system.
 */
function Wordmark() {
  return (
    <svg
      className="wm-mark"
      viewBox="-10 -740 3226 980"
      role="img"
      aria-label="Yuhpp"
      focusable="false"
    >
      <g transform="scale(1,-1)">
        <line className="wm-track" x1="72" y1="-160" x2="72" y2="470" strokeWidth="34" strokeLinecap="round" />
        <line className="wm-rail" x1="72" y1="155" x2="72" y2="470" strokeWidth="34" />
        <circle className="wm-stop" cx="72" cy="470" r="62" />
        <circle className="wm-stop" cx="72" cy="155" r="62" />
        <circle className="wm-ahead" cx="72" cy="-160" r="45" strokeWidth="34" />
        <g className="wm-letters" transform="translate(284 0)">
          <path d="M99 -205 203 28 5 510H142L270 171L398 510H532L227 -205Z" />
          <path
            transform="translate(518 0)"
            d="M232 -10Q179 -10 140 12Q102 35 82 74Q61 113 61 162V510H187V188Q187 141 210 117Q234 93 277 93Q316 93 346 111Q375 129 392 162Q410 194 410 235V510H537V0H414V95Q390 51 349 24Q299 -10 232 -10Z"
          />
          <path
            transform="translate(1104 0)"
            d="M67 0V720H193V421Q217 461 256 487Q306 520 376 520Q459 520 506 473Q552 426 552 348V0H425V322Q425 369 401 393Q377 417 331 417Q291 417 260 399Q228 381 210 349Q193 317 193 275V0Z"
          />
          <path
            transform="translate(1698 0)"
            d="M358 -10Q285 -10 240 25Q208 48 193 85V-205H67V510H190V426Q207 463 244 487Q294 520 366 520Q434 520 484 488Q535 455 563 396Q591 337 591 257Q591 176 562 116Q533 56 481 23Q429 -10 358 -10ZM326 94Q387 94 423 136Q459 179 459 256Q459 333 422 375Q386 417 325 417Q265 417 228 374Q191 332 191 255Q191 178 228 136Q265 94 326 94Z"
          />
          <path
            transform="translate(2301 0)"
            d="M358 -10Q285 -10 240 25Q208 48 193 85V-205H67V510H190V426Q207 463 244 487Q294 520 366 520Q434 520 484 488Q535 455 563 396Q591 337 591 257Q591 176 562 116Q533 56 481 23Q429 -10 358 -10ZM326 94Q387 94 423 136Q459 179 459 256Q459 333 422 375Q386 417 325 417Q265 417 228 374Q191 332 191 255Q191 178 228 136Q265 94 326 94Z"
          />
        </g>
      </g>
    </svg>
  );
}

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
          <Wordmark />
          <span className="wm-long">The Job Search System</span>
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
