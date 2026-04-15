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
// GET /api/customer/timeslots  (public — no auth)
// ──────────────────────────────────────────────
describe("GET /api/customer/timeslots", () => {
  test("is public — returns 200 without any token", async () => {
    const today = new Date().toISOString().split("T")[0];
    const res = await request(app).get(`/api/customer/timeslots?date=${today}`);
    expect(res.statusCode).toBe(200);
  });

  test("returns a slots array", async () => {
    const today = new Date().toISOString().split("T")[0];
    const res = await request(app).get(`/api/customer/timeslots?date=${today}`);
    expect(res.body).toHaveProperty("slots");
    expect(Array.isArray(res.body.slots)).toBe(true);
  });

  test("slots are in HH:mm format", async () => {
    const today = new Date().toISOString().split("T")[0];
    const res = await request(app).get(`/api/customer/timeslots?date=${today}`);
    res.body.slots.forEach((slot) => {
      expect(slot).toMatch(/^\d{2}:\d{2}$/);
    });
  });

  test("slots are in chronological order", async () => {
    const today = new Date().toISOString().split("T")[0];
    const res = await request(app).get(`/api/customer/timeslots?date=${today}`);
    const slots = res.body.slots;
    for (let i = 1; i < slots.length; i++) {
      expect(slots[i] > slots[i - 1]).toBe(true);
    }
  });

  test("returns same slots for any date (slots based on settings, not date)", async () => {
    const r1 = await request(app).get("/api/customer/timeslots?date=2026-04-14");
    const r2 = await request(app).get("/api/customer/timeslots?date=2026-04-21");
    // Slot count should match (same settings)
    expect(r1.body.slots.length).toBe(r2.body.slots.length);
  });
});

// ──────────────────────────────────────────────
// GET /api/customer/menu  (public — no auth)
// ──────────────────────────────────────────────
describe("GET /api/customer/menu", () => {
  test("is public — returns 200 without any token", async () => {
    const res = await request(app).get("/api/customer/menu");
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  test("each item has id, name, price, is_veg, categoryId fields", async () => {
    const res = await request(app).get("/api/customer/menu");
    if (res.body.items.length > 0) {
      const item = res.body.items[0];
      expect(item).toHaveProperty("id");
      expect(item).toHaveProperty("name");
      expect(item).toHaveProperty("price");
      expect(item).toHaveProperty("is_veg");
      expect(item).toHaveProperty("categoryId");
    }
  });

  test("category_id filter returns only items from that category", async () => {
    // Get categories first
    const catRes = await request(app).get("/api/customer/menu/categories");
    if (catRes.body.categories.length === 0) return;

    const catId = catRes.body.categories[0].id;
    const res = await request(app).get(`/api/customer/menu?category_id=${catId}`);

    expect(res.statusCode).toBe(200);
    res.body.items.forEach((item) => {
      expect(item.categoryId).toBe(catId);
    });
  });
});

// ──────────────────────────────────────────────
// GET /api/customer/menu/categories  (public)
// ──────────────────────────────────────────────
describe("GET /api/customer/menu/categories", () => {
  test("is public — returns 200 without any token", async () => {
    const res = await request(app).get("/api/customer/menu/categories");
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.categories)).toBe(true);
  });

  test("each category has id and name", async () => {
    const res = await request(app).get("/api/customer/menu/categories");
    res.body.categories.forEach((cat) => {
      expect(cat).toHaveProperty("id");
      expect(cat).toHaveProperty("name");
    });
  });
});

// ──────────────────────────────────────────────
// GET /api/orders/timeslots/settings  (Staff JWT)
// ──────────────────────────────────────────────
describe("GET /api/orders/timeslots/settings", () => {
  test("returns 401 without token", async () => {
    const res = await request(app).get("/api/orders/timeslots/settings");
    expect(res.statusCode).toBe(401);
  });

  test("returns 200 and settings object with staff token", async () => {
    const res = await request(app)
      .get("/api/orders/timeslots/settings")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("settings");
    expect(res.body.settings).toHaveProperty("opening_time");
    expect(res.body.settings).toHaveProperty("closing_time");
    expect(res.body.settings).toHaveProperty("slot_interval_minutes");
    expect(res.body.settings).toHaveProperty("online_orders_enabled");
  });

  test("opening_time and closing_time are HH:mm format", async () => {
    const res = await request(app)
      .get("/api/orders/timeslots/settings")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.body.settings.opening_time).toMatch(/^\d{2}:\d{2}$/);
    expect(res.body.settings.closing_time).toMatch(/^\d{2}:\d{2}$/);
  });

  test("slot_interval_minutes is a positive number", async () => {
    const res = await request(app)
      .get("/api/orders/timeslots/settings")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(typeof res.body.settings.slot_interval_minutes).toBe("number");
    expect(res.body.settings.slot_interval_minutes).toBeGreaterThan(0);
  });
});

// ──────────────────────────────────────────────
// PUT /api/orders/timeslots/settings  (Staff JWT)
// ──────────────────────────────────────────────
describe("PUT /api/orders/timeslots/settings", () => {
  let originalSettings;

  beforeAll(async () => {
    const res = await request(app)
      .get("/api/orders/timeslots/settings")
      .set("Authorization", `Bearer ${adminToken}`);
    originalSettings = res.body.settings;
  });

  afterAll(async () => {
    // Restore original settings so we don't affect other tests
    if (originalSettings) {
      await request(app)
        .put("/api/orders/timeslots/settings")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          opening_time: originalSettings.opening_time,
          closing_time: originalSettings.closing_time,
          slot_interval_minutes: originalSettings.slot_interval_minutes,
        });
    }
  });

  test("returns 401 without token", async () => {
    const res = await request(app)
      .put("/api/orders/timeslots/settings")
      .send({ opening_time: "18:00", closing_time: "23:30", slot_interval_minutes: 30 });
    expect(res.statusCode).toBe(401);
  });

  test("returns 200 and updates settings", async () => {
    const res = await request(app)
      .put("/api/orders/timeslots/settings")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ opening_time: "17:00", closing_time: "22:00", slot_interval_minutes: 15 });

    expect(res.statusCode).toBe(200);
    expect(res.body.settings.opening_time).toBe("17:00");
    expect(res.body.settings.closing_time).toBe("22:00");
    expect(res.body.settings.slot_interval_minutes).toBe(15);
  });

  test("changing interval affects the number of slots returned", async () => {
    // Set to 60-min slots
    await request(app)
      .put("/api/orders/timeslots/settings")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ opening_time: "18:00", closing_time: "22:00", slot_interval_minutes: 60 });

    const hourly = await request(app).get("/api/customer/timeslots?date=2026-05-01");

    // Set to 30-min slots
    await request(app)
      .put("/api/orders/timeslots/settings")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ opening_time: "18:00", closing_time: "22:00", slot_interval_minutes: 30 });

    const halfHourly = await request(app).get("/api/customer/timeslots?date=2026-05-01");

    // 30-min slots should produce roughly double the count
    expect(halfHourly.body.slots.length).toBeGreaterThan(hourly.body.slots.length);
  });
});
