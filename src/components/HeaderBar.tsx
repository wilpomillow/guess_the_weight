"use client"

import * as React from "react"
import Link from "next/link"
import { useTheme } from "@/lib/theme"
import {
  BarChart3,
  HelpCircle,
  Coffee,
  Sun,
  Moon
} from "lucide-react"

export default function HeaderBar({
  onOpenStats,
  onOpenHow
}: {
  onOpenStats: () => void
  onOpenHow: () => void
}) {
  const { theme, toggle } = useTheme()

  // Prevent logo flicker during hydration
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])

  const isDark = mounted ? theme === "dark" : true
  const logoSrc = isDark ? "/images/logo_dark.png" : "/images/logo.png"

  const iconSize = 20

  return (
    <header className="w-full">
      <div className="glass mx-auto flex w-full max-w-5xl items-center justify-between gap-3 rounded-3xl px-3 py-3 shadow-soft">
        {/* Logo */}
        <Link href="/" className="flex items-center" aria-label="Go home">
          <img
            key={logoSrc}
            src={logoSrc}
            alt="Guess the Weight"
            className="h-14 w-auto select-none"
            draggable={false}
          />
        </Link>

        {/* Actions */}
        <nav className="flex items-center gap-2">
          <button
            onClick={onOpenStats}
            aria-label="Overall stats"
            title="Overall stats"
            className="btnIcon flex h-10 w-10 items-center justify-center"
          >
            <BarChart3 size={iconSize} />
          </button>

          <button
            onClick={onOpenHow}
            aria-label="How to play"
            title="How to play"
            className="btnIcon flex h-10 w-10 items-center justify-center"
          >
            <HelpCircle size={iconSize} />
          </button>

          <a
            href="https://buymeacoffee.com/wilpomillow"
            target="_blank"
            rel="noreferrer"
            aria-label="Buy Me a Coffee"
            title="Buy Me a Coffee"
            className="btnIcon hidden h-10 w-10 items-center justify-center sm:flex"
          >
            <Coffee size={iconSize} />
          </a>

          <button
            onClick={toggle}
            aria-label="Toggle theme"
            title="Toggle theme"
            className="btnIcon flex h-10 w-10 items-center justify-center"
          >
            {isDark ? <Sun size={iconSize} /> : <Moon size={iconSize} />}
          </button>
        </nav>
      </div>
    </header>
  )
}
