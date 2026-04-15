const request = require("supertest");
const app = require("../app");

let customerToken;
const testEmail = `profile_test_${Date.now()}@example.com`;

beforeAll(async () => {
  const regRes = await request(app)
    .post("/api/customer/auth/register")
    .send({
      name: "Profile Test",
      email: testEmail,
      phone: "07900 555444",
      address_line1: "10 Profile Road",
      city: "Manchester",
      postcode: "M1 1AE",
      password: "password1",
    });

  expect(regRes.statusCode).toBe(201);
  customerToken = regRes.body.token;
});

// ──────────────────────────────────────────────
// Auth guard
// ──────────────────────────────────────────────
describe("Auth guard on customer profile routes", () => {
  test("GET /api/customer/profile returns 401 without token", async () => {
    const res = await request(app).get("/api/customer/profile");
    // Route is at /customer/auth/me — profile is via auth/me
    // But profile update is at /api/customer/profile
    expect(res.statusCode).toBe(401);
  });

  test("PUT /api/customer/profile returns 401 without token", async () => {
    const res = await request(app)
      .put("/api/customer/profile")
      .send({ name: "New Name" });
    expect(res.statusCode).toBe(401);
  });

  test("PUT /api/customer/profile/password returns 401 without token", async () => {
    const res = await request(app)
      .put("/api/customer/profile/password")
      .send({ current_password: "password1", new_password: "newpassword2" });
    expect(res.statusCode).toBe(401);
  });
});

// ──────────────────────────────────────────────
// PUT /api/customer/profile — update profile fields
// ──────────────────────────────────────────────
describe("PUT /api/customer/profile", () => {
  test("returns 200 and updates name", async () => {
    const res = await request(app)
      .put("/api/customer/profile")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ name: "Updated Name" });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.customer.name).toBe("Updated Name");
  });

  test("returns 200 and updates city and postcode", async () => {
    const res = await request(app)
      .put("/api/customer/profile")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ city: "Birmingham", postcode: "B1 1BB" });

    expect(res.statusCode).toBe(200);
    expect(res.body.customer.city).toBe("Birmingham");
    expect(res.body.customer.postcode).toBe("B1 1BB");
  });

  test("returns 400 when name is explicitly set to empty string", async () => {
    const res = await request(app)
      .put("/api/customer/profile")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ name: "" });

    expect(res.statusCode).toBe(400);
    expect(Array.isArray(res.body.errors)).toBe(true);
  });

  test("response does not include password", async () => {
    const res = await request(app)
      .put("/api/customer/profile")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ phone: "07911 000001" });

    expect(res.statusCode).toBe(200);
    expect(res.body.customer).not.toHaveProperty("password");
  });

  test("partial update — unmentioned fields are preserved", async () => {
    // Set a known city
    await request(app)
      .put("/api/customer/profile")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ city: "Leeds" });

    // Update only phone — city should still be Leeds
    const res = await request(app)
      .put("/api/customer/profile")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ phone: "07922 111222" });

    expect(res.statusCode).toBe(200);
    expect(res.body.customer.city).toBe("Leeds");
  });
});

// ──────────────────────────────────────────────
// PUT /api/customer/profile/password
// ──────────────────────────────────────────────
describe("PUT /api/customer/profile/password", () => {
  test("returns 400 when current_password is missing", async () => {
    const res = await request(app)
      .put("/api/customer/profile/password")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ new_password: "newpassword2" });

    expect(res.statusCode).toBe(400);
    expect(Array.isArray(res.body.errors)).toBe(true);
  });

  test("returns 400 when new_password is too short", async () => {
    const res = await request(app)
      .put("/api/customer/profile/password")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ current_password: "password1", new_password: "abc" });

    expect(res.statusCode).toBe(400);
    expect(Array.isArray(res.body.errors)).toBe(true);
  });

  test("returns 401 when current_password is wrong", async () => {
    const res = await request(app)
      .put("/api/customer/profile/password")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ current_password: "wrongpassword", new_password: "newpassword2" });

    expect(res.statusCode).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test("returns 200 and changes password successfully", async () => {
    const res = await request(app)
      .put("/api/customer/profile/password")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ current_password: "password1", new_password: "newpassword2" });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify new password works for login
    const loginRes = await request(app)
      .post("/api/customer/auth/login")
      .send({ email: testEmail, password: "newpassword2" });

    expect(loginRes.statusCode).toBe(200);
    expect(loginRes.body).toHaveProperty("token");

    // Verify old password no longer works
    const oldLogin = await request(app)
      .post("/api/customer/auth/login")
      .send({ email: testEmail, password: "password1" });

    expect(oldLogin.statusCode).toBe(401);
  });
});
