import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface Item {
  name: string;
  price: string;
  imageDataUrl?: string;
}

export async function POST(request: Request) {
  // Validate API key is configured
  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === "your_api_key_here") {
    return Response.json(
      { error: "Anthropic API key is not configured. Please set ANTHROPIC_API_KEY in your .env.local file." },
      { status: 500 }
    );
  }

  const { items }: { items: Item[] } = await request.json();

  if (!items?.length) {
    return Response.json({ error: "No items provided" }, { status: 400 });
  }

  const itemList = items
    .map((item, i) => `${i + 1}. ${item.name} – $${item.price}`)
    .join("\n");

  try {
    const response = await client.messages.create({
      model: "claude-3-opus-20240229",
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: `You are helping a student sell their furniture. Write compelling Craigslist/Facebook Marketplace listings for each item below.

For each item, write:
- A punchy title (max 8 words)
- 2-3 sentences of description (condition, size if relevant, why it's great)
- A call to action

Items:
${itemList}

Format your response as:

## [Item Name] – $[Price]
**Title:** [title]
[description]
[call to action]

---

(repeat for each item)`,
        },
      ],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";

    return Response.json({ copy: text });
  } catch (error) {
    console.error("Error calling Anthropic API:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to generate marketplace copy";
    return Response.json(
      { error: `API Error: ${errorMessage}` },
      { status: 500 }
    );
  }
}
