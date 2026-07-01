// ─── FAQ schema validator ─────────────────────────────────────────────────────

import type { SchemaValidationResult } from "../../../types/schema-validation";
import { asRecord, createCollector, isNonEmptyString } from "./shared";

export function validateFAQSchema(schema: Record<string, unknown>): SchemaValidationResult {
  const c = createCollector();

  const mainEntity = schema.mainEntity;
  if (!Array.isArray(mainEntity) || mainEntity.length === 0) {
    c.error("mainEntity", "Questions", "No FAQ questions found.", "Add at least one question/answer pair.");
    return c.finalize("FAQPage");
  }

  c.pass("mainEntity", "Questions", `${mainEntity.length} question(s) present.`);

  let validPairs = 0;
  mainEntity.forEach((raw, i) => {
    const q = asRecord(raw);
    const position = i + 1;
    if (!q) {
      c.error(`mainEntity.${i}`, `Question ${position}`, "Entry is not a valid Question object.");
      return;
    }
    const hasQuestion = isNonEmptyString(q.name);
    const answer = asRecord(q.acceptedAnswer);
    const hasAnswer = answer ? isNonEmptyString(answer.text) : false;

    if (!hasQuestion) {
      c.error(`mainEntity.${i}.name`, `Question ${position}`, "Question text is empty.", "Add the question.");
    }
    if (!hasAnswer) {
      c.error(`mainEntity.${i}.acceptedAnswer`, `Answer ${position}`, "Answer text is empty.", "Add the answer.");
    }
    if (hasQuestion && hasAnswer) validPairs += 1;
  });

  if (validPairs > 0) {
    c.pass("pairs", "Q&A Pairs", `${validPairs} complete question/answer pair(s).`);
  }
  if (validPairs < 3 && validPairs > 0) {
    c.suggest("pairs", "Q&A Pairs", "Fewer than 3 FAQ pairs.", "Add more questions to strengthen the FAQ rich result.");
  }

  return c.finalize("FAQPage");
}
