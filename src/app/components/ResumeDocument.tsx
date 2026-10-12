import {
  headlineText,
  initials,
  roleDates,
  type ResumeData,
  type ResumeRole,
} from "@/lib/resume-shape";

// The Yuhpp resume template: two US Letter pages, rebuilt from the original
// "Resume Template.pdf" in points (name 28 semibold, headline 16, company 12
// semibold, title 11, dates 9, bullets and side lists 10). Styles are the
// .rp- rules in globals.css.
//
// Empty fields show as amber gaps ("Add title") on screen and are left off
// when printed. The photo circle shows "Upload your headshot here" on screen;
// photos cannot be uploaded yet, so the printed copy shows initials instead.

const ROLES_ON_PAGE_ONE = 2;

function Gap({ children }: { children: React.ReactNode }) {
  return <span className="rp-gap">{children}</span>;
}

function Role({ r }: { r: ResumeRole }) {
  const dates = roleDates(r);
  return (
    <div className="rp-role">
      <p className="rp-company">{r.company || <Gap>Add company</Gap>}</p>
      <p className="rp-title">{r.title || <Gap>Add title</Gap>}</p>
      <p className="rp-dates">{dates || <Gap>Add dates</Gap>}</p>
      <ul className="rp-bullets">
        {r.bullets.length ? (
          r.bullets.map((b, i) => <li key={b.id ?? i}>{b.text}</li>)
        ) : (
          <li>
            <Gap>Add bullets in your bullet bank</Gap>
          </li>
        )}
      </ul>
    </div>
  );
}

function SideList({ items, empty }: { items: string[]; empty: string }) {
  return (
    <ul className="rp-side-list">
      {items.length ? (
        items.map((x) => <li key={x}>{x}</li>)
      ) : (
        <li>
          <Gap>{empty}</Gap>
        </li>
      )}
    </ul>
  );
}

export default function ResumeDocument({ data }: { data: ResumeData }) {
  const first = data.roles.slice(0, ROLES_ON_PAGE_ONE);
  const rest = data.roles.slice(ROLES_ON_PAGE_ONE);
  const head = headlineText(data.headline);
  const edu = data.education;

  return (
    <div className="rp-doc">
      <section className="rp-page" aria-label="Resume, page 1">
        <div className="rp-left rp-p1-left">
          <h2 className="rp-name">{data.name || <Gap>Add your name</Gap>}</h2>
          <p className="rp-headline">{head || <Gap>Add three keywords</Gap>}</p>
          <p className="rp-label rp-p1-label">Experience</p>
          <div className="rp-roles">
            {first.length ? (
              first.map((r, i) => <Role key={r.id ?? `r${i}`} r={r} />)
            ) : (
              <p className="rp-company">
                <Gap>Add your roles in the bullet bank</Gap>
              </p>
            )}
          </div>
        </div>

        <div className="rp-photo">
          <span className="rp-photo-ph">Upload your headshot here</span>
          <span className="rp-photo-initials" aria-hidden="true">
            {initials(data.name)}
          </span>
        </div>

        <div className="rp-right rp-p1-right">
          <p className="rp-side">{data.contact.email || <Gap>Add email</Gap>}</p>
          <p className="rp-side">{data.contact.phone || <Gap>Add phone</Gap>}</p>
          <p className="rp-side">{data.contact.location || <Gap>Add location</Gap>}</p>
          <div className={`rp-side-block rp-first-block${data.skills.length ? "" : " rp-empty-print"}`}>
            <p className="rp-side-head">Skills &amp; knowledge</p>
            <SideList items={data.skills} empty="Run Resume Value Builder" />
          </div>
          <div className={`rp-side-block${data.leadership.length ? "" : " rp-empty-print"}`}>
            <p className="rp-side-head">Leadership</p>
            <SideList items={data.leadership} empty="Run Resume Value Builder" />
          </div>
          <div className={`rp-side-block${data.tools.length ? "" : " rp-empty-print"}`}>
            <p className="rp-side-head">Tools</p>
            <SideList items={data.tools} empty="Add tools" />
          </div>
        </div>
        <p className="rp-pagenum">Page 1 of 2</p>
      </section>

      <section className="rp-page" aria-label="Resume, page 2">
        {rest.length ? (
          <div className="rp-left rp-p2-left">
            <p className="rp-label">Experience cont.</p>
            <div className="rp-roles">
              {rest.map((r, i) => (
                <Role key={r.id ?? `r${i + ROLES_ON_PAGE_ONE}`} r={r} />
              ))}
            </div>
          </div>
        ) : null}

        <div className="rp-right rp-p2-right">
          <div className={data.references.length ? "" : "rp-empty-print"}>
            <p className="rp-side-head">References</p>
            <div className="rp-refs">
              {data.references.length ? (
                data.references.map((r) => (
                  <p key={r.name} className="rp-ref">
                    {[r.name, r.relationship, r.company].filter(Boolean).join(", ")}
                  </p>
                ))
              ) : (
                <p className="rp-ref">
                  <Gap>Add a reference: name, relationship, company</Gap>
                </p>
              )}
            </div>
            <p className="rp-note">Reach out for direct contact info.</p>
          </div>
          <div className={data.interests.length ? "rp-side-block" : "rp-side-block rp-empty-print"}>
            <p className="rp-side-head">Interests</p>
            <SideList items={data.interests} empty="Add up to five interests" />
          </div>
        </div>

        <div className={edu.school ? "rp-edu" : "rp-edu rp-empty-print"}>
          <p className="rp-label">Education</p>
          <p className="rp-school">{edu.school || <Gap>Add school</Gap>}</p>
          <p className="rp-degree">{edu.degree || <Gap>Add degree and area of study</Gap>}</p>
          <p className="rp-place">{edu.location || <Gap>Add location</Gap>}</p>
        </div>
        <p className="rp-pagenum">Page 2 of 2</p>
      </section>
    </div>
  );
}
