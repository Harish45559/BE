const request = require("supertest");
const app = require("../app");

let customerToken;
let placedOrderId;

const testEmail = `co_test_${Date.now()}@example.com`;

const validItems = [
  { id: 1, name: "Paneer Tikka", price: 7.99, qty: 2 },
];

// ─── Setup: register customer, ensure online ordering is on, place one order ──
beforeAll(async () => {
  // Register customer
  const regRes = await request(app)
    .post("/api/customer/auth/register")
    .send({
      name: "Order Test Customer",
      email: testEmail,
      phone: "07900 111222",
      address_line1: "5 Order Street",
      city: "Luton",
      postcode: "LU1 5AA",
      password: "password1",
    });

  expect(regRes.statusCode).toBe(201);
  customerToken = regRes.body.token;

  // Enable online ordering in case it was toggled off by another test
  const staffLogin = await request(app)
    .post("/api/auth/login")
    .send({ username: "admin", password: process.env.ADMIN_DEFAULT_PASSWORD });
  const adminToken = staffLogin.body.token;

  const statusRes = await request(app)
    .get("/api/orders/online/status")
    .set("Authorization", `Bearer ${adminToken}`);

  if (statusRes.body.online_orders_enabled === false) {
    await request(app)
      .patch("/api/orders/online/toggle")
      .set("Authorization", `Bearer ${adminToken}`);
  }

  // Place a test order
  const orderRes = await request(app)
    .post("/api/customer/orders")
    .set("Authorization", `Bearer ${customerToken}`)
    .send({
      order_type: "Takeaway",
      items: validItems,
      payment_method: "Pay at Collection",
      pickup_time: "19:00 14/04/2026",
    });

  if (orderRes.statusCode === 201) {
    placedOrderId = orderRes.body.order.id;
  }
});

// ──────────────────────────────────────────────
// Auth guard — all customer order routes need Customer JWT
// ──────────────────────────────────────────────
describe("Auth guard on customer order routes", () => {
  test("POST /api/customer/orders returns 401 without token", async () => {
    const res = await request(app).post("/api/customer/orders").send({
      order_type: "Takeaway",
      items: validItems,
      payment_method: "Cash",
      pickup_time: "18:00 14/04/2026",
    });
    expect(res.statusCode).toBe(401);
  });

  test("GET /api/customer/orders returns 401 without token", async () => {
    const res = await request(app).get("/api/customer/orders");
    expect(res.statusCode).toBe(401);
  });

  test("GET /api/customer/orders/:id returns 401 without token", async () => {
    const res = await request(app).get("/api/customer/orders/1");
    expect(res.statusCode).toBe(401);
  });

  test("Staff JWT is rejected on customer order routes", async () => {
    const staffLogin = await request(app)
      .post("/api/auth/login")
      .send({ username: "admin", password: process.env.ADMIN_DEFAULT_PASSWORD });
    const staffToken = staffLogin.body.token;

    const res = await request(app)
      .get("/api/customer/orders")
      .set("Authorization", `Bearer ${staffToken}`);
    // Staff token is not a customer token
    expect(res.statusCode).toBe(401);
  });
});

// ──────────────────────────────────────────────
// POST /api/customer/orders — validation
// ──────────────────────────────────────────────
describe("POST /api/customer/orders — validation", () => {
  test("returns 400 for invalid order_type", async () => {
    const res = await request(app)
      .post("/api/customer/orders")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        order_type: "DriveThru",
        items: validItems,
        payment_method: "Cash",
        pickup_time: "18:00 14/04/2026",
      });
    expect(res.statusCode).toBe(400);
  });

  test("returns 400 when items array is empty", async () => {
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
        items: validItems,
        payment_method: "Crypto",
        pickup_time: "18:00 14/04/2026",
      });
    expect(res.statusCode).toBe(400);
  });

  test("returns 400 when item is missing price", async () => {
    const res = await request(app)
      .post("/api/customer/orders")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        order_type: "Takeaway",
        items: [{ name: "Dish", qty: 1 }], // no price
        payment_method: "Cash",
        pickup_time: "18:00 14/04/2026",
      });
    expect(res.statusCode).toBe(400);
  });
});

// ──────────────────────────────────────────────
// POST /api/customer/orders — happy path
// ──────────────────────────────────────────────
describe("POST /api/customer/orders — happy path", () => {
  test("returns 201 with order object for valid Takeaway order", async () => {
    const res = await request(app)
      .post("/api/customer/orders")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        order_type: "Takeaway",
        items: validItems,
        payment_method: "Pay at Collection",
        pickup_time: "18:30 14/04/2026",
      });

    if (res.statusCode === 503) return; // online ordering disabled

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.order).toHaveProperty("id");
    expect(res.body.order).toHaveProperty("order_number");
    expect(res.body.order.order_number).toMatch(/^OL\d{4}-[A-Z0-9]{4}$/);
    expect(res.body.order.source).toBeUndefined(); // source not returned in payload
    expect(res.body.order.order_type).toBe("Takeaway");
    expect(res.body.order.payment_status).toBe("pending");
  });

  test("OL order number format is OL{DDMM}-{XXXX}", async () => {
    const res = await request(app)
      .post("/api/customer/orders")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        order_type: "Eat In",
        items: validItems,
        payment_method: "Cash",
        pickup_time: "20:00 14/04/2026",
      });

    if (res.statusCode === 503) return;

    expect(res.statusCode).toBe(201);
    expect(res.body.order.order_number).toMatch(/^OL\d{4}-[A-Z0-9]{4}$/);
  });

  test("two consecutive online orders get different order numbers", async () => {
    const payload = {
      order_type: "Takeaway",
      items: validItems,
      payment_method: "Cash",
      pickup_time: "21:00 14/04/2026",
    };

    const r1 = await request(app)
      .post("/api/customer/orders")
      .set("Authorization", `Bearer ${customerToken}`)
      .send(payload);

    const r2 = await request(app)
      .post("/api/customer/orders")
      .set("Authorization", `Bearer ${customerToken}`)
      .send(payload);

    if (r1.statusCode === 503 || r2.statusCode === 503) return;

    expect(r1.body.order.order_number).not.toBe(r2.body.order.order_number);
  });
});

// ──────────────────────────────────────────────
// GET /api/customer/orders — my orders list
// ──────────────────────────────────────────────
describe("GET /api/customer/orders", () => {
  test("returns 200 and array of orders for the logged-in customer", async () => {
    const res = await request(app)
      .get("/api/customer/orders")
      .set("Authorization", `Bearer ${customerToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.orders)).toBe(true);
  });

  test("only returns orders belonging to this customer (not others)", async () => {
    // Register a second customer
    const reg2 = await request(app)
      .post("/api/customer/auth/register")
      .send({
        name: "Second Customer",
        email: `second_${Date.now()}@test.com`,
        phone: "07911 999888",
        address_line1: "2 Other St",
        city: "London",
        postcode: "SW1A 1AA",
        password: "password1",
      });
    const token2 = reg2.body.token;

    const res = await request(app)
      .get("/api/customer/orders")
      .set("Authorization", `Bearer ${token2}`);

    expect(res.statusCode).toBe(200);
    // Second customer has no orders — array should be empty
    expect(res.body.orders.length).toBe(0);
  });

  test("returned orders have expected fields", async () => {
    const res = await request(app)
      .get("/api/customer/orders")
      .set("Authorization", `Bearer ${customerToken}`);

    if (res.body.orders.length > 0) {
      const order = res.body.orders[0];
      expect(order).toHaveProperty("id");
      expect(order).toHaveProperty("order_number");
      expect(order).toHaveProperty("order_type");
      expect(order).toHaveProperty("items");
      expect(order).toHaveProperty("final_amount");
      expect(order).toHaveProperty("order_status");
      expect(order).toHaveProperty("payment_status");
    }
  });
});

// ──────────────────────────────────────────────
// GET /api/customer/orders/:id
// ──────────────────────────────────────────────
describe("GET /api/customer/orders/:id", () => {
  test("returns 404 for a non-existent order id", async () => {
    const res = await request(app)
      .get("/api/customer/orders/999999")
      .set("Authorization", `Bearer ${customerToken}`);

    expect(res.statusCode).toBe(404);
    expect(res.body.success).toBe(false);
  });

  test("returns 200 and the order when it belongs to this customer", async () => {
    if (!placedOrderId) return; // skip if order creation failed above

    const res = await request(app)
      .get(`/api/customer/orders/${placedOrderId}`)
      .set("Authorization", `Bearer ${customerToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.order.id).toBe(placedOrderId);
    expect(res.body.order).toHaveProperty("order_number");
    expect(res.body.order).toHaveProperty("order_status");
  });

  test("returns 404 when order belongs to a different customer", async () => {
    if (!placedOrderId) return;

    // Register another customer and try to access the first customer's order
    const reg2 = await request(app)
      .post("/api/customer/auth/register")
      .send({
        name: "Spy Customer",
        email: `spy_${Date.now()}@test.com`,
        phone: "07911 777666",
        address_line1: "3 Spy St",
        city: "London",
        postcode: "EC1A 1BB",
        password: "password1",
      });
    const spyToken = reg2.body.token;

    const res = await request(app)
      .get(`/api/customer/orders/${placedOrderId}`)
      .set("Authorization", `Bearer ${spyToken}`);

    // Order belongs to a different customer — should be 404
    expect(res.statusCode).toBe(404);
  });
});
