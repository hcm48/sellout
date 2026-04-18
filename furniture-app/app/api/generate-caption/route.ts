import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface CaptionRequest {
  imageDataUrl: string;
}

export async function POST(request: Request) {
  const { imageDataUrl }: CaptionRequest = await request.json();

  if (!imageDataUrl) {
    return Response.json({ error: "No image provided" }, { status: 400 });
  }

  try {
    // Extract base64 data from data URL
    const dataUrlParts = imageDataUrl.split(',');
    if (dataUrlParts.length !== 2) {
      return Response.json({ error: "Invalid image format" }, { status: 400 });
    }

    const base64Data = dataUrlParts[1];
    const mimeType = dataUrlParts[0].split(':')[1].split(';')[0];

    // Convert common image types to what Claude expects
    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
    type MediaType = typeof validTypes[number];
    const mediaType: MediaType = validTypes.includes(mimeType as MediaType) ? (mimeType as MediaType) : "image/jpeg";

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 400,
      system: "You are a John Lewis copywriter writing second-hand listings. Be brief and buyer-focused. Only mention attributes that genuinely drive purchase decisions for that category — for sofas: fabric and seat count; for storage: finish and drawer count; for TVs and electronics: brand and finish only; for lighting: shade material and base finish; for beds: frame material and style. Never mention structural details with no buyer value (bezel type, stand leg shape, cable management, hinge style). Never mention anything that could put a buyer off — no visible wear, cable marks, minor scuffs, or any flaws unless they are significant damage. Never mention dimensions, sizes, or measurements. Never reference the seller. Never suggest uses or rooms.",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: base64Data,
              },
            },
            {
              type: "text",
              text: `Analyze this furniture photo and create an optimized second-hand marketplace listing.

Return JSON only — no other text:
{
  "name": "3-5 word name using style, material, and type (e.g. 'Mid-Century Oak Sideboard', 'Industrial Metal Bookshelf')",
  "description": "2 sentences maximum. Sentence 1: brand plus the 1-2 attributes that actually matter for this product type — punchy, no filler. Sentence 2: simple confident condition statement, e.g. 'Great condition.' or 'Good condition — no scratches.' Never mention minor wear, cable marks, scuffs, or anything that could put a buyer off. No dimensions, no seller references, no room suggestions, no structural details with no buyer value."
}`,
            },
          ],
        },
      ],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";

    try {
      const parsed = JSON.parse(text);
      return Response.json(parsed);
    } catch {
      // Fallback parsing if JSON is malformed
      const nameMatch = text.match(/"name":\s*"([^"]+)"/);
      const descMatch = text.match(/"description":\s*"([^"]+)"/);

      return Response.json({
        name: nameMatch ? nameMatch[1] : "Furniture Item",
        description: descMatch ? descMatch[1] : "A piece of furniture for sale",
      });
    }
  } catch (error) {
    console.error("Error calling Claude Vision API:", error);

    // Fallback to random suggestions if API fails
    const suggestions = [
      { name: "Modern Desk Chair", description: "Black mesh ergonomic chair with adjustable armrests. Good condition with minor wear to seat foam." },
      { name: "Wooden Bookshelf", description: "Solid pine bookshelf with five fixed shelves and a natural lacquer finish. Structurally sound with light surface scratches." },
      { name: "Student Desk", description: "White laminate desk with a single drawer and metal legs. Good condition, some pen marks on surface." },
      { name: "Bedside Nightstand", description: "Oak veneer two-drawer nightstand with brushed metal handles. Very good condition, no visible damage." },
      { name: "Floor Lamp", description: "Brushed steel arc floor lamp with a white fabric shade. Working order, minor scuff on base." },
      { name: "Dining Chair", description: "Upholstered dining chair in grey fabric with solid wood legs. Good condition, fabric shows light use." },
      { name: "Storage Ottoman", description: "Dark brown faux-leather ottoman with lift-top storage and tapered legs. Good condition with light surface wear." },
      { name: "TV Media Stand", description: "Walnut-finish TV unit with two doors and open centre shelf. Good condition with minor marks on top surface." },
      { name: "Wardrobe", description: "White gloss wardrobe with two sliding doors and interior hanging rail. Very good condition, smooth-running doors." },
      { name: "Coffee Table", description: "Glass-top coffee table with a chrome frame and lower shelf. Good condition, minor scratches on glass." }
    ];

    const randomSuggestion = suggestions[Math.floor(Math.random() * suggestions.length)];
    return Response.json(randomSuggestion);
  }
}