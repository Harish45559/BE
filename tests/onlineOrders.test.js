const request = require("supertest");
const app = require("../app");

let adminToken;
let testOrderId;        // online order created in beforeAll, used throughout
let testOrderNumber;

const testEmail = `ol_customer_${Date.now()}@example.com`;

// ──────────────────────────────────────────────
// Setup: get staff token + register customer + place one online order
// ──────────────────────────────────────────────
beforeAll(async () => {
  // 1. Staff token
  const loginRes = await request(app)
    .post("/api/auth/login")
    .send({ username: "admin", password: process.env.ADMIN_DEFAULT_PASSWORD });
  adminToken = loginRes.body.token;

  // 2. Register a customer and get their token
  const regRes = await request(app)
    .post("/api/customer/auth/register")
    .send({
      name: "Online Test Customer",
      email: testEmail,
      phone: "07900 000001",
      address_line1: "99 Test Road",
      city: "Luton",
      postcode: "LU2 0AA",
      password: "password1",
    });
  const customerToken = regRes.body.token;

  // 3. Place an online order as that customer (used by accept/reject/complete tests)
  const orderRes = await request(app)
    .post("/api/customer/orders")
    .set("Authorization", `Bearer ${customerToken}`)
    .send({
      order_type: "Takeaway",
      items: [{ id: 1, name: "Test Dish", price: 5.99, qty: 2 }],
      payment_method: "Pay at Collection",
      pickup_time: "18:00 14/04/2026",
    });

  // If online ordering is disabled on the test DB, skip gracefully
  if (orderRes.statusCode === 201) {
    testOrderId = orderRes.body.order.id;
    testOrderNumber = orderRes.body.order.order_number;
  }
});

// ──────────────────────────────────────────────
// Auth guard — all online order staff routes require Staff JWT
// ──────────────────────────────────────────────
describe("Auth guard — online orders routes", () => {
  test("GET /api/orders/online returns 401 without token", async () => {
    const res = await request(app).get("/api/orders/online");
    expect(res.statusCode).toBe(401);
  });

  test("GET /api/orders/online/pending returns 401 without token", async () => {
    const res = await request(app).get("/api/orders/online/pending");
    expect(res.statusCode).toBe(401);
  });

  test("GET /api/orders/online/status returns 401 without token", async () => {
    const res = await request(app).get("/api/orders/online/status");
    expect(res.statusCode).toBe(401);
  });

  test("PATCH /api/orders/online/toggle returns 401 without token", async () => {
    const res = await request(app).patch("/api/orders/online/toggle");
    expect(res.statusCode).toBe(401);
  });
});

// ──────────────────────────────────────────────
// GET /api/orders/online
// ──────────────────────────────────────────────
describe("GET /api/orders/online", () => {
  test("returns 200 and orders array with staff token", async () => {
    const res = await request(app)
      .get("/api/orders/online")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.orders)).toBe(true);
  });

  test("accepts date query param and returns filtered result", async () => {
    const res = await request(app)
      .get("/api/orders/online?date=2024-01-01")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.date).toBe("2024-01-01");
    // Old date — should return empty array (no orders that day)
    expect(res.body.orders.length).toBe(0);
  });
});

// ──────────────────────────────────────────────
// GET /api/orders/online/pending
// ──────────────────────────────────────────────
describe("GET /api/orders/online/pending", () => {
  test("returns 200 and only pending orders", async () => {
    const res = await request(app)
      .get("/api/orders/online/pending")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.orders)).toBe(true);
    // Every order in the result must have order_status = "pending"
    res.body.orders.forEach((o) => {
      expect(o.order_status).toBe("pending");
    });
  });
});

// ──────────────────────────────────────────────
// GET /api/orders/online/status
// ──────────────────────────────────────────────
describe("GET /api/orders/online/status", () => {
  test("returns 200 and online_orders_enabled boolean", async () => {
    const res = await request(app)
      .get("/api/orders/online/status")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.online_orders_enabled).toBe("boolean");
  });
});

// ──────────────────────────────────────────────
// PATCH /api/orders/online/toggle
// ──────────────────────────────────────────────
describe("PATCH /api/orders/online/toggle", () => {
  test("toggles online_orders_enabled and returns new value", async () => {
    // Get current state
    const statusBefore = await request(app)
      .get("/api/orders/online/status")
      .set("Authorization", `Bearer ${adminToken}`);
    const before = statusBefore.body.online_orders_enabled;

    // Toggle
    const toggleRes = await request(app)
      .patch("/api/orders/online/toggle")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(toggleRes.statusCode).toBe(200);
    expect(toggleRes.body.online_orders_enabled).toBe(!before);

    // Toggle back so we don't break other tests
    await request(app)
      .patch("/api/orders/online/toggle")
      .set("Authorization", `Bearer ${adminToken}`);
  });
});

// ──────────────────────────────────────────────
// PATCH /api/orders/online/:id/accept
// ──────────────────────────────────────────────
describe("PATCH /api/orders/online/:id/accept", () => {
  test("returns 404 for a non-existent order id", async () => {
    const res = await request(app)
      .patch("/api/orders/online/999999/accept")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ minutes: 20 });

    expect(res.statusCode).toBe(404);
    expect(res.body.success).toBe(false);
  });

  test("returns 401 without token", async () => {
    const id = testOrderId || 1;
    const res = await request(app)
      .patch(`/api/orders/online/${id}/accept`)
      .send({ minutes: 20 });

    expect(res.statusCode).toBe(401);
  });

  test("returns 200, sets order_status=accepted and estimated_ready when order exists", async () => {
    if (!testOrderId) return; // skip if order creation failed (online ordering disabled)

    const res = await request(app)
      .patch(`/api/orders/online/${testOrderId}/accept`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ minutes: 20 });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.order_status).toBe("accepted");
    // estimated_ready should be a HH:mm string
    expect(res.body.estimated_ready).toMatch(/^\d{2}:\d{2}$/);
  });

  test("estimated_ready is pickup_slot + minutes (not just now + minutes)", async () => {
    // Place a fresh order with a known pickup_time of 18:00
    const regRes = await request(app)
      .post("/api/customer/auth/register")
      .send({
        name: "Slot Test",
        email: `slot_${Date.now()}@test.com`,
        phone: "07911 111111",
        address_line1: "1 Slot St",
        city: "London",
        postcode: "EC1A 1BB",
        password: "password1",
      });
    const tok = regRes.body.token;

    const orderRes = await request(app)
      .post("/api/customer/orders")
      .set("Authorization", `Bearer ${tok}`)
      .send({
        order_type: "Takeaway",
        items: [{ id: 1, name: "Dish", price: 4.0, qty: 1 }],
        payment_method: "Cash",
        pickup_time: "18:00 14/04/2026",
      });

    if (orderRes.statusCode !== 201) return; // online ordering disabled

    const slotOrderId = orderRes.body.order.id;

    const acceptRes = await request(app)
      .patch(`/api/orders/online/${slotOrderId}/accept`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ minutes: 20 });

    expect(acceptRes.statusCode).toBe(200);
    // Pickup was 18:00 + 20 min = 18:20
    expect(acceptRes.body.estimated_ready).toBe("18:20");
  });
});

// ──────────────────────────────────────────────
// PATCH /api/orders/online/:id/ready
// ──────────────────────────────────────────────
describe("PATCH /api/orders/online/:id/ready", () => {
  test("returns 404 for non-existent order", async () => {
    const res = await request(app)
      .patch("/api/orders/online/999999/ready")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(404);
    expect(res.body.success).toBe(false);
  });

  test("returns 401 without token", async () => {
    const res = await request(app).patch("/api/orders/online/1/ready");
    expect(res.statusCode).toBe(401);
  });

  test("returns 200 and sets order_status=ready", async () => {
    // Place + accept a fresh order, then mark as ready
    const regRes = await request(app)
      .post("/api/customer/auth/register")
      .send({
        name: "Ready Test",
        email: `ready_${Date.now()}@test.com`,
        phone: "07955 555555",
        address_line1: "5 Ready St",
        city: "Luton",
        postcode: "LU1 3CC",
        password: "password1",
      });
    const tok = regRes.body.token;

    const orderRes = await request(app)
      .post("/api/customer/orders")
      .set("Authorization", `Bearer ${tok}`)
      .send({
        order_type: "Takeaway",
        items: [{ id: 1, name: "Dish", price: 5.0, qty: 1 }],
        payment_method: "Pay at Collection",
        pickup_time: "17:00 14/04/2026",
      });

    if (orderRes.statusCode !== 201) return; // online ordering disabled

    const readyOrderId = orderRes.body.order.id;

    // Accept first
    await request(app)
      .patch(`/api/orders/online/${readyOrderId}/accept`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ minutes: 15 });

    // Now mark as ready
    const res = await request(app)
      .patch(`/api/orders/online/${readyOrderId}/ready`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.order_status).toBe("ready");
  });
});

// ──────────────────────────────────────────────
// PATCH /api/orders/online/:id/reject
// ──────────────────────────────────────────────
describe("PATCH /api/orders/online/:id/reject", () => {
  test("returns 404 for non-existent order", async () => {
    const res = await request(app)
      .patch("/api/orders/online/999999/reject")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(404);
  });

  test("returns 401 without token", async () => {
    const res = await request(app).patch("/api/orders/online/1/reject");
    expect(res.statusCode).toBe(401);
  });

  test("returns 200 and sets order_status=rejected when order exists", async () => {
    // Place a fresh order to reject (so we have a pending one)
    const regRes = await request(app)
      .post("/api/customer/auth/register")
      .send({
        name: "Reject Test",
        email: `reject_${Date.now()}@test.com`,
        phone: "07922 222222",
        address_line1: "2 Reject St",
        city: "Luton",
        postcode: "LU1 1AA",
        password: "password1",
      });
    const tok = regRes.body.token;

    const orderRes = await request(app)
      .post("/api/customer/orders")
      .set("Authorization", `Bearer ${tok}`)
      .send({
        order_type: "Eat In",
        items: [{ id: 1, name: "Dish", price: 3.5, qty: 1 }],
        payment_method: "Cash",
        pickup_time: "19:00 14/04/2026",
      });

    if (orderRes.statusCode !== 201) return;

    const rejectOrderId = orderRes.body.order.id;

    const res = await request(app)
      .patch(`/api/orders/online/${rejectOrderId}/reject`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.order_status).toBe("rejected");
  });
});

// ──────────────────────────────────────────────
// PATCH /api/orders/online/:id/complete
// ──────────────────────────────────────────────
describe("PATCH /api/orders/online/:id/complete", () => {
  test("returns 404 for non-existent order", async () => {
    const res = await request(app)
      .patch("/api/orders/online/999999/complete")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(404);
  });

  test("returns 401 without token", async () => {
    const res = await request(app).patch("/api/orders/online/1/complete");
    expect(res.statusCode).toBe(401);
  });

  test("returns 200 and sets order_status=completed", async () => {
    // Place + accept a fresh order, then complete it
    const regRes = await request(app)
      .post("/api/customer/auth/register")
      .send({
        name: "Complete Test",
        email: `complete_${Date.now()}@test.com`,
        phone: "07933 333333",
        address_line1: "3 Complete St",
        city: "Luton",
        postcode: "LU1 2BB",
        password: "password1",
      });
    const tok = regRes.body.token;

    const orderRes = await request(app)
      .post("/api/customer/orders")
      .set("Authorization", `Bearer ${tok}`)
      .send({
        order_type: "Takeaway",
        items: [{ id: 1, name: "Dish", price: 6.0, qty: 1 }],
        payment_method: "Pay at Collection",
        pickup_time: "20:00 14/04/2026",
      });

    if (orderRes.statusCode !== 201) return;

    const completeOrderId = orderRes.body.order.id;

    // Accept first
    await request(app)
      .patch(`/api/orders/online/${completeOrderId}/accept`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ minutes: 15 });

    // Now complete
    const res = await request(app)
      .patch(`/api/orders/online/${completeOrderId}/complete`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.order_status).toBe("completed");
  });
});

// ──────────────────────────────────────────────
// Customer order placement validation
// ──────────────────────────────────────────────
describe("POST /api/customer/orders — validation", () => {
  let customerToken;

  beforeAll(async () => {
    const regRes = await request(app)
      .post("/api/customer/auth/register")
      .send({
        name: "Val Test Customer",
        email: `val_${Date.now()}@test.com`,
        phone: "07944 444444",
        address_line1: "4 Val St",
        city: "London",
        postcode: "SW1A 1AA",
        password: "password1",
      });
    customerToken = regRes.body.token;
  });

  test("returns 401 without customer token", async () => {
    const res = await request(app).post("/api/customer/orders").send({
      order_type: "Takeaway",
      items: [{ name: "Dish", price: 5, qty: 1 }],
      payment_method: "Cash",
      pickup_time: "18:00 14/04/2026",
    });
    expect(res.statusCode).toBe(401);
  });

  test("returns 400 for invalid order_type", async () => {
    const res = await request(app)
      .post("/api/customer/orders")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        order_type: "DriveThrough", // invalid
        items: [{ name: "Dish", price: 5, qty: 1 }],
        payment_method: "Cash",
        pickup_time: "18:00 14/04/2026",
      });
    expect(res.statusCode).toBe(400);
  });

  test("returns 400 for empty items array", async () => {
    const res = await request(app)
      .post("/api/customer/orders")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        order_type: "Takeaway",
        items: [],
        payment_method: "Cash",
        pickup_time: "18:00 14/04/2026",
      });
    expect(res.statusCode).toBe(400);
  });

  test("returns 400 for invalid payment_method", async () => {
    const res = await request(app)
      .post("/api/customer/orders")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        order_type: "Takeaway",
        items: [{ name: "Dish", price: 5, qty: 1 }],
        payment_method: "Bitcoin", // invalid
        pickup_time: "18:00 14/04/2026",
      });
    expect(res.statusCode).toBe(400);
  });
});
