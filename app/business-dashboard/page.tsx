import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";
import BusinessDashboardClient from "./BusinessDashboardClient";

export default async function BusinessDashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/business-dashboard/login");

  const actions = await prisma.ninetyDayAction.findMany({
    where: { userEmail: session.user.email },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      category: true,
      description: true,
      targetDate: true,
      status: true,
    },
  });

  return <BusinessDashboardClient ninetyDayActions={actions} userEmail={session.user.email} />;
}
