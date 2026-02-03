export const runtime = "nodejs"

import { NextResponse } from "next/server"
import { getDb } from "@/lib/mongo"

type Body = {
  itemID: string
  guessKg: number
}

const MIN_KG = 0.5
const MAX_KG = 1000
const BUCKET_KG = 50
const KEEP_N = 100

type Bucket = { startKg: number; endKg: number; count: number }

type StatSummary = {
  n: number
  meanKg: number
  sdKg: number
  zScore: number | null
  zAbs: number | null
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function round2(n: number) {
  return Math.round(n * 100) / 100
}

function buildHistogram(guesses: number[]): Bucket[] {
  const buckets: Bucket[] = []
  for (let start = 0; start < MAX_KG; start += BUCKET_KG) {
    buckets.push({ startKg: start, endKg: start + BUCKET_KG, count: 0 })
  }

  for (const g0 of guesses) {
    const g = clamp(g0, MIN_KG, MAX_KG)
    const idx = Math.min(buckets.length - 1, Math.max(0, Math.floor(g / BUCKET_KG)))
    buckets[idx].count += 1
  }

  return buckets
}

function stats(guesses: number[], userGuessKg: number): StatSummary {
  const xs = guesses.filter((x) => Number.isFinite(x))
  const n = xs.length
  if (n === 0) return { n: 0, meanKg: 0, sdKg: 0, zScore: null, zAbs: null }

  const meanKg = xs.reduce((a, b) => a + b, 0) / n
  const varPop = xs.reduce((acc, x) => acc + (x - meanKg) * (x - meanKg), 0) / n
  const sdKg = Math.sqrt(varPop)

  if (sdKg <= 0) {
    return { n, meanKg: round2(meanKg), sdKg: 0, zScore: null, zAbs: null }
  }

  const zScore = (userGuessKg - meanKg) / sdKg
  return {
    n,
    meanKg: round2(meanKg),
    sdKg: round2(sdKg),
    zScore: round2(zScore),
    zAbs: round2(Math.abs(zScore))
  }
}

/**
 * Trims collection for an itemID to newest KEEP_N documents.
 * Efficient FIFO: find cutoff doc (KEEP_N-th newest) then delete older than it.
 */
async function trimToLastN(col: any, itemID: string, n: number) {
  const cutoff = await col
    .find({ itemID }, { projection: { createdAt: 1 } })
    .sort({ createdAt: -1 })
    .skip(n)
    .limit(1)
    .toArray()

  if (!cutoff?.length) return

  const cutoffDate = cutoff[0].createdAt as Date
  await col.deleteMany({ itemID, createdAt: { $lt: cutoffDate } })
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<Body>
    const itemID = String(body.itemID || "").trim()
    const guessKgRaw = Number(body.guessKg)

    if (!itemID || !Number.isFinite(guessKgRaw)) {
      return NextResponse.json({ ok: false, error: "Invalid submission." }, { status: 400 })
    }

    const guessKg = round2(clamp(guessKgRaw, MIN_KG, MAX_KG))

    const db = await getDb()
    const collectionName = process.env.MONGODB_COLLECTION || "submissions"
    const col = db.collection(collectionName)

    // ✅ DO NOT create indexes per request (slow + can lock).
    // Create these once manually in MongoDB/Atlas:
    // db.submissions.createIndex({ itemID: 1, createdAt: -1 })

    // Insert the new guess
    await col.insertOne({
      itemID,
      guessKg,
      createdAt: new Date()
    })

    // FIFO cap: keep newest 100 guesses for this itemID
    await trimToLastN(col, itemID, KEEP_N)

    // Read back newest 100
    const recent = await col
      .find({ itemID }, { projection: { _id: 0, guessKg: 1, createdAt: 1 } })
      .sort({ createdAt: -1 })
      .limit(KEEP_N)
      .toArray()

    const guesses = recent.map((r: any) => Number(r.guessKg)).filter(Number.isFinite)
    const histogram = buildHistogram(guesses)
    const summary = stats(guesses, guessKg)

    return NextResponse.json({
      ok: true,
      recent,
      histogram: { bucketKg: BUCKET_KG, buckets: histogram },
      stats: summary
    })
  } catch (err: any) {
    console.error("SUBMIT ERROR:", err)
    return NextResponse.json(
      {
        ok: false,
        error: err?.message || "Unknown server error"
      },
      { status: 500 }
    )
  }
}
