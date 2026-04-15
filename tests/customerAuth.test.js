const request = require("supertest");
const app = require("../app");

// Unique email per test run to avoid duplicate conflicts across runs
const testEmail = `testcustomer_${Date.now()}@example.com`;
let customerToken; // shared between register → me tests

const validCustomer = {
  name: "Test Customer",
  email: testEmail,
  phone: "07911 123456",
  address_line1: "1 Test Street",
  city: "London",
  postcode: "LU1 3BW",
  password: "password1",
};

// ──────────────────────────────────────────────
// POST /api/customer/auth/register
// ──────────────────────────────────────────────
describe("POST /api/customer/auth/register", () => {
  // ✅ Happy path — creates a new customer
  test("returns 201 + token with valid data", async () => {
    const res = await request(app)
      .post("/api/customer/auth/register")
      .send(validCustomer);

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body).toHaveProperty("token");
    expect(res.body.customer).toHaveProperty("id");
    expect(res.body.customer.email).toBe(testEmail);
    expect(res.body.customer).not.toHaveProperty("password");

    customerToken = res.body.token; // save for /me test below
  });

  // ❌ Duplicate email
  test("returns 409 when email already registered", async () => {
    const res = await request(app)
      .post("/api/customer/auth/register")
      .send(validCustomer); // same email as above

    expect(res.statusCode).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/already exists/i);
  });

  // ❌ Missing required fields — express-validator returns 400
  test("returns 400 when email is missing", async () => {
    const { email, ...rest } = validCustomer;
    const res = await request(app)
      .post("/api/customer/auth/register")
      .send({ ...rest, email: "not-an-email" });

    expect(res.statusCode).toBe(400);
    expect(Array.isArray(res.body.errors)).toBe(true);
  });

  test("returns 400 when name is missing", async () => {
    const res = await request(app)
      .post("/api/customer/auth/register")
      .send({ ...validCustomer, name: "" });

    expect(res.statusCode).toBe(400);
    expect(Array.isArray(res.body.errors)).toBe(true);
  });

  test("returns 400 when password is too short", async () => {
    const res = await request(app)
      .post("/api/customer/auth/register")
      .send({ ...validCustomer, email: `short_${Date.now()}@test.com`, password: "abc" });

    expect(res.statusCode).toBe(400);
    expect(Array.isArray(res.body.errors)).toBe(true);
  });
});

// ──────────────────────────────────────────────
// POST /api/customer/auth/login
// ──────────────────────────────────────────────
describe("POST /api/customer/auth/login", () => {
  // ✅ Valid credentials
  test("returns 200 + token with valid credentials", async () => {
    const res = await request(app)
      .post("/api/customer/auth/login")
      .send({ email: testEmail, password: validCustomer.password });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body).toHaveProperty("token");
    expect(res.body.customer.email).toBe(testEmail);
  });

  // ❌ Wrong password
  test("returns 401 with wrong password", async () => {
    const res = await request(app)
      .post("/api/customer/auth/login")
      .send({ email: testEmail, password: "wrongpassword" });

    expect(res.statusCode).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe("Invalid credentials");
  });

  // ❌ Unknown email
  test("returns 401 for unregistered email", async () => {
    const res = await request(app)
      .post("/api/customer/auth/login")
      .send({ email: "nobody@nowhere.com", password: "password1" });

    expect(res.statusCode).toBe(401);
    expect(res.body.success).toBe(false);
  });

  // ❌ Missing fields
  test("returns 400 when email is missing", async () => {
    const res = await request(app)
      .post("/api/customer/auth/login")
      .send({ password: "password1" });

    expect(res.statusCode).toBe(400);
    expect(Array.isArray(res.body.errors)).toBe(true);
  });

  test("returns 400 when password is missing", async () => {
    const res = await request(app)
      .post("/api/customer/auth/login")
      .send({ email: testEmail });

    expect(res.statusCode).toBe(400);
    expect(Array.isArray(res.body.errors)).toBe(true);
  });
});

// ──────────────────────────────────────────────
// GET /api/customer/auth/me
// ──────────────────────────────────────────────
describe("GET /api/customer/auth/me", () => {
  test("returns 401 without token", async () => {
    const res = await request(app).get("/api/customer/auth/me");
    expect(res.statusCode).toBe(401);
  });

  test("returns 401 with staff token instead of customer token", async () => {
    // Get a staff token
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ username: "admin", password: process.env.ADMIN_DEFAULT_PASSWORD });
    const staffToken = loginRes.body.token;

    const res = await request(app)
      .get("/api/customer/auth/me")
      .set("Authorization", `Bearer ${staffToken}`);

    // Staff token is not a customer token — should be rejected
    expect(res.statusCode).toBe(401);
  });

  test("returns 200 and customer profile with valid customer token", async () => {
    const res = await request(app)
      .get("/api/customer/auth/me")
      .set("Authorization", `Bearer ${customerToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.customer.email).toBe(testEmail);
    expect(res.body.customer).not.toHaveProperty("password");
  });
});

// ──────────────────────────────────────────────
// POST /api/customer/auth/forgot-password
// ──────────────────────────────────────────────
describe("POST /api/customer/auth/forgot-password", () => {
  // ✅ Registered email — returns resetToken
  test("returns 200 + resetToken for a registered email", async () => {
    const res = await request(app)
      .post("/api/customer/auth/forgot-password")
      .send({ email: testEmail });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body).toHaveProperty("resetToken");
    expect(typeof res.body.resetToken).toBe("string");
  });

  // Unknown email — still returns 200 (security: don't reveal if email exists)
  test("returns 200 for an unregistered email (no account enumeration)", async () => {
    const res = await request(app)
      .post("/api/customer/auth/forgot-password")
      .send({ email: "nobody_here@nowhere.com" });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    // resetToken must NOT be present for unknown emails
    expect(res.body).not.toHaveProperty("resetToken");
  });

  // ❌ Missing email — 400
  test("returns 400 when email is missing", async () => {
    const res = await request(app)
      .post("/api/customer/auth/forgot-password")
      .send({});

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBeTruthy();
  });
});

// ──────────────────────────────────────────────
// POST /api/customer/auth/reset-password
// ──────────────────────────────────────────────
describe("POST /api/customer/auth/reset-password", () => {
  let resetToken;

  // Get a fresh reset token before tests run
  beforeAll(async () => {
    const res = await request(app)
      .post("/api/customer/auth/forgot-password")
      .send({ email: testEmail });
    resetToken = res.body.resetToken;
  });

  // ✅ Valid token + new password
  test("returns 200 and resets password with a valid token", async () => {
    const res = await request(app)
      .post("/api/customer/auth/reset-password")
      .send({ token: resetToken, password: "newpassword1" });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/password updated/i);

    // Reset back so other tests still work (they use "password1")
    await request(app)
      .post("/api/customer/auth/reset-password")
      .send({ token: resetToken, password: validCustomer.password });
  });

  // ❌ Invalid / tampered token
  test("returns 400 for an invalid token", async () => {
    const res = await request(app)
      .post("/api/customer/auth/reset-password")
      .send({ token: "this.is.not.valid", password: "newpassword1" });

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  // ❌ Missing token field
  test("returns 400 when token is missing", async () => {
    const res = await request(app)
      .post("/api/customer/auth/reset-password")
      .send({ password: "newpassword1" });

    expect(res.statusCode).toBe(400);
  });

  // ❌ Password too short
  test("returns 400 when new password is too short", async () => {
    const res = await request(app)
      .post("/api/customer/auth/reset-password")
      .send({ token: resetToken, password: "abc" });

    expect(res.statusCode).toBe(400);
  });
});

// ──────────────────────────────────────────────
// GET /api/customer/auth/list  (staff only)
// ──────────────────────────────────────────────
describe("GET /api/customer/auth/list", () => {
  let adminToken;

  beforeAll(async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: "admin", password: process.env.ADMIN_DEFAULT_PASSWORD });
    adminToken = res.body.token;
  });

  test("returns 401 without any token", async () => {
    const res = await request(app).get("/api/customer/auth/list");
    expect(res.statusCode).toBe(401);
  });

  test("returns 401 when customer token is used (not staff)", async () => {
    const res = await request(app)
      .get("/api/customer/auth/list")
      .set("Authorization", `Bearer ${customerToken}`);
    // Customer JWT is not a staff JWT — middleware should reject
    expect(res.statusCode).toBe(401);
  });

  test("returns 200 and array of customers with staff token", async () => {
    const res = await request(app)
      .get("/api/customer/auth/list")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.customers)).toBe(true);
    // The customer we registered should be in the list
    const found = res.body.customers.find((c) => c.email === testEmail);
    expect(found).toBeDefined();
    expect(found).not.toHaveProperty("password");
  });
});
