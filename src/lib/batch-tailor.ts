export interface BatchJob {
  id: string;
  title: string;
  company: string;
  url: string;
  text: string;
  postedDate: string;
  closingDate: string;
  group: string;
}

export interface BatchGroup { id: string; label: string; reason: string }

export function dateFlags(job: Pick<BatchJob, "postedDate" | "closingDate">, now = new Date()): string[] {
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const day = 86400000;
  const daysFromToday = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const parsed = Date.parse(`${value}T00:00:00Z`);
    return Number.isFinite(parsed) ? Math.round((parsed - today) / day) : null;
  };
  const flags: string[] = [];
  const closing = daysFromToday(job.closingDate);
  const posted = daysFromToday(job.postedDate);
  if (closing !== null && closing < 0) flags.push("Closing date passed");
  else if (closing === 0) flags.push("Closes today");
  else if (closing !== null && closing <= 7) flags.push(`Closes in ${closing} ${closing === 1 ? "day" : "days"}`);
  if (posted !== null && posted <= -30) flags.push(`Posted ${Math.floor(-posted)} days ago`);
  if (closing === null && posted === null) flags.push("Dates unknown");
  return flags;
}
