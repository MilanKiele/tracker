import { AppShell } from "@/components/app-shell";
import { SetupRequired } from "@/components/setup-required";
import { requireReadyContext } from "@/lib/data";

export default async function TrackerLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const context = await requireReadyContext();
  if (context.status === "setup") return <SetupRequired />;

  return (
    <AppShell profile={context.profile} email={context.user?.email}>
      {children}
    </AppShell>
  );
}
