import { AssistantWorkspace } from "@/components/v2/ai-flow";

export default async function AssistantPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; date?: string; prompt?: string }>;
}) {
  const params = await searchParams;
  const mode = params.mode === "plan" ? "plan" : "food";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(params.date ?? "")
    ? params.date!
    : "";
  return <AssistantWorkspace initialMode={mode} initialDate={date} initialPrompt={params.prompt?.slice(0, 500)} />;
}
