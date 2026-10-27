export const instant = false;
import { AuthForm } from "@/components/auth-form";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const p = await searchParams;
  return <AuthForm mode="reset" error={p.error} message={p.message} />;
}
