# Guess the Weight

A vibrant, mobile‑first Next.js app for guessing the weight of items — with results stored in MongoDB and visualized after submission.

## Tech
- Next.js (App Router)
- TypeScript
- Tailwind CSS
- MongoDB (Node driver)
- Framer Motion animations
- MDX content (frontmatter)

## Requirements
- Node.js 20+ (recommended)
- A MongoDB database (Atlas works great)

## Setup

1) Install deps
```bash
npm install
```

2) Create `.env.local`
```bash
MONGODB_URI="mongodb+srv://<user>:<pass>@<cluster>/<db>?retryWrites=true&w=majority"
MONGODB_DB="guess_the_weight"
```

3) Run
```bash
npm run dev
```

## Content
Add items in `content/items/*.mdx` with frontmatter:

- `itemID`
- `title`
- `imageUrl` (path under `/public`, e.g. `/items/kettlebell.png`)
- `actualWeightKG` (number)
- `referenceLink` (URL)

## Notes
- Submissions are stored per `itemID` and capped at the most recent 100 entries (FIFO).
- Theme is **dark by default** and persisted in `sessionStorage`.

