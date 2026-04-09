const request = require("supertest");
const app = require("../app");

let adminToken;

const validOrder = {
  customer_name: "Test Customer",
  server_name: "Test Server",
  order_type: "Dine In",
  items: [{ name: "Coffee", qty: 1, price: 3.5 }],
  total_amount: 3.5,
  final_amount: 3.5,
  payment_method: "cash",
};

beforeAll(async () => {
  const res = await request(app)
    .post("/api/auth/login")
    .send({ username: "admin", password: process.env.ADMIN_DEFAULT_PASSWORD });

  adminToken = res.body.token;
});

// ──────────────────────────────────────────────
// Auth guard
// ──────────────────────────────────────────────
describe("Auth guard on order routes", () => {
  const routes = [
    { method: "post", path: "/api/orders" },
    { method: "get",  path: "/api/orders/all" },
    { method: "get",  path: "/api/orders/by-date" },
    { method: "get",  path: "/api/orders/summary" },
    { method: "post", path: "/api/orders/held" },
    { method: "get",  path: "/api/orders/held" },
    { method: "delete", path: "/api/orders/held/clear-all" },
  ];

  routes.forEach(({ method, path }) => {
    test(`${method.toUpperCase()} ${path} returns 401 without token`, async () => {
      const res = await request(app)[method](path);
      expect(res.statusCode).toBe(401);
    });
  });
});

// ──────────────────────────────────────────────
// POST /api/orders — place order
// ──────────────────────────────────────────────
describe("POST /api/orders", () => {
  test("returns 400 when required fields are missing", async () => {
    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({});

    expect(res.statusCode).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  test("returns 400 when items array is empty", async () => {
    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ ...validOrder, items: [] });

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe("Order must have at least one item");
  });

  test("returns 201 and places order successfully", async () => {
    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(validOrder);

    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty("message", "Order placed successfully");
    expect(res.body.order).toHaveProperty("id");
    expect(res.body.order).toHaveProperty("order_number");
  });

  test("normalises payment_method capitalisation", async () => {
    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ ...validOrder, payment_method: "CARD" });

    expect(res.statusCode).toBe(201);
    expect(res.body.order.payment_method).toBe("Card");
  });
});

// ──────────────────────────────────────────────
// GET /api/orders/all
// ──────────────────────────────────────────────
describe("GET /api/orders/all", () => {
  test("returns 200 and an array", async () => {
    const res = await request(app)
      .get("/api/orders/all")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test("each order has expected fields", async () => {
    const res = await request(app)
      .get("/api/orders/all")
      .set("Authorization", `Bearer ${adminToken}`);

    if (res.body.length > 0) {
      const order = res.body[0];
      expect(order).toHaveProperty("id");
      expect(order).toHaveProperty("order_number");
      expect(order).toHaveProperty("total_amount");
      expect(order).toHaveProperty("payment_method");
    }
  });
});

// ──────────────────────────────────────────────
// GET /api/orders/by-date
// ──────────────────────────────────────────────
describe("GET /api/orders/by-date", () => {
  test("returns 200 for today (no date param)", async () => {
    const res = await request(app)
      .get("/api/orders/by-date")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test("returns 200 for a specific date", async () => {
    const res = await request(app)
      .get("/api/orders/by-date?date=2025-01-01")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

// ──────────────────────────────────────────────
// GET /api/orders/summary
// ──────────────────────────────────────────────
describe("GET /api/orders/summary", () => {
  test("returns 200 with totalOrders, totalRevenue, orders", async () => {
    const res = await request(app)
      .get("/api/orders/summary")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("totalOrders");
    expect(res.body).toHaveProperty("totalRevenue");
    expect(res.body).toHaveProperty("orders");
    expect(Array.isArray(res.body.orders)).toBe(true);
    expect(typeof res.body.totalRevenue).toBe("number");
  });

  test("accepts date range filter", async () => {
    const res = await request(app)
      .get("/api/orders/summary?from=2025-01-01&to=2025-12-31")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("totalOrders");
  });
});

// ──────────────────────────────────────────────
// Held orders — lifecycle: hold → list → delete
// ──────────────────────────────────────────────
describe("Held orders", () => {
  let heldOrderId;

  test("POST /api/orders/held returns 400 when items are missing", async () => {
    const res = await request(app)
      .post("/api/orders/held")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ total_amount: 5 });

    expect(res.statusCode).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  test("POST /api/orders/held returns 400 when total_amount is missing", async () => {
    const res = await request(app)
      .post("/api/orders/held")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ items: [{ name: "Tea", qty: 1 }] });

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe("total_amount is required");
  });

  test("POST /api/orders/held returns 201 and holds the order", async () => {
    const res = await request(app)
      .post("/api/orders/held")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        items: [{ name: "Tea", qty: 1, price: 2 }],
        total_amount: 2,
        customer_name: "Hold Test",
      });

    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty("message", "Order held successfully");
    expect(res.body.held).toHaveProperty("id");

    heldOrderId = res.body.held.id;
  });

  test("GET /api/orders/held returns 200 and an array", async () => {
    const res = await request(app)
      .get("/api/orders/held")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test("DELETE /api/orders/held/:id returns 404 for non-existent held order", async () => {
    const res = await request(app)
      .delete("/api/orders/held/999999")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(404);
    expect(res.body.error).toBe("Held order not found");
  });

  test("DELETE /api/orders/held/:id deletes the held order (cleanup)", async () => {
    const res = await request(app)
      .delete(`/api/orders/held/${heldOrderId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe("Held order deleted");
  });
});
