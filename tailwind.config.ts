import type { Config } from "tailwindcss"

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      boxShadow: {
        soft: "0 20px 60px rgba(0,0,0,0.20)"
      }
    }
  },
  plugins: []
} satisfies Config
