import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json()

    const validUsername = process.env.ADMIN_USERNAME
    const validPassword = process.env.ADMIN_PASSWORD

    if (!validUsername || !validPassword) {
      return NextResponse.json(
        { error: "Server belum dikonfigurasi. Set ADMIN_USERNAME & ADMIN_PASSWORD." },
        { status: 500 }
      )
    }

    if (username !== validUsername || password !== validPassword) {
      return NextResponse.json(
        { error: "Username atau password salah." },
        { status: 401 }
      )
    }

    // Create a simple session token (hash of credentials + timestamp)
    const sessionToken = Buffer.from(
      `${validUsername}:${Date.now()}:${validPassword}`
    ).toString("base64")

    const cookieStore = await cookies()
    cookieStore.set("session", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json(
      { error: "Terjadi kesalahan server." },
      { status: 500 }
    )
  }
}
