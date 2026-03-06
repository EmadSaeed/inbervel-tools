// POST /api/webhooks/cognito
//
// Receives form submission events from Cognito Forms. Cognito is configured to
// POST to this URL (with ?token=<secret>) whenever a client submits or updates
// a form. The handler parses the payload and upserts it into the database.

import { NextRequest, NextResponse } from "next/server";
import { cognitoSubmissionHandler } from "@/lib/cognitoSubmissionHandler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  console.log("WEBHOOK ROUTE HIT (local):", new Date().toISOString());

  try {
    // Authenticate the request using a shared secret token passed as a query
    // parameter. This prevents arbitrary HTTP callers from injecting fake submissions.
    const token = req.nextUrl.searchParams.get("token");
    if (!token || token !== process.env.COGNITO_WEBHOOK_TOKEN) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await req.json();

    // Delegate all business logic (extraction, logo upload, DB upsert) to the handler.
    await cognitoSubmissionHandler(payload);

    return NextResponse.json(
      { message: "Webhook received successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error processing webhook:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
