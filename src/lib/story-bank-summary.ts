// The story bank as the run page shows it: what the picker lists and what the
// "This run reads" line counts. Browser-safe; built on the server by
// bankSummary() in story-frame.ts and refreshed from GET /app/api/stories.

export type PickerStory = {
  id: number;
  title: string;
  company: string | null;
  themes: string | null;
  label: string;
  complete: boolean;
};

export type BankSummary = {
  /** Stories a run reads (the picker lists these). */
  stories: PickerStory[];
  /** Stories in the bank, including any too many to fit in one run. */
  total: number;
  themes: number;
};
