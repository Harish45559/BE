const request = require("supertest");
const app = require("../app");

// ──────────────────────────────────────────────
// GET /health
// ──────────────────────────────────────────────
describe("GET /health", () => {
  test("returns 200 and status ok", async () => {
    const res = await request(app).get("/health");
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("status", "ok");
  });
});

// ──────────────────────────────────────────────
// POST /api/auth/login
// ──────────────────────────────────────────────
describe("POST /api/auth/login", () => {
  // ✅ Happy path — valid admin credentials
  test("returns 200 + token with valid credentials", async () => {
    const res = await request(app).post("/api/auth/login").send({
      username: "admin",
      password: process.env.ADMIN_DEFAULT_PASSWORD,
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body).toHaveProperty("token"); // JWT must exist
    expect(res.body).toHaveProperty("role"); // role must exist
  });

  // ❌ Wrong password
  test("returns 401 with wrong password", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: "admin", password: "wrongpassword123" });

    expect(res.statusCode).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe("Invalid credentials");
  });

  // ❌ Missing username
  test("returns 400 when username is missing", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ password: "somepassword" });

    expect(res.statusCode).toBe(400);
    // express-validator returns { errors: [...array...] }
    expect(Array.isArray(res.body.errors)).toBe(true);
    expect(res.body.errors.some((e) => e.path === "username")).toBe(true);
  });

  // ❌ Missing password
  test("returns 400 when password is missing", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: "admin" });

    expect(res.statusCode).toBe(400);
    expect(Array.isArray(res.body.errors)).toBe(true);
    expect(res.body.errors.some((e) => e.path === "password")).toBe(true);
  });

  // ❌ Empty body
  test("returns 400 when body is empty", async () => {
    const res = await request(app).post("/api/auth/login").send({});

    expect(res.statusCode).toBe(400);
    expect(Array.isArray(res.body.errors)).toBe(true);
  });
});

// ──────────────────────────────────────────────
// POST /api/auth/forgot-password
// ──────────────────────────────────────────────
describe("POST /api/auth/forgot-password", () => {
  test("returns 403 when trying to reset admin password", async () => {
    const res = await request(app)
      .post("/api/auth/forgot-password")
      .send({ username: "admin", newPassword: "newpassword123" });

    expect(res.statusCode).toBe(403);
    expect(res.body.message).toBe("Admin reset not allowed");
  });

  test("returns 400 when username is missing", async () => {
    const res = await request(app)
      .post("/api/auth/forgot-password")
      .send({ newPassword: "newpassword123" });

    expect(res.statusCode).toBe(400);
    expect(Array.isArray(res.body.errors)).toBe(true);
    expect(res.body.errors.some((e) => e.path === "username")).toBe(true);
  });

  test("returns 400 when newPassword is missing", async () => {
    const res = await request(app)
      .post("/api/auth/forgot-password")
      .send({ username: "someuser" });

    expect(res.statusCode).toBe(400);
    expect(Array.isArray(res.body.errors)).toBe(true);
    expect(res.body.errors.some((e) => e.path === "newPassword")).toBe(true);
  });

  test("returns 404 for non-existent user", async () => {
    const res = await request(app)
      .post("/api/auth/forgot-password")
      .send({ username: "nonexistentuser999", newPassword: "newpassword123" });

    expect(res.statusCode).toBe(404);
    expect(res.body.message).toBe("User not found");
  });
});
