type SupportedLanguage = "en" | "de";

const isValidTranslationArray = (value: unknown, expectedLength: number): value is string[] => {
  return Array.isArray(value) && value.length === expectedLength && value.every((item) => typeof item === "string");
};

const runTranslationRequest = async (args: {
  texts: string[];
  to: SupportedLanguage;
  apiKey: string;
  model: string;
}): Promise<string[] | null> => {
  const prompt = [
    `Translate each input text to ${args.to === "de" ? "German" : "English"}.`,
    "Return strict JSON with key: translations (string array).",
    "Keep the array length and order exactly identical to input.",
    "Do not omit or merge items.",
    `Input: ${JSON.stringify(args.texts)}`
  ].join("\n");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${args.apiKey}`
    },
    body: JSON.stringify({
      model: args.model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }]
    })
  });

  if (!response.ok) return null;

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const raw = data.choices?.[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(raw) as { translations?: unknown };

  if (!isValidTranslationArray(parsed.translations, args.texts.length)) {
    return null;
  }

  return parsed.translations;
};

export const translateManyTexts = async (args: {
  texts: string[];
  to: SupportedLanguage;
  apiKey?: string;
  model?: string;
}): Promise<string[]> => {
  if (args.to === "en") return args.texts;
  if (!args.apiKey) return args.texts;

  const prepared = args.texts.map((text) => text.trim());
  if (prepared.every((text) => !text)) return args.texts;

  const primaryModel = args.model ?? process.env.OPENAI_MODEL ?? "gpt-4.1-mini";
  const fallbackModel = "gpt-4.1-mini";

  try {
    let translated = await runTranslationRequest({
      texts: prepared,
      to: args.to,
      apiKey: args.apiKey,
      model: primaryModel
    });

    if (!translated && primaryModel !== fallbackModel) {
      translated = await runTranslationRequest({
        texts: prepared,
        to: args.to,
        apiKey: args.apiKey,
        model: fallbackModel
      });
    }

    if (!translated) {
      return args.texts;
    }

    return translated.map((text, idx) => text.trim() || args.texts[idx]);
  } catch {
    return args.texts;
  }
};
