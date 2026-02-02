"use client"

import * as React from "react"
import HeaderBar from "@/components/HeaderBar"
import Footer from "@/components/Footer"
import GameCard from "@/components/GameCard"
import Modal from "@/components/ui/Modal"
import NeonGrid from "@/components/reactbits/NeonGrid"

type Item = {
  itemID: string
  title: string
  imageUrl: string
  actualWeightKG: number
  referenceLink: string
}

export default function HeaderShell({ items }: { items: Item[] }) {
  const [openStats, setOpenStats] = React.useState(false)
  const [openHow, setOpenHow] = React.useState(false)

  return (
    <main className="relative min-h-screen overflow-hidden">
      <NeonGrid />

      <div className="relative z-10 flex min-h-screen flex-col">
        <div className="mx-auto w-full max-w-5xl px-4 pt-4">
          <HeaderBar onOpenStats={() => setOpenStats(true)} onOpenHow={() => setOpenHow(true)} />
        </div>

        <div className="flex-1">
          <GameCard items={items} />
        </div>

        <Footer />
      </div>

      <Modal open={openHow} title="How to play" onClose={() => setOpenHow(false)}>
        <ol className="list-decimal space-y-1 pl-5">
          <li>Drag the slider to set your guess.</li>
          <li>
            The scale shows <b>kg</b> above and <b>lb</b> below.
          </li>
          <li>
            Tap <b>SUBMIT</b> to lock in your guess.
          </li>
          <li>
            We reveal the <b>Actual Weight</b> plus a spread of other players’ guesses.
          </li>
          <li>Tap <b>NEXT</b> to move on. Items won’t repeat until you restart.</li>
        </ol>
        <p className="mt-3" style={{ color: "var(--muted)" }}>
          Tip: on mobile, scroll if needed — on desktop, everything stays in one view.
        </p>
      </Modal>

      <StatsModal open={openStats} onClose={() => setOpenStats(false)} />
    </main>
  )
}

function StatsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [loading, setLoading] = React.useState(false)
  const [stats, setStats] = React.useState<any>(null)

  React.useEffect(() => {
    if (!open) return
    let alive = true
    setLoading(true)
    fetch("/api/stats")
      .then((r) => r.json())
      .then((d) => {
        if (alive) setStats(d)
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [open])

  return (
    <Modal open={open} title="Overall stats" onClose={onClose}>
      {loading ? (
        <div>Loading…</div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <StatCard label="Total submissions" value={stats?.overall?.count ?? 0} />
            <StatCard label="Avg guess (kg)" value={Number(stats?.overall?.avgGuessKg ?? 0).toFixed(2)} />
          </div>

          <div className="mt-4">
            <div className="text-lg tracking-wide">Top items</div>
            <div className="mt-2 max-h-64 overflow-auto rounded-2xl border border-white/15 bg-white/5 p-2">
              <div className="grid gap-2">
                {(stats?.perItem || []).map((x: any) => (
                  <div
                    key={x._id}
                    className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                  >
                    <div className="truncate pr-3">
                      <div className="text-sm">{x._id}</div>
                      <div className="text-[11px]" style={{ color: "var(--muted)" }}>
                        avg: {Number(x.avgGuessKg).toFixed(2)} kg
                      </div>
                    </div>
                    <div className="text-sm">{x.count}</div>
                  </div>
                ))}
                {(!stats?.perItem || stats.perItem.length === 0) && (
                  <div style={{ color: "var(--muted)" }}>No submissions yet.</div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </Modal>
  )
}

function StatCard({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-2xl border border-white/15 bg-white/5 p-3">
      <div className="text-xs" style={{ color: "var(--muted)" }}>
        {label}
      </div>
      <div className="mt-1 text-2xl leading-none">{value}</div>
    </div>
  )
}
