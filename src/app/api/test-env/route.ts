import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    hasGoogleKey: !!process.env.GOOGLE_SAFE_BROWSING_API_KEY,
    keyPrefix: process.env.GOOGLE_SAFE_BROWSING_API_KEY?.slice(0, 8) + "...",
  });
}