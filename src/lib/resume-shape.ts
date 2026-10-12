// The resume record: the shape the Yuhpp resume template renders and the
// text prompts read. Shared by the browser and the server; nothing here
// touches the database.

export type ResumeBullet = { id: number | null; text: string };

export type ResumeRole = {
  /** experiences.id; null in a record loaded from an older publish. */
  id: number | null;
  company: string | null;
  title: string | null;
  /** YYYY-MM */
  start: string | null;
  end: string | null;
  current: boolean;
  bullets: ResumeBullet[];
};

export type ResumeReference = { name: string; relationship: string | null; company: string | null };

export type ResumeData = {
  name: string | null;
  /** Up to three keywords, shown as "One, Two, & Three". */
  headline: string[];
  contact: { email: string | null; phone: string | null; location: string | null };
  roles: ResumeRole[];
  skills: string[];
  leadership: string[];
  tools: string[];
  interests: string[];
  references: ResumeReference[];
  education: { school: string | null; degree: string | null; location: string | null };
};

export const LIST_LIMITS = {
  headline: 3,
  skills: 16,
  leadership: 8,
  tools: 20,
  interests: 5,
  references: 3,
  item: 80,
} as const;

/** The sections a prompt can write to with an output block. */
export type ListSection = "headline" | "skills" | "leadership" | "tools" | "interests";

export function emptyResume(): ResumeData {
  return {
    name: null,
    headline: [],
    contact: { email: null, phone: null, location: null },
    roles: [],
    skills: [],
    leadership: [],
    tools: [],
    interests: [],
    references: [],
    education: { school: null, degree: null, location: null },
  };
}

/** True when there is nothing to show beyond contact details from the account. */
export function hasResumeContent(d: ResumeData): boolean {
  return (
    d.roles.length > 0 ||
    d.skills.length > 0 ||
    d.leadership.length > 0 ||
    d.headline.length > 0 ||
    !!d.education.school
  );
}

/** "Marketing Operations, Demand Generation, & Revenue Operations" */
export function headlineText(h: string[]): string {
  const items = h.filter(Boolean);
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} & ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, & ${items[items.length - 1]}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2022-03" becomes "Mar 2022". */
export function monthLabel(ym: string | null): string {
  const m = ym?.match(/^(\d{4})-(\d{2})$/);
  if (!m) return "";
  return `${MONTHS[Number(m[2]) - 1] ?? ""} ${m[1]}`.trim();
}

function nowMonth(now: Date): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** Time in role from two YYYY-MM months, counting both: "2 yrs 3 mos". */
export function tenure(start: string, end: string): string {
  const [ay, am] = start.split("-").map(Number);
  const [by, bm] = end.split("-").map(Number);
  const months = (by - ay) * 12 + (bm - am) + 1;
  if (!Number.isFinite(months) || months < 1) return "";
  const y = Math.floor(months / 12);
  const r = months % 12;
  return [y ? `${y} ${y === 1 ? "yr" : "yrs"}` : "", r ? `${r} ${r === 1 ? "mo" : "mos"}` : ""]
    .filter(Boolean)
    .join(" ");
}

/** "Mar 2022 - Present · 2 yrs 8 mos", or "" with no start date. */
export function roleDates(r: Pick<ResumeRole, "start" | "end" | "current">, now = new Date()): string {
  if (!r.start) return "";
  const endShown = r.current ? "Present" : monthLabel(r.end);
  const range = endShown ? `${monthLabel(r.start)} - ${endShown}` : monthLabel(r.start);
  const endMonth = r.current ? nowMonth(now) : r.end;
  const length = endMonth ? tenure(r.start, endMonth) : "";
  return length ? `${range} · ${length}` : range;
}

/** "MF" from "Michael Fountain". */
export function initials(name: string | null): string {
  return (name ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/**
 * The resume as plain text, the way prompts read it. With ids, each bullet
 * starts with its bullet bank id ("[b12]") so a step can say which bullet it
 * rewrote. References are left out: prompts never need them.
 */
export function resumeText(d: ResumeData, opts: { withIds?: boolean } = {}): string {
  const out: string[] = [];
  if (d.name) out.push(d.name);
  const head = headlineText(d.headline);
  if (head) out.push(head);
  const contact = [d.contact.email, d.contact.phone, d.contact.location].filter(Boolean).join(" | ");
  if (contact) out.push(contact);

  if (d.roles.length) {
    out.push("", "EXPERIENCE");
    for (const r of d.roles) {
      const heading = [r.title, r.company].filter(Boolean).join(", ") || "Role not named yet";
      const dates = roleDates(r);
      out.push("", dates ? `${heading} (${dates})` : heading);
      for (const b of r.bullets) {
        out.push(opts.withIds && b.id ? `- [b${b.id}] ${b.text}` : `- ${b.text}`);
      }
    }
  }
  const list = (label: string, items: string[]) => {
    if (items.length) out.push("", label, ...items.map((i) => `- ${i}`));
  };
  list("SKILLS & KNOWLEDGE", d.skills);
  list("LEADERSHIP", d.leadership);
  list("TOOLS", d.tools);
  const edu = [d.education.school, d.education.degree, d.education.location].filter(Boolean).join(", ");
  if (edu) out.push("", "EDUCATION", edu);
  list("INTERESTS", d.interests);
  return out.join("\n").trim();
}

/** A short fingerprint of a string (FNV-1a), enough to notice an edit. */
export function fingerprint(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/** Everything a reader sees, without ids: equal keys mean an unchanged resume. */
export function resumeContentKey(d: ResumeData): string {
  return JSON.stringify({
    ...d,
    roles: d.roles.map((r) => ({ ...r, id: null, bullets: r.bullets.map((b) => b.text) })),
  });
}

/** Which parts differ between two versions, as section names. */
export function changedSections(now: ResumeData, before: ResumeData | null): string[] {
  const parts: [string, (d: ResumeData) => unknown][] = [
    ["Name", (d) => d.name],
    ["Headline", (d) => d.headline],
    ["Contact", (d) => d.contact],
    ["Roles", (d) => d.roles.map((r) => [r.company, r.title, r.start, r.end, r.current])],
    ["Bullets", (d) => d.roles.map((r) => r.bullets.map((b) => b.text))],
    ["Skills & knowledge", (d) => d.skills],
    ["Leadership", (d) => d.leadership],
    ["Tools", (d) => d.tools],
    ["Interests", (d) => d.interests],
    ["References", (d) => d.references],
    ["Education", (d) => d.education],
  ];
  const empty = emptyResume();
  return parts
    .filter(([, get]) => JSON.stringify(get(now)) !== JSON.stringify(get(before ?? empty)))
    .map(([label]) => label);
}

/** What has to be filled in before the resume can be published. */
export function publishBlockers(d: ResumeData): string[] {
  const out: string[] = [];
  if (!d.name) out.push("Your name");
  if (d.roles.length === 0) out.push("At least one role with bullets");
  for (const r of d.roles) {
    const where = r.company || r.title || "One role";
    const missing = [!r.company ? "company" : "", !r.title ? "title" : "", !r.start ? "start date" : ""].filter(
      Boolean,
    );
    if (missing.length) out.push(`${where}: ${missing.join(", ")}`);
  }
  return out;
}

export type SectionState = "ready" | "needs" | "optional";

export type SectionStatus = {
  key: string;
  label: string;
  detail: string;
  source: string;
  state: SectionState;
  /** Short words for the status pill. */
  pill: string;
};

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** One line per section of the template: what fills it and whether it is ready. */
export function sectionStatuses(d: ResumeData, bulletMax: number): SectionStatus[] {
  const bullets = d.roles.flatMap((r) => r.bullets);
  const long = bullets.filter((b) => b.text.length > bulletMax).length;
  const noTitle = d.roles.filter((r) => !r.title).length;
  const noDates = d.roles.filter((r) => !r.start).length;
  const contactGaps = [!d.contact.email ? "email" : "", !d.contact.phone ? "phone" : "", !d.contact.location ? "location" : ""].filter(
    Boolean,
  );
  const ready = (pill = "Ready"): Pick<SectionStatus, "state" | "pill"> => ({ state: "ready", pill });
  const needs = (pill: string): Pick<SectionStatus, "state" | "pill"> => ({ state: "needs", pill });
  const optional = (pill = "Optional"): Pick<SectionStatus, "state" | "pill"> => ({ state: "optional", pill });

  return [
    {
      key: "headline",
      label: "Headline",
      detail: "three keywords",
      source: "You pick, often from Skills & knowledge",
      ...(d.headline.length ? ready() : needs("Add keywords")),
    },
    {
      key: "contact",
      label: "Contact",
      detail: "email, phone, location",
      source: "Your details",
      ...(contactGaps.length ? needs(`Add ${contactGaps.join(", ")}`) : ready()),
    },
    {
      key: "roles",
      label: "Experience",
      detail: count(d.roles.length, "role", "roles"),
      source: "Your bullet bank",
      ...(d.roles.length === 0
        ? needs("Add roles")
        : noTitle || noDates
          ? needs(
              `Add ${[noTitle ? count(noTitle, "title", "titles") : "", noDates ? count(noDates, "date", "dates") : ""]
                .filter(Boolean)
                .join(", ")}`,
            )
          : ready()),
    },
    {
      key: "bullets",
      label: "Bullets",
      detail: bullets.length
        ? long
          ? `${bullets.length}, ${long} over ${bulletMax} characters`
          : `${bullets.length}, all ${bulletMax} characters or fewer`
        : "none yet",
      source: "Experience Story Builder, Resume Bullet Refinement",
      ...(bullets.length === 0 ? needs("Add bullets") : long ? needs(`${long} too long`) : ready()),
    },
    {
      key: "skills",
      label: "Skills & knowledge",
      detail: d.skills.length ? String(d.skills.length) : "empty",
      source: "Resume Value Builder",
      ...(d.skills.length ? ready() : needs("Run Value Builder")),
    },
    {
      key: "leadership",
      label: "Leadership",
      detail: d.leadership.length ? String(d.leadership.length) : "empty",
      source: "Resume Value Builder",
      ...(d.leadership.length ? ready() : needs("Run Value Builder")),
    },
    {
      key: "tools",
      label: "Tools",
      detail: d.tools.length ? String(d.tools.length) : "empty",
      source: "Read from your upload, then edited by you",
      ...(d.tools.length ? ready() : needs("Add tools")),
    },
    {
      key: "interests",
      label: "Interests",
      detail: d.interests.length ? String(d.interests.length) : "empty",
      source: "Your details",
      ...(d.interests.length ? ready() : optional()),
    },
    {
      key: "education",
      label: "Education",
      detail: d.education.school ?? "empty",
      source: "Your details",
      ...(d.education.school ? ready() : optional()),
    },
    {
      key: "references",
      label: "References",
      detail: d.references.length ? String(d.references.length) : "empty",
      source: "Your details; Reference Prep Coach can use them later",
      ...(d.references.length ? ready() : optional()),
    },
  ];
}
