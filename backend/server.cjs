const http = require("node:http");
const crypto = require("node:crypto");
const { Transform } = require("node:stream");
const { pipeline } = require("node:stream/promises");
const { GridFSBucket, MongoClient, ObjectId } = require("mongodb");

const PORT = Number(process.env.PORT || 3000);
const MAX_BACKUP_BYTES = 256 * 1024 * 1024;
const uri = process.env.MONGODB_URI;
console.log("Connecting to MongoDB...",uri);
const accessToken = process.env.BACKUP_API_TOKEN;
const databaseName = process.env.MONGODB_DATABASE || "flower_billing";

if (!uri) throw new Error("MONGODB_URI must be configured in the backend environment.");
if (!accessToken || accessToken.length < 32) {
  throw new Error("BACKUP_API_TOKEN must be at least 32 characters and configured in the backend environment.");
}

const mongo = new MongoClient(uri);
let database;
let bucket;

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(JSON.stringify(body));
}

function authorized(request) {
  const supplied = Buffer.from(request.headers.authorization || "");
  const expected = Buffer.from(`Bearer ${accessToken}`);
  return supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected);
}

async function getLatestBackup() {
  return database.collection("backup_metadata").findOne({ _id: "latest" });
}

async function handleRequest(request, response) {
  const pathname = new URL(request.url, "http://localhost").pathname;

  if (request.method === "GET" && pathname === "/health") {
    await database.command({ ping: 1 });
    return sendJson(response, 200, { status: "ok" });
  }
  if (!["GET", "PUT"].includes(request.method) ||
      !["/v1/status", "/v1/backup"].includes(pathname)) {
    return sendJson(response, 404, { error: "Not found." });
  }
  if (!authorized(request)) return sendJson(response, 401, { error: "Unauthorized." });

  if (request.method === "GET" && pathname === "/v1/status") {
    const latest = await getLatestBackup();
    return sendJson(response, 200, {
      status: "connected",
      hasBackup: Boolean(latest),
      ...(latest ? { createdAt: latest.createdAt, size: latest.size } : {}),
    });
  }

  if (request.method === "PUT" && pathname === "/v1/backup") {
    const declaredLength = Number(request.headers["content-length"]);
    if (Number.isFinite(declaredLength) && declaredLength > MAX_BACKUP_BYTES) {
      request.resume();
      return sendJson(response, 413, { error: "Backup exceeds the 256 MB limit." });
    }

    const old = await getLatestBackup();
    const upload = bucket.openUploadStream("latest-encrypted-backup", {
      contentType: "application/octet-stream",
      metadata: { createdAt: new Date() },
    });
    let received = 0;
    const limit = new Transform({
      transform(chunk, _encoding, callback) {
        received += chunk.length;
        if (received > MAX_BACKUP_BYTES) {
          callback(new Error("Backup exceeds the 256 MB limit."));
          return;
        }
        callback(null, chunk);
      },
    });

    try {
      await pipeline(request, limit, upload);
      const createdAt = new Date();
      await database.collection("backup_metadata").updateOne(
        { _id: "latest" },
        { $set: { fileId: upload.id, createdAt, size: received } },
        { upsert: true },
      );
      if (old?.fileId) {
        try {
          await bucket.delete(old.fileId);
        } catch (error) {
          console.error("Unable to remove the previous encrypted backup:", error);
        }
      }
      return sendJson(response, 200, { saved: true, createdAt, size: received });
    } catch (error) {
      if (upload.id) {
        try {
          await bucket.delete(upload.id);
        } catch (cleanupError) {
          console.error("Unable to remove an incomplete backup upload:", cleanupError);
        }
      }
      if (error.message.includes("256 MB")) {
        return sendJson(response, 413, { error: error.message });
      }
      throw error;
    }
  }

  if (request.method === "GET" && pathname === "/v1/backup") {
    const latest = await getLatestBackup();
    if (!latest?.fileId) return sendJson(response, 404, { error: "No cloud backup is available yet." });
    if (!ObjectId.isValid(latest.fileId)) return sendJson(response, 500, { error: "Backup metadata is invalid." });

    response.writeHead(200, {
      "Content-Type": "application/octet-stream",
      "Content-Length": String(latest.size),
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    await pipeline(bucket.openDownloadStream(new ObjectId(latest.fileId)), response);
  }
}

async function start() {
  await mongo.connect();
  database = mongo.db(databaseName);
  bucket = new GridFSBucket(database, { bucketName: "encrypted_backups" });
console.log("Connecting to MongoDB...",uri);
  const server = http.createServer((request, response) => {
    handleRequest(request, response).catch((error) => {
      console.error("Backup API request failed:", error);
      if (!response.headersSent) sendJson(response, 500, { error: "Backup service request failed." });
      else response.destroy(error);
    });
  });

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Flower Billing backup API listening on port ${PORT}`);
  });

  const shutdown = async () => {
    server.close();
    await mongo.close();
  };
  process.on("SIGTERM", () => shutdown().catch((error) => {
    console.error("Backup API shutdown failed:", error);
    process.exitCode = 1;
  }));
  process.on("SIGINT", () => shutdown().catch((error) => {
    console.error("Backup API shutdown failed:", error);
    process.exitCode = 1;
  }));
}

if (require.main === module) {
  start().catch((error) => {
    console.error("Unable to start the backup API:", error);
    process.exitCode = 1;
  });
}
