import { MongoClient } from "mongodb"

const uri = process.env.MONGODB_URI
if (!uri) {
  throw new Error("Missing MONGODB_URI in environment (.env.local).")
}

const dbName = process.env.MONGODB_DB || "guess_the_weight"

declare global {
  // eslint-disable-next-line no-var
  var __mongoClient: MongoClient | undefined
}

export async function getDb() {
  if (!global.__mongoClient) {
    global.__mongoClient = new MongoClient(uri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10_000
    })
  }
  const client = global.__mongoClient
  if (!client.topology?.isConnected()) {
    await client.connect()
  }
  return client.db(dbName)
}
