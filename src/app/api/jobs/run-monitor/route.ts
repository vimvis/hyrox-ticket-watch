import { NextResponse } from "next/server";

import { runMonitorJob } from "@/lib/services/monitoring";

export async function POST() {
  const result = await runMonitorJob();

  return NextResponse.json(result);
}
