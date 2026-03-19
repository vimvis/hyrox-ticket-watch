import { NextResponse } from "next/server";

import { getEvents } from "@/lib/data-store";

export async function GET() {
  const result = await getEvents();

  return NextResponse.json(result);
}
