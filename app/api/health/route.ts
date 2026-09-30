import { NextResponse } from "next/server";
import { ejecutar } from "@/lib/db";

export const dynamic = "force-dynamic";
export async function GET() {
  try {
    await ejecutar("SELECT 1");
    return NextResponse.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ status: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
