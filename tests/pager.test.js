const request = require("supertest");
const app = require("../app");

let adminToken;
let placedOrderId;
let pagerToken;

// ── Shared order payload ──────────────────────────────────────────────────────
const validOrder = {
  customer_name: "Pager Test Customer",
  server_name: "Test Server",
  order_type: "Take Away",
  items: [{ name: "Chai", qty: 1, price: 1.5 }],
  total_amount: 1.5,
  final_amount: 1.5,
  payment_method: "cash",
};

// ── Login once before all tests ───────────────────────────────────────────────
beforeAll(async () => {
  const res = await request(app)
    .post("/api/auth/login")
    .send({ username: "admin", password: process.env.ADMIN_DEFAULT_PASSWORD });

  adminToken = res.body.token;
  expect(adminToken).toBeTruthy();

  // Place an order so we have a real orderId to test against
  const orderRes = await request(app)
    .post("/api/orders")
    .set("Authorization", `Bearer ${adminToken}`)
    .send(validOrder);

  expect(orderRes.statusCode).toBe(201);
  placedOrderId = orderRes.body.order.id;
  expect(placedOrderId).toBeTruthy();
});

// ─────────────────────────────────────────────────────────────────────────────
// Auth guard — protected routes must reject without token
// ─────────────────────────────────────────────────────────────────────────────
describe("Auth guard on pager routes", () => {
  test("POST /api/pager/generate/:id returns 401 without token", async () => {
    const res = await request(app).post(`/api/pager/generate/1`);
    expect(res.statusCode).toBe(401);
  });

  test("PUT /api/pager/mark-ready/:token returns 401 without token", async () => {
    const res = await request(app).put("/api/pager/mark-ready/sometoken");
    expect(res.statusCode).toBe(401);
  });

  test("GET /api/pager/status/:token is public (no 401)", async () => {
    const res = await request(app).get("/api/pager/status/nonexistent");
    expect(res.statusCode).not.toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/pager/generate/:orderId
// ─────────────────────────────────────────────────────────────────────────────
describe("POST /api/pager/generate/:orderId", () => {
  test("returns 404 for a non-existent order", async () => {
    const res = await request(app)
      .post("/api/pager/generate/999999")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(404);
    expect(res.body).toHaveProperty("error");
  });

  test("returns 200 with token, qrCode, pagerUrl, orderNumber, customerName", async () => {
    const res = await request(app)
      .post(`/api/pager/generate/${placedOrderId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("token");
    expect(res.body).toHaveProperty("qrCode");
    expect(res.body).toHaveProperty("pagerUrl");
    expect(res.body).toHaveProperty("orderNumber");
    expect(res.body).toHaveProperty("customerName", "Pager Test Customer");

    pagerToken = res.body.token; // save for later tests
  });

  test("token is a 32-char hex string", async () => {
    const res = await request(app)
      .post(`/api/pager/generate/${placedOrderId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.body.token).toMatch(/^[a-f0-9]{32}$/);
    pagerToken = res.body.token; // refresh token (each call overwrites)
  });

  test("qrCode is a base64 PNG data URL", async () => {
    const res = await request(app)
      .post(`/api/pager/generate/${placedOrderId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.body.qrCode).toMatch(/^data:image\/png;base64,/);
    pagerToken = res.body.token;
  });

  test("pagerUrl contains the token", async () => {
    const res = await request(app)
      .post(`/api/pager/generate/${placedOrderId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.body.pagerUrl).toContain(res.body.token);
    pagerToken = res.body.token;
  });

  test("calling generate again produces a new unique token", async () => {
    const first = await request(app)
      .post(`/api/pager/generate/${placedOrderId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    const second = await request(app)
      .post(`/api/pager/generate/${placedOrderId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(first.body.token).not.toBe(second.body.token);
    pagerToken = second.body.token; // keep latest token in sync with DB
  }, 15000);
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/pager/status/:token
// ─────────────────────────────────────────────────────────────────────────────
describe("GET /api/pager/status/:token", () => {
  test("returns 404 for an invalid token", async () => {
    const res = await request(app).get("/api/pager/status/invalidtoken000");
    expect(res.statusCode).toBe(404);
    expect(res.body).toHaveProperty("error");
  });

  test("returns 200 with status, orderNumber, customerName for valid token", async () => {
    const res = await request(app).get(`/api/pager/status/${pagerToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("status");
    expect(res.body).toHaveProperty("orderNumber");
    expect(res.body).toHaveProperty("customerName", "Pager Test Customer");
  });

  test("status is 'waiting' right after generation", async () => {
    const res = await request(app).get(`/api/pager/status/${pagerToken}`);
    expect(res.body.status).toBe("waiting");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/pager/mark-ready/:token
// ─────────────────────────────────────────────────────────────────────────────
describe("PUT /api/pager/mark-ready/:token", () => {
  test("returns 404 for an invalid token", async () => {
    const res = await request(app)
      .put("/api/pager/mark-ready/invalidtoken000")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(404);
    expect(res.body).toHaveProperty("error");
  });

  test("returns 200 and marks the order as ready", async () => {
    const res = await request(app)
      .put(`/api/pager/mark-ready/${pagerToken}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("message", "Order marked as ready");
    expect(res.body).toHaveProperty("orderNumber");
  });

  test("status is 'ready' after marking", async () => {
    const res = await request(app).get(`/api/pager/status/${pagerToken}`);
    expect(res.body.status).toBe("ready");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /pager/:token — customer-facing HTML page
// ─────────────────────────────────────────────────────────────────────────────
describe("GET /pager/:token — customer page", () => {
  test("returns 200 HTML for any token", async () => {
    const res = await request(app).get("/pager/sometoken");
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toMatch(/html/);
  });

  test("page contains Mirchi Mafia branding", async () => {
    const res = await request(app).get("/pager/sometoken");
    expect(res.text).toContain("Mirchi Mafia");
  });

  test("page contains the token in the script", async () => {
    const res = await request(app).get(`/pager/${pagerToken}`);
    expect(res.text).toContain(pagerToken);
  });

  test("page contains tap-to-activate overlay", async () => {
    const res = await request(app).get("/pager/sometoken");
    expect(res.text).toContain("activate-overlay");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Order number format — DDMM-XXXX
// ─────────────────────────────────────────────────────────────────────────────
describe("Order number format", () => {
  test("new order gets a DDMM-XXXX format order number", async () => {
    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(validOrder);

    expect(res.statusCode).toBe(201);
    const orderNum = res.body.order.order_number;
    expect(orderNum).toMatch(/^\d{4}-[A-Z0-9]{4}$/);
  });

  test("order number prefix matches today's date (DDMM)", async () => {
    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(validOrder);

    const { DateTime } = require("luxon");
    const today = DateTime.now().setZone("Europe/London").toFormat("ddMM");
    const prefix = res.body.order.order_number.split("-")[0];
    expect(prefix).toBe(today);
  });

  test("two consecutive orders get different order numbers", async () => {
    const r1 = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(validOrder);

    const r2 = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(validOrder);

    expect(r1.body.order.order_number).not.toBe(r2.body.order.order_number);
  });
});
