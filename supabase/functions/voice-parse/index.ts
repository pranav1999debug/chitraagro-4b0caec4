import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { transcript, customers, timeGroup, dateKey } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const customerList = customers.map((c: any) => `- "${c.name}" (id: ${c.id}, rate: ₹${c.purchase_rate}, morning_default: ${c.default_qty_morning}L, evening_default: ${c.default_qty_evening}L)`).join("\n");

    const systemPrompt = `You are a dairy farm assistant. Parse voice commands about milk delivery into structured data.

Available customers:
${customerList}

Current context: ${timeGroup} shift, date: ${dateKey}

Rules:
1. Match customer names fuzzy - "Renu ji" could be "Renu Marwari", "Renu ji" etc. Pick the closest match.
2. If user says "sabka dudh gaya" it means ALL customers got their default quantity EXCEPT the ones explicitly excluded.
3. If user says "X ka dudh nahin gaya" it means X got 0 quantity.
4. Extract quantity in liters. If no quantity mentioned for a customer but they're included, use their default quantity for the current time group.
5. The user may speak in Hindi or English or mix.
6. Return ONLY the customers mentioned or affected. If "sabka" (everyone) is mentioned, return all customers with their quantities.`;

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
              name: "apply_milk_entries",
              description: "Apply parsed milk delivery entries to the operations page",
              parameters: {
                type: "object",
                properties: {
                  entries: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        customer_id: { type: "string", description: "Customer ID from the list" },
                        customer_name: { type: "string", description: "Customer name for display" },
                        quantity: { type: "number", description: "Quantity in liters" },
                        price: { type: "number", description: "Price per liter (use customer's purchase_rate)" },
                      },
                      required: ["customer_id", "customer_name", "quantity", "price"],
                    },
                  },
                  summary: { type: "string", description: "Brief summary of what was parsed in the same language as input" },
                },
                required: ["entries", "summary"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "apply_milk_entries" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Credits exhausted, please add funds." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI processing failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(JSON.stringify({ error: "Could not parse voice command" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = JSON.parse(toolCall.function.arguments);
    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("voice-parse error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
