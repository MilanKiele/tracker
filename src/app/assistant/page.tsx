import { AppShell } from "@/components/app-shell";
import { SetupRequired } from "@/components/setup-required";
import { AssistantWorkspace } from "@/components/v2/ai-flow";
import { requireReadyContext } from "@/lib/data";

export default async function AssistantPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; date?: string }>;
}) {
  const [context, params] = await Promise.all([
    requireReadyContext(),
    searchParams,
  ]);
  if (context.status === "setup") return <SetupRequired />;
  const mode = params.mode === "plan" ? "plan" : "food";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(params.date ?? "")
    ? params.date!
    : new Date().toISOString().slice(0, 10);
  return (
    <AppShell profile={context.profile} email={context.user?.email}>
      <AssistantWorkspace initialMode={mode} initialDate={date} />
    </AppShell>
  );
}
