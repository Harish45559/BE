const request = require("supertest");
const app = require("../app");
const { Customer, Order } = require("../models");
const { Op } = require("sequelize");

let customerToken;
const testEmail = `profile_test_${Date.now()}@example.com`;

afterAll(async () => {
  const customers = await Customer.findAll({ where: { email: testEmail } });
  const ids = customers.map((c) => c.id);
  if (ids.length) {
    await Order.destroy({ where: { customer_id: { [Op.in]: ids } } });
    await Customer.destroy({ where: { id: { [Op.in]: ids } } });
  }
});

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
// GET /api/customer/profile/favourites
// POST /api/customer/profile/favourites/toggle/:itemId
// ──────────────────────────────────────────────
describe("Favourites endpoints", () => {
  test("GET /api/customer/profile/favourites returns 401 without token", async () => {
    const res = await request(app).get("/api/customer/profile/favourites");
    expect(res.statusCode).toBe(401);
  });

  test("POST /api/customer/profile/favourites/toggle/:itemId returns 401 without token", async () => {
    const res = await request(app).post("/api/customer/profile/favourites/toggle/1");
    expect(res.statusCode).toBe(401);
  });

  test("GET returns 200 and an array (empty for new customer)", async () => {
    const res = await request(app)
      .get("/api/customer/profile/favourites")
      .set("Authorization", `Bearer ${customerToken}`);

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body.favourites)).toBe(true);
  });

  test("toggle adds an item id to favourites", async () => {
    const res = await request(app)
      .post("/api/customer/profile/favourites/toggle/42")
      .set("Authorization", `Bearer ${customerToken}`);

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body.favourites)).toBe(true);
    expect(res.body.favourites).toContain(42);
  });

  test("toggle again removes the item from favourites", async () => {
    const res = await request(app)
      .post("/api/customer/profile/favourites/toggle/42")
      .set("Authorization", `Bearer ${customerToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.favourites).not.toContain(42);
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
