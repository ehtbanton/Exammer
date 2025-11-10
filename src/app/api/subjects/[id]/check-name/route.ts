import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { openDb } from "@/lib/db";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const { name } = await request.json();

    if (!name || typeof name !== "string" || name.trim() === "") {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const db = await openDb();

    // Check if any subject has this name (case-insensitive), excluding the current subject
    const existingSubject = await db.get(
      "SELECT id, name FROM subjects WHERE LOWER(name) = LOWER(?) AND id != ?",
      [name.trim(), id]
    );

    if (existingSubject) {
      return NextResponse.json(
        {
          available: false,
          message: `Subject name "${existingSubject.name}" is already in use`,
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        available: true,
        message: "Subject name is available",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error checking subject name:", error);
    return NextResponse.json(
      { error: "Failed to check subject name" },
      { status: 500 }
    );
  }
}
