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
describe("Auth guard on report routes", () => {
  const protectedRoutes = [
    "/api/reports",
    "/api/reports/summary",
    "/api/reports/detailed-sessions",
    "/api/reports/export/csv",
    "/api/reports/export/pdf",
  ];

  protectedRoutes.forEach((path) => {
    test(`GET ${path} returns 401 without token`, async () => {
      const res = await request(app).get(path);
      expect(res.statusCode).toBe(401);
    });
  });
});

// ──────────────────────────────────────────────
// GET /api/reports
// ──────────────────────────────────────────────
describe("GET /api/reports", () => {
  test("returns 200 and an array", async () => {
    const res = await request(app)
      .get("/api/reports")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test("accepts employee_id filter without error", async () => {
    const res = await request(app)
      .get("/api/reports?employee_id=all")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test("accepts date range filter without error", async () => {
    const res = await request(app)
      .get("/api/reports?from=2025-01-01&to=2025-12-31")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test("each item has expected fields", async () => {
    const res = await request(app)
      .get("/api/reports")
      .set("Authorization", `Bearer ${adminToken}`);

    if (res.body.length > 0) {
      const item = res.body[0];
      expect(item).toHaveProperty("id");
      expect(item).toHaveProperty("employee");
      expect(item).toHaveProperty("date");
      expect(item).toHaveProperty("clock_in_uk");
      expect(item).toHaveProperty("clock_out_uk");
      expect(item).toHaveProperty("total_work_hhmm");
    }
  });
});

// ──────────────────────────────────────────────
// GET /api/reports/summary
// ──────────────────────────────────────────────
describe("GET /api/reports/summary", () => {
  test("returns 200 and an array", async () => {
    const res = await request(app)
      .get("/api/reports/summary")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test("accepts from/to date filters", async () => {
    const res = await request(app)
      .get("/api/reports/summary?from=2025-01-01&to=2025-12-31")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test("each item has expected summary fields", async () => {
    const res = await request(app)
      .get("/api/reports/summary")
      .set("Authorization", `Bearer ${adminToken}`);

    if (res.body.length > 0) {
      const item = res.body[0];
      expect(item).toHaveProperty("employee");
      expect(item).toHaveProperty("date");
      expect(item).toHaveProperty("first_clock_in");
      expect(item).toHaveProperty("last_clock_out");
      expect(item).toHaveProperty("total_work_hours");
      expect(item).toHaveProperty("sessions");
      expect(Array.isArray(item.sessions)).toBe(true);
    }
  });
});

// ──────────────────────────────────────────────
// GET /api/reports/detailed-sessions
// ──────────────────────────────────────────────
describe("GET /api/reports/detailed-sessions", () => {
  test("returns 400 when employee_id and date are missing", async () => {
    const res = await request(app)
      .get("/api/reports/detailed-sessions")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe("employee_id and date are required");
  });

  test("returns 400 when date is missing", async () => {
    const res = await request(app)
      .get("/api/reports/detailed-sessions?employee_id=1")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(400);
  });

  test("returns 400 when employee_id is missing", async () => {
    const res = await request(app)
      .get("/api/reports/detailed-sessions?date=2025-01-01")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(400);
  });

  test("returns 200 with sessions array for valid params", async () => {
    const res = await request(app)
      .get("/api/reports/detailed-sessions?employee_id=1&date=2025-01-01")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("sessions");
    expect(res.body).toHaveProperty("total_sessions");
    expect(Array.isArray(res.body.sessions)).toBe(true);
    expect(typeof res.body.total_sessions).toBe("number");
  });
});

// ──────────────────────────────────────────────
// GET /api/reports/export/csv
// ──────────────────────────────────────────────
describe("GET /api/reports/export/csv", () => {
  test("returns 200 with CSV content-type", async () => {
    const res = await request(app)
      .get("/api/reports/export/csv")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/csv/);
  });

  test("response has correct filename in content-disposition", async () => {
    const res = await request(app)
      .get("/api/reports/export/csv")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.headers["content-disposition"]).toMatch(
      /attendance_report\.csv/
    );
  });

  test("accepts date range filter", async () => {
    const res = await request(app)
      .get("/api/reports/export/csv?from=2025-01-01&to=2025-12-31")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/csv/);
  });
});

// ──────────────────────────────────────────────
// GET /api/reports/export/pdf
// ──────────────────────────────────────────────
describe("GET /api/reports/export/pdf", () => {
  test("returns 200 with PDF content-type", async () => {
    const res = await request(app)
      .get("/api/reports/export/pdf")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toMatch(/application\/pdf/);
  });

  test("response has correct filename in content-disposition", async () => {
    const res = await request(app)
      .get("/api/reports/export/pdf")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.headers["content-disposition"]).toMatch(
      /attendance_report\.pdf/
    );
  });
});
