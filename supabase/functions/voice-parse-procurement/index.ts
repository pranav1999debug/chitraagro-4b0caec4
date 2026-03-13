import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { transcript, suppliers, todayDateKey } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supplierList = suppliers.map((s: any) => `- "${s.name}" (id: ${s.id}, default_qty: ${s.default_qty}L, default_rate: ₹${s.default_rate})`).join("\n");

    const systemPrompt = `You are a dairy farm procurement assistant. Parse voice commands about milk procurement into structured data.

Available suppliers:
${supplierList}

Current date (Nepali BS): ${todayDateKey}

Rules:
1. Match supplier names fuzzy - "yadav ji" could match "Yadav", "Yadav Ji" etc.
2. Extract quantity in liters. If no quantity mentioned, use supplier's default_qty.
3. Extract rate/price per liter. If no rate mentioned, use supplier's default_rate.
4. Calculate total = quantity × rate.
5. If user says "kaal" or "yesterday", subtract 1 day. "parso" = 2 days back.
6. If user mentions a specific Nepali date, convert to YYYY-MM-DD format.
7. If no date mentioned, use today: ${todayDateKey}
8. The user may speak in Hindi or English or mix.
9. Parse Hindi numbers naturally.
10. If supplier not found in list, create entry with the name as spoken.`;

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
              name: "apply_procurement_entries",
              description: "Apply parsed milk procurement entries",
              parameters: {
                type: "object",
                properties: {
                  entries: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        supplier_id: { type: "string", description: "Supplier ID if matched, empty string if new" },
                        supplier_name: { type: "string", description: "Supplier name" },
                        quantity: { type: "number", description: "Quantity in liters" },
                        rate: { type: "number", description: "Rate per liter" },
                        total: { type: "number", description: "Total amount" },
                        date_key: { type: "string", description: "Date in YYYY-MM-DD format (Nepali BS)" },
                      },
                      required: ["supplier_name", "quantity", "rate", "total", "date_key"],
                    },
                  },
                  summary: { type: "string", description: "Brief summary in same language as input" },
                },
                required: ["entries", "summary"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "apply_procurement_entries" } },
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
    console.error("voice-parse-procurement error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
