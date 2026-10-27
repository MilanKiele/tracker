import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const requestSchema = z.object({ question: z.string().trim().min(1).max(1500), topic: z.enum(["training", "nutrition"]) });

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Please sign in again." }, { status: 401 });
  const allowedEmails = (process.env.AI_ALLOWED_EMAILS ?? "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean);
  if (!process.env.OPENAI_API_KEY || !allowedEmails.length) return Response.json({ error: "AI is not configured yet. Set OPENAI_API_KEY and AI_ALLOWED_EMAILS on the server." }, { status: 503 });
  if (!user.email || !allowedEmails.includes(user.email.toLowerCase())) return Response.json({ error: "AI access is not enabled for this account." }, { status: 403 });
  let body;
  try { body = requestSchema.safeParse(await request.json()); } catch { return Response.json({ error: "Invalid request." }, { status: 400 }); }
  if (!body.success) return Response.json({ error: "Enter a question of up to 1,500 characters." }, { status: 400 });
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: process.env.OPENAI_MODEL || "gpt-4.1-mini", store: false, max_output_tokens: 500, instructions: "You are a helpful wellness assistant. Answer in the user's language, keep it practical and concise. Do not claim to know their personal data. Avoid medical diagnoses or extreme diet or exercise advice. Mention uncertainty when estimating nutrition. Never say you have saved or changed anything.", input: `Topic: ${body.data.topic}\nQuestion: ${body.data.question}` }),
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) return Response.json({ error: "The AI service could not answer. Check the server configuration and try again." }, { status: 502 });
    const result = await response.json();
    const answer = result.output?.flatMap((item: { content?: { type: string; text?: string }[] }) => item.content ?? []).filter((part: { type: string }) => part.type === "output_text").map((part: { text?: string }) => part.text ?? "").join("\n");
    if (!answer) return Response.json({ error: "No answer was returned. Please try again." }, { status: 502 });
    return Response.json({ answer });
  } catch { return Response.json({ error: "The AI service is unavailable. Please try again." }, { status: 502 }); }
}
