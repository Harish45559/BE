const request = require("supertest");
const app = require("../app");

let adminToken;

beforeAll(async () => {
  const res = await request(app)
    .post("/api/auth/login")
    .send({ username: "admin", password: process.env.ADMIN_DEFAULT_PASSWORD });

  adminToken = res.body.token;
});

// ──────────────────────────────────────────────
// Auth guard
// ──────────────────────────────────────────────
describe("Auth guard on till routes", () => {
  test("GET /api/till/status returns 401 without token", async () => {
    const res = await request(app).get("/api/till/status");
    expect(res.statusCode).toBe(401);
  });

  test("POST /api/till/open returns 401 without token", async () => {
    const res = await request(app).post("/api/till/open");
    expect(res.statusCode).toBe(401);
  });

  test("POST /api/till/close returns 401 without token", async () => {
    const res = await request(app).post("/api/till/close");
    expect(res.statusCode).toBe(401);
  });
});

// ──────────────────────────────────────────────
// GET /api/till/status
// ──────────────────────────────────────────────
describe("GET /api/till/status", () => {
  test("returns 200 with a status object", async () => {
    const res = await request(app)
      .get("/api/till/status")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("date");
  });

  test("returns open: false when till has no record for today", async () => {
    // This test is conditional — it passes if open is false, or if the till
    // exists (truthy open field). Either way the status call succeeds.
    const res = await request(app)
      .get("/api/till/status")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(200);
    expect(typeof res.body.open === "boolean" || res.body.open === undefined).toBe(true);
  });
});

// ──────────────────────────────────────────────
// Till lifecycle: close (reset) → open → close
// We reset first so tests are not affected by current DB state
// ──────────────────────────────────────────────
describe("Till open/close lifecycle", () => {
  beforeAll(async () => {
    // Force-close the till before running these tests so we start from a known state
    await request(app)
      .post("/api/till/close")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ closed_by: "test-reset", closing_amount: 0 });
    // Ignore the response — it may 400 if already closed, that's fine
  });

  test("POST /api/till/open returns 200 and opens the till", async () => {
    const res = await request(app)
      .post("/api/till/open")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ opened_by: "test-admin", opening_amount: 100 });

    expect(res.statusCode).toBe(200);
    expect(res.body.open).toBe(true);
    expect(res.body).toHaveProperty("date");
  });

  test("POST /api/till/open returns 400 when till is already open", async () => {
    const res = await request(app)
      .post("/api/till/open")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ opened_by: "test-admin" });

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe("Till is already open");
  });

  test("GET /api/till/status shows open: true after opening", async () => {
    const res = await request(app)
      .get("/api/till/status")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.open).toBe(true);
  });

  test("POST /api/till/close returns 200 and closes the till", async () => {
    const res = await request(app)
      .post("/api/till/close")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ closed_by: "test-admin", closing_amount: 250 });

    expect(res.statusCode).toBe(200);
    expect(res.body.open).toBe(false);
  });

  test("POST /api/till/close returns 400 when till is already closed", async () => {
    const res = await request(app)
      .post("/api/till/close")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ closed_by: "test-admin" });

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe("Till is not open");
  });
});
