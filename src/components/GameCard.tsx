"use client"

import * as React from "react"
import Image from "next/image"
import { motion, AnimatePresence } from "framer-motion"
import BlurText from "@/components/reactbits/BlurText"
import WeightScale from "@/components/WeightScale"
import { kgToLb, round1 } from "@/lib/units"
import { IconNext } from "@/components/icons"
import { fireSideConfetti } from "@/lib/confetti"

type Item = {
  itemID: string
  title: string
  imageUrl: string
  actualWeightKG: number
  referenceLink: string
}

type Recent = { guessKg: number; createdAt: string }

type SubmitStats = {
  n: number
  meanKg: number
  sdKg: number
  zScore: number | null
  zAbs: number | null
}

type SubmitResponse = {
  ok: boolean
  recent: Recent[]
  stats?: SubmitStats
  error?: string
}

const ORDER_KEY = "gtw-session-order-v4"
const INDEX_KEY = "gtw-session-index-v4"
const DECK_HASH_KEY = "gtw-session-deckhash-v4"

function stableDeckHash(items: Item[]) {
  return items
    .map((x) => x.itemID)
    .slice()
    .sort()
    .join("|")
}

function shuffleDifferent(items: Item[]): Item[] {
  if (items.length <= 1) return [...items]
  const original = items.map((x) => x.itemID).join("|")
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  if (a.map((x) => x.itemID).join("|") === original) return [...a.slice(1), a[0]]
  return a
}

function clampInt(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function seedGuessKg(actualKg: number) {
  const seed = actualKg ? actualKg * 0.6 : 5
  return Math.min(80, Math.max(1, seed))
}

function closenessRatio(guessKg: number, actualKg: number) {
  const g = Number(guessKg)
  const a = Number(actualKg)
  if (!Number.isFinite(g) || !Number.isFinite(a) || g <= 0 || a <= 0) return null
  return Math.min(g, a) / Math.max(g, a)
}

export default function GameCard({ items }: { items: Item[] }) {
  const [order, setOrder] = React.useState<Item[] | null>(null)
  const [idx, setIdx] = React.useState(0)

  const [guessKg, setGuessKg] = React.useState(5)
  const guessKgRef = React.useRef(guessKg)
  React.useEffect(() => {
    guessKgRef.current = guessKg
  }, [guessKg])

  const [revealed, setRevealed] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)

  const [recent, setRecent] = React.useState<Recent[]>([])
  const [submitError, setSubmitError] = React.useState<string | null>(null)

  // Confetti: ensure it fires once per item
  const confettiFiredRef = React.useRef(false)

  // Session order (no repeats within session)
  React.useEffect(() => {
    if (!items?.length) return

    const byId = new Map(items.map((x) => [x.itemID, x]))
    const deckHash = stableDeckHash(items)

    const storedHash = sessionStorage.getItem(DECK_HASH_KEY)
    const storedOrder = sessionStorage.getItem(ORDER_KEY)
    const storedIdx = sessionStorage.getItem(INDEX_KEY)

    let nextOrder: Item[] = []

    if (storedHash === deckHash && storedOrder) {
      try {
        const ids = JSON.parse(storedOrder) as unknown
        if (Array.isArray(ids) && ids.every((x) => typeof x === "string")) {
          nextOrder = (ids as string[]).map((id) => byId.get(id)).filter(Boolean) as Item[]
        }
      } catch {
        nextOrder = []
      }
    }

    if (nextOrder.length !== items.length) {
      nextOrder = shuffleDifferent(items)
      sessionStorage.setItem(DECK_HASH_KEY, deckHash)
      sessionStorage.setItem(ORDER_KEY, JSON.stringify(nextOrder.map((x) => x.itemID)))
      sessionStorage.setItem(INDEX_KEY, "0")
      setOrder(nextOrder)
      setIdx(0)
      return
    }

    const restored = clampInt(Number(storedIdx || 0) || 0, 0, nextOrder.length - 1)
    setOrder(nextOrder)
    setIdx(restored)
  }, [items])

  const item = order?.[idx] ?? null
  const isLast = !!order && idx >= order.length - 1

  // Reset per-item state
  React.useEffect(() => {
    if (!item) return
    setGuessKg(seedGuessKg(item.actualWeightKG))
    setRevealed(false)
    setSubmitting(false)
    setRecent([])
    setSubmitError(null)
    confettiFiredRef.current = false
  }, [item?.itemID])

  // Fire confetti when revealed AND closeness >= 90% (once per item)
  React.useEffect(() => {
    if (!revealed || !item) return
    if (confettiFiredRef.current) return

    const score = closenessRatio(guessKgRef.current, item.actualWeightKG)
    if (score !== null && score >= 0.9) {
      confettiFiredRef.current = true
      void fireSideConfetti()
    }
  }, [revealed, item?.itemID])

  const crowdDots = React.useMemo(() => {
    return recent
      .map((r) => ({ kg: Number(r.guessKg) }))
      .filter((x) => Number.isFinite(x.kg))
  }, [recent])

  async function submit() {
    if (!item || submitting || revealed) return
    setSubmitting(true)
    setSubmitError(null)

    const guessToSubmitKg = guessKgRef.current

    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ itemID: item.itemID, guessKg: guessToSubmitKg })
      })

      const data = (await res.json()) as SubmitResponse
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Submission failed")

      setRecent(Array.isArray(data.recent) ? data.recent : [])
      setRevealed(true)
    } catch (e: any) {
      setSubmitError(e?.message || "Could not submit")
      setRecent([])
      setRevealed(true)
    } finally {
      setSubmitting(false)
    }
  }

  function next() {
    if (!order || isLast) return

    // clear UI BEFORE change (prevents flashes)
    setRevealed(false)
    setSubmitting(false)
    setRecent([])
    setSubmitError(null)
    confettiFiredRef.current = false

    const n = idx + 1
    setIdx(n)
    sessionStorage.setItem(INDEX_KEY, String(n))
  }

  function restartSession() {
    if (!items?.length) return
    const fresh = shuffleDifferent(items)

    sessionStorage.setItem(DECK_HASH_KEY, stableDeckHash(items))
    sessionStorage.setItem(ORDER_KEY, JSON.stringify(fresh.map((x) => x.itemID)))
    sessionStorage.setItem(INDEX_KEY, "0")

    setOrder(fresh)
    setIdx(0)

    setRevealed(false)
    setSubmitting(false)
    setRecent([])
    setSubmitError(null)
    confettiFiredRef.current = false
  }

  if (!order || !item) {
    return (
      <section className="mx-auto w-full max-w-5xl px-4 pt-4">
        <div className="glass rounded-[28px] p-6 shadow-soft">
          <div className="text-xl">Loading…</div>
        </div>
      </section>
    )
  }

  return (
    <section className="mx-auto w-full max-w-5xl px-4 pt-4 pb-6">
      <motion.div layout className="glass rounded-[28px] p-4 shadow-soft md:p-6">
        {/* Title + counter */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <BlurText text={item.title} className="font-sour-gummy text-3xl leading-none md:text-4xl" />
            <div className="mt-1 text-sm tracking-wide text-center md:text-left" style={{ color: "var(--muted)" }}>
              Item <span style={{ color: "var(--counter)" }}>{idx + 1}</span> / {order.length}
            </div>
          </div>
        </div>

        <motion.div layout className="mt-4 grid gap-4 md:grid-cols-[1.05fr_0.95fr]">
          {/* Image panel */}
          <motion.div layout className="glass rounded-3xl p-3 md:p-4">
            <div className="relative w-full overflow-hidden rounded-2xl border border-white/15 bg-white/5">
              <div className="relative mx-auto w-full max-w-[440px]">
                <div className="relative aspect-square">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={item.itemID}
                      className="absolute inset-0"
                      initial={{ opacity: 0, y: 10, scale: 0.98, filter: "blur(6px)" }}
                      animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
                      exit={{ opacity: 0, y: -8, scale: 0.985, filter: "blur(6px)" }}
                      transition={{ duration: 0.35, ease: "easeOut" }}
                    >
                      <Image
                        src={item.imageUrl}
                        alt={item.title}
                        fill
                        sizes="(max-width: 768px) 92vw, 520px"
                        className="object-contain p-4"
                        priority
                      />
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Right panel */}
          <motion.div layout className="flex flex-col gap-4">
            <WeightScale
              key={item.itemID}
              guessKg={guessKg}
              setGuessKg={setGuessKg}
              disabled={submitting || revealed}
              revealed={revealed}
              actualKg={item.actualWeightKG}
              crowdDots={crowdDots}
            />

            <AnimatePresence>
              {revealed && (
                <ActualWeightPanel
                  key={`actual-${item.itemID}`}
                  actualKg={item.actualWeightKG}
                  referenceLink={item.referenceLink}
                  guessKg={guessKgRef.current}
                  submitError={submitError}
                />
              )}
            </AnimatePresence>

            <AnimatePresence>
              {revealed && isLast && (
                <motion.div
                  layout
                  className="glass rounded-2xl p-3 text-center shadow-soft"
                  initial={{ opacity: 0, y: 8, filter: "blur(8px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: 8, filter: "blur(8px)" }}
                  transition={{ duration: 0.25 }}
                >
                  <div className="text-lg">Session complete 🎉</div>
                  <div className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
                    No repeats until you restart.
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>

        {/* Bottom action */}
        <motion.div layout className="mt-4">
          {!revealed ? (
            <button className="btnPrimary w-full" onClick={submit} disabled={submitting}>
              {submitting ? "SUBMITTING…" : "SUBMIT"}
            </button>
          ) : isLast ? (
            <button className="btnGhost w-full" onClick={restartSession}>
              RESTART (RESHUFFLE)
            </button>
          ) : (
            <button className="btnGhost w-full" onClick={next}>
              <span className="inline-flex items-center justify-center gap-2">
                NEXT <IconNext />
              </span>
            </button>
          )}
        </motion.div>
      </motion.div>
    </section>
  )
}

function ActualWeightPanel({
  actualKg,
  referenceLink,
  guessKg,
  submitError
}: {
  actualKg: number
  referenceLink: string
  guessKg: number
  submitError: string | null
}) {
  const actualLb = kgToLb(actualKg)
  const score = closenessRatio(guessKg, actualKg)

  return (
    <motion.div
      layout
      className="glass rounded-3xl p-4 shadow-soft"
      initial={{ opacity: 0, y: 10, filter: "blur(10px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      exit={{ opacity: 0, y: 10, filter: "blur(10px)" }}
      transition={{ duration: 0.28, ease: "easeOut" }}
    >
      <div className="text-center">
        <div className="text-sm tracking-wide" style={{ color: "var(--muted)" }}>
          Actual Weight
        </div>

        <div className="mt-2 flex items-baseline justify-center gap-3">
          <div className="text-2xl leading-none">
            {round1(actualKg)} <span className="text-base">kg</span>
          </div>
          <div className="text-xl leading-none opacity-70">|</div>
          <div className="text-2xl leading-none">
            {round1(actualLb)} <span className="text-base">lb</span>
          </div>
        </div>

        {score !== null && (
          <div className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
            Closeness: <b>{Math.round(score * 100)}%</b>
          </div>
        )}

        {submitError && (
          <div className="mt-2 text-xs" style={{ color: "var(--muted)" }}>
            Couldn’t log your guess right now: {submitError}
          </div>
        )}

        <a
          className="mt-3 inline-flex justify-center text-sm underline decoration-white/30 underline-offset-4 hover:decoration-white/70"
          href={referenceLink}
          target="_blank"
          rel="noreferrer"
        >
          Reference
        </a>
      </div>
    </motion.div>
  )
}
