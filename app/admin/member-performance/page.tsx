import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import MemberPerformanceClient from "./MemberPerformanceClient";

export const dynamic = "force-dynamic";

export default async function MemberPerformancePage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/admin/login");
  }

  const { email } = await searchParams;
  const normalised = email?.toLowerCase().trim() ?? "";

  return <MemberPerformanceClient email={normalised} adminEmail={session.user.email ?? ""} />;
}
