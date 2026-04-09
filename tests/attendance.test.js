const request = require("supertest");
const app = require("../app");

let adminToken;

// Login once before all tests and store the token
beforeAll(async () => {
  const res = await request(app)
    .post("/api/auth/login")
    .send({ username: "admin", password: process.env.ADMIN_DEFAULT_PASSWORD });

  adminToken = res.body.token;
});

// ──────────────────────────────────────────────
// Auth guard — all protected routes must reject requests without a token
// ──────────────────────────────────────────────
describe("Auth guard on attendance routes", () => {
  const protectedRoutes = [
    { method: "get",  path: "/api/attendance/status" },
    { method: "get",  path: "/api/attendance/dashboard" },
    { method: "get",  path: "/api/attendance/records" },
    { method: "post", path: "/api/attendance/clock-in" },
    { method: "post", path: "/api/attendance/clock-out" },
    { method: "post", path: "/api/attendance/manual-entry" },
    { method: "put",  path: "/api/attendance/update" },
  ];

  protectedRoutes.forEach(({ method, path }) => {
    test(`${method.toUpperCase()} ${path} returns 401 without token`, async () => {
      const res = await request(app)[method](path);
      expect(res.statusCode).toBe(401);
    });
  });
});

// ──────────────────────────────────────────────
// GET /api/attendance/status
// ──────────────────────────────────────────────
describe("GET /api/attendance/status", () => {
  test("returns 200 and an array", async () => {
    const res = await request(app)
      .get("/api/attendance/status")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test("each item has id and status fields", async () => {
    const res = await request(app)
      .get("/api/attendance/status")
      .set("Authorization", `Bearer ${adminToken}`);

    if (res.body.length > 0) {
      expect(res.body[0]).toHaveProperty("id");
      expect(res.body[0]).toHaveProperty("status");
      expect(["Clocked In", "Clocked Out"]).toContain(res.body[0].status);
    }
  });
});

// ──────────────────────────────────────────────
// GET /api/attendance/dashboard
// ──────────────────────────────────────────────
describe("GET /api/attendance/dashboard", () => {
  test("returns 200 and an array", async () => {
    const res = await request(app)
      .get("/api/attendance/dashboard")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test("each item has id, first_name, last_name, attendance_status", async () => {
    const res = await request(app)
      .get("/api/attendance/dashboard")
      .set("Authorization", `Bearer ${adminToken}`);

    if (res.body.length > 0) {
      const item = res.body[0];
      expect(item).toHaveProperty("id");
      expect(item).toHaveProperty("first_name");
      expect(item).toHaveProperty("last_name");
      expect(item).toHaveProperty("attendance_status");
      expect(["Clocked In", "Clocked Out", "Not Clocked In"]).toContain(
        item.attendance_status
      );
    }
  });
});

// ──────────────────────────────────────────────
// GET /api/attendance/records
// ──────────────────────────────────────────────
describe("GET /api/attendance/records", () => {
  test("returns 200 with date and items for today", async () => {
    const res = await request(app)
      .get("/api/attendance/records")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("date");
    expect(res.body).toHaveProperty("items");
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  test("returns 200 with a specific date query", async () => {
    const res = await request(app)
      .get("/api/attendance/records?date=2025-01-01")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("date");
    expect(Array.isArray(res.body.items)).toBe(true);
  });
});

// ──────────────────────────────────────────────
// POST /api/attendance/clock-in  (validation only)
// ──────────────────────────────────────────────
describe("POST /api/attendance/clock-in", () => {
  test("returns 400 when employeeId is missing", async () => {
    const res = await request(app)
      .post("/api/attendance/clock-in")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ pin: "1234" });

    expect(res.statusCode).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  test("returns 400 when pin is missing", async () => {
    const res = await request(app)
      .post("/api/attendance/clock-in")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ employeeId: 1 });

    expect(res.statusCode).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  test("returns 404 for a non-existent employee", async () => {
    const res = await request(app)
      .post("/api/attendance/clock-in")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ employeeId: 999999, pin: "0000" });

    expect(res.statusCode).toBe(404);
    expect(res.body.error).toBe("Employee not found");
  });
});

// ──────────────────────────────────────────────
// POST /api/attendance/clock-out  (validation only)
// ──────────────────────────────────────────────
describe("POST /api/attendance/clock-out", () => {
  test("returns 400 when employeeId is missing", async () => {
    const res = await request(app)
      .post("/api/attendance/clock-out")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ pin: "1234" });

    expect(res.statusCode).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  test("returns 404 for a non-existent employee", async () => {
    const res = await request(app)
      .post("/api/attendance/clock-out")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ employeeId: 999999, pin: "0000" });

    expect(res.statusCode).toBe(404);
    expect(res.body.error).toBe("Employee not found");
  });
});

// ──────────────────────────────────────────────
// POST /api/attendance/manual-entry  (admin only)
// ──────────────────────────────────────────────
describe("POST /api/attendance/manual-entry", () => {
  test("returns 400 when employeeId is missing", async () => {
    const res = await request(app)
      .post("/api/attendance/manual-entry")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ clock_in: "2025-01-01T09:00:00" });

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe("employeeId is required");
  });

  test("returns 404 for non-existent employee", async () => {
    const res = await request(app)
      .post("/api/attendance/manual-entry")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ employeeId: 999999, clock_in: "2025-01-01T09:00:00" });

    expect(res.statusCode).toBe(404);
    expect(res.body.error).toBe("Employee not found");
  });
});

// ──────────────────────────────────────────────
// PUT /api/attendance/update
// ──────────────────────────────────────────────
describe("PUT /api/attendance/update", () => {
  test("returns 400 when attendanceId is missing", async () => {
    const res = await request(app)
      .put("/api/attendance/update")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ clock_in: "2025-01-01T09:00:00" });

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe("attendanceId is required");
  });

  test("returns 404 for non-existent attendance record", async () => {
    const res = await request(app)
      .put("/api/attendance/update")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ attendanceId: 999999, clock_in: "2025-01-01T09:00:00" });

    expect(res.statusCode).toBe(404);
    expect(res.body.error).toBe("Attendance record not found");
  });
});
