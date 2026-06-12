// Shared helpers for the quiz authoring UI (QuizManagePage and its modals).

// Rows can arrive camelCased (db adapter paths) or snake_cased (raw SQL paths)
// depending on the server code path. Read both casings to stay robust.
export function getField<T = any>(
  obj: Record<string, any> | null | undefined,
  snakeKey: string
): T | undefined {
  if (!obj) return undefined;
  if (obj[snakeKey] !== undefined && obj[snakeKey] !== null) return obj[snakeKey];
  const camelKey = snakeKey.replace(/_([a-z])/g, (_, l: string) => l.toUpperCase());
  if (obj[camelKey] !== undefined && obj[camelKey] !== null) return obj[camelKey];
  return undefined;
}

export function getErrorMessage(err: any, fallback: string): string {
  return err?.response?.data?.error?.message || err?.message || fallback;
}

export const QUESTION_TYPE_LABELS: Record<string, string> = {
  mcq: "Multiple Choice",
  multi_select: "Multiple Select",
  true_false: "True / False",
  fill_blank: "Fill in the Blank",
  essay: "Essay",
  matching: "Matching",
  ordering: "Ordering",
};

// Types the authoring form fully supports. Matching/ordering questions can
// still have their text/points edited, but not their options.
export const AUTHORABLE_QUESTION_TYPES = [
  "mcq",
  "multi_select",
  "true_false",
  "fill_blank",
  "essay",
] as const;

export interface QuestionOptionRow {
  id?: string;
  text: string;
  is_correct: boolean;
}

export function normalizeOptions(question: any): QuestionOptionRow[] {
  const raw = question?.options;
  if (!Array.isArray(raw)) return [];
  return raw.map((o: any) => ({
    id: o?.id,
    text: o?.text ?? "",
    is_correct: Boolean(getField(o, "is_correct")),
  }));
}

export const inputClass =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

export const labelClass = "mb-1 block text-sm font-medium text-gray-700";
