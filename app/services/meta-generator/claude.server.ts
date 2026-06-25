import Anthropic from "@anthropic-ai/sdk";
import type { GeneratedMeta, Tone, ResourceType } from "../../types/meta-generator";

let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!_client) {
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _client;
}

const TONE_INSTRUCTIONS: Record<Tone, string> = {
  professional:
    "Use professional, formal language. Focus on features, benefits, and authority.",
  friendly:
    "Use friendly, conversational language. Be approachable, warm, and engaging.",
  minimal:
    "Use concise, minimal language. Be brief, direct, and to the point.",
};

const SYSTEM_PROMPT = `You are an expert Shopify SEO copywriter.

Generate:
- SEO title tag: maximum 60 characters
- Meta description: maximum 160 characters

Requirements:
- Include target keyword naturally if provided
- Avoid keyword stuffing
- Match the specified tone exactly
- No emojis
- No excessive punctuation
- Unique, compelling content
- Return valid JSON only

Response format:
{"title_tag":"","meta_description":""}`;

export async function generateMeta(options: {
  title: string;
  contentHtml: string;
  keyword?: string | null;
  tone: Tone;
  resourceType: ResourceType;
}): Promise<GeneratedMeta> {
  const { title, contentHtml, keyword, tone, resourceType } = options;
  const plainText = contentHtml
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 600);

  const userMessage = [
    `Generate SEO metadata for a Shopify ${resourceType}.`,
    `Title: ${title}`,
    plainText ? `Content: ${plainText}` : "",
    keyword ? `Target Keyword: ${keyword}` : "",
    `Tone: ${tone} — ${TONE_INSTRUCTIONS[tone]}`,
    "",
    "Return ONLY valid JSON.",
  ]
    .filter(Boolean)
    .join("\n");

  const client = getClient();
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 300,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  const rawText =
    response.content[0]?.type === "text" ? response.content[0].text.trim() : "";

  const jsonMatch = rawText.match(/\{[\s\S]*?\}/);
  if (!jsonMatch) {
    throw new Error(`Claude returned invalid JSON: ${rawText.slice(0, 200)}`);
  }

  let parsed: GeneratedMeta;
  try {
    parsed = JSON.parse(jsonMatch[0]) as GeneratedMeta;
  } catch {
    throw new Error(`Failed to parse Claude JSON: ${jsonMatch[0]}`);
  }

  if (!parsed.title_tag || typeof parsed.title_tag !== "string") {
    throw new Error("Missing or invalid title_tag in Claude response");
  }
  if (!parsed.meta_description || typeof parsed.meta_description !== "string") {
    throw new Error("Missing or invalid meta_description in Claude response");
  }
  if (parsed.title_tag.length > 60) {
    parsed.title_tag = parsed.title_tag.slice(0, 60).trim();
  }
  if (parsed.meta_description.length > 160) {
    parsed.meta_description = parsed.meta_description.slice(0, 160).trim();
  }

  return parsed;
}
