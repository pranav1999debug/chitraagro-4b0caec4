import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { transcript, categories, todayDateKey } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `You are a dairy farm expense assistant. Parse voice commands about expenses into structured data.

Available expense categories: ${categories.join(', ')}

Current date (Nepali BS): ${todayDateKey}

Rules:
1. Extract: category, sub_category (item name like "bran", "medicine" etc), amount (₹), notes (seller name etc)
2. Map items to categories: bran/chaff/feed/dana/khal/choker → Food, dawai/medicine → Medicine, diesel/petrol → Fuel, repair/maintenance → Maintenance, else → Other
3. If user mentions a seller name like "dipu se" or "ram se", put it in notes
4. If user says "kaal" or "yesterday", subtract 1 day from today's date. If they say "parso" subtract 2 days.
5. If user mentions a specific Nepali date like "2082 falgun 23", convert to date_key format YYYY-MM-DD
6. If no date mentioned, use today: ${todayDateKey}
7. Parse Hindi numbers: do/2 = 2, teen/3 = 3, ek/1 = 1, panch/5 = 5 etc.
8. "quintal" = 100kg, can be used as quantity context in notes
9. The user may speak in Hindi or English or mix.
10. Return multiple entries if user mentions multiple expenses.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: transcript },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "apply_expense_entries",
              description: "Apply parsed expense entries",
              parameters: {
                type: "object",
                properties: {
                  entries: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        category: { type: "string", description: "Expense category from available list" },
                        sub_category: { type: "string", description: "Sub category / item name" },
                        amount: { type: "number", description: "Amount in rupees" },
                        notes: { type: "string", description: "Additional notes like seller name, quantity details" },
                        date_key: { type: "string", description: "Date in YYYY-MM-DD format (Nepali BS)" },
                      },
                      required: ["category", "amount", "date_key"],
                    },
                  },
                  summary: { type: "string", description: "Brief summary in same language as input" },
                },
                required: ["entries", "summary"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "apply_expense_entries" } },
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) return new Response(JSON.stringify({ error: "Rate limited, please try again later." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (status === 402) return new Response(JSON.stringify({ error: "Credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const t = await response.text();
      console.error("AI gateway error:", status, t);
      return new Response(JSON.stringify({ error: "AI processing failed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(JSON.stringify({ error: "Could not parse voice command" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const parsed = JSON.parse(toolCall.function.arguments);
    return new Response(JSON.stringify(parsed), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("voice-parse-expense error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
