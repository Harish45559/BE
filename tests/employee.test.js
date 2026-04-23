const request = require("supertest");
const app = require("../app");

let adminToken;
let employeeToken; // non-admin token for role tests
let createdEmployeeId; // shared between create → edit → delete tests

const testEmployee = {
  first_name: "Test",
  last_name: "User",
  username: `testuser_${Date.now()}`,       // unique to avoid duplicate conflicts
  email: `testuser_${Date.now()}@test.com`, // unique to avoid duplicate conflicts
  password: "password123",
  phone: "07700900123",
  address: "123 Test Street",
  gender: "Male",
  dob: "1990-01-01",
  joining_date: "2023-01-01",
  brp: "ABC123456",
  pin: "1234",
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
describe("Auth guard on employee routes", () => {
  test("GET /api/employees returns 401 without token", async () => {
    const res = await request(app).get("/api/employees");
    expect(res.statusCode).toBe(401);
  });

  test("POST /api/employees returns 401 without token", async () => {
    const res = await request(app).post("/api/employees");
    expect(res.statusCode).toBe(401);
  });

  test("PUT /api/employees/1 returns 401 without token", async () => {
    const res = await request(app).put("/api/employees/1");
    expect(res.statusCode).toBe(401);
  });

  test("DELETE /api/employees/1 returns 401 without token", async () => {
    const res = await request(app).delete("/api/employees/1");
    expect(res.statusCode).toBe(401);
  });

  test("GET /api/employees/me returns 401 without token", async () => {
    const res = await request(app).get("/api/employees/me");
    expect(res.statusCode).toBe(401);
  });
});

// ──────────────────────────────────────────────
// GET /api/employees/me
// ──────────────────────────────────────────────
describe("GET /api/employees/me", () => {
  test("returns 200 and logged-in user profile", async () => {
    const res = await request(app)
      .get("/api/employees/me")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("username");
  });

  test("response does not include password or pin", async () => {
    const res = await request(app)
      .get("/api/employees/me")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body).not.toHaveProperty("password");
    expect(res.body).not.toHaveProperty("pin");
  });
});

// ──────────────────────────────────────────────
// GET /api/employees
// ──────────────────────────────────────────────
describe("GET /api/employees", () => {
  test("returns 200 and an array", async () => {
    const res = await request(app)
      .get("/api/employees")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test("response does not include password or pin", async () => {
    const res = await request(app)
      .get("/api/employees")
      .set("Authorization", `Bearer ${adminToken}`);

    if (res.body.length > 0) {
      expect(res.body[0]).not.toHaveProperty("password");
      expect(res.body[0]).not.toHaveProperty("pin");
    }
  });
});

// ──────────────────────────────────────────────
// POST /api/employees — validation errors
// ──────────────────────────────────────────────
describe("POST /api/employees — validation", () => {
  test("returns 400 when required fields are missing", async () => {
    const res = await request(app)
      .post("/api/employees")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({});

    expect(res.statusCode).toBe(400);
    expect(res.body).toHaveProperty("errors");
    expect(res.body.errors).toHaveProperty("first_name");
    expect(res.body.errors).toHaveProperty("username");
    expect(res.body.errors).toHaveProperty("email");
  });

  test("returns 400 for invalid email format", async () => {
    const res = await request(app)
      .post("/api/employees")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ ...testEmployee, email: "not-an-email" });

    expect(res.statusCode).toBe(400);
    expect(res.body.errors).toHaveProperty("email");
  });

  test("returns 400 for invalid PIN (not 4 digits)", async () => {
    const res = await request(app)
      .post("/api/employees")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ ...testEmployee, pin: "12" });

    expect(res.statusCode).toBe(400);
    expect(res.body.errors).toHaveProperty("pin");
  });

  test("returns 400 for future joining_date", async () => {
    const res = await request(app)
      .post("/api/employees")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ ...testEmployee, joining_date: "2099-01-01" });

    expect(res.statusCode).toBe(400);
    expect(res.body.errors).toHaveProperty("joining_date");
  });

  test("returns 400 for short password (under 6 chars)", async () => {
    const res = await request(app)
      .post("/api/employees")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ ...testEmployee, password: "abc" });

    expect(res.statusCode).toBe(400);
    expect(res.body.errors).toHaveProperty("password");
  });
});

// ──────────────────────────────────────────────
// POST /api/employees — happy path (creates employee used by edit + delete below)
// ──────────────────────────────────────────────
describe("POST /api/employees — create", () => {
  test("returns 201 and employee object (without password/pin)", async () => {
    const res = await request(app)
      .post("/api/employees")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(testEmployee);

    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty("message", "Employee added successfully");
    expect(res.body.employee).toHaveProperty("id");
    expect(res.body.employee).not.toHaveProperty("password");
    expect(res.body.employee).not.toHaveProperty("pin");

    createdEmployeeId = res.body.employee.id; // save for next tests

    // Login as the new employee to get a non-admin token
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ username: testEmployee.username, password: testEmployee.password });
    employeeToken = loginRes.body.token;
  });

  test("returns 400 when email already exists", async () => {
    const res = await request(app)
      .post("/api/employees")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(testEmployee); // same email as above

    expect(res.statusCode).toBe(400);
    expect(res.body.errors).toHaveProperty("email");
  });
});

// ──────────────────────────────────────────────
// PUT /api/employees/:id
// ──────────────────────────────────────────────
describe("PUT /api/employees/:id", () => {
  test("returns 404 for non-existent employee", async () => {
    const res = await request(app)
      .put("/api/employees/999999")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ first_name: "Ghost" });

    expect(res.statusCode).toBe(404);
    expect(res.body.error).toBe("Employee not found");
  });

  test("returns 400 for invalid PIN in edit", async () => {
    const res = await request(app)
      .put(`/api/employees/${createdEmployeeId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ pin: "99" }); // not 4 digits

    expect(res.statusCode).toBe(400);
    expect(res.body.errors).toHaveProperty("pin");
  });

  test("returns 200 and updates employee successfully", async () => {
    const res = await request(app)
      .put(`/api/employees/${createdEmployeeId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ first_name: "Updated" });

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("message", "Employee updated successfully");
    expect(res.body.employee.first_name).toBe("Updated");
    expect(res.body.employee).not.toHaveProperty("password");
    expect(res.body.employee).not.toHaveProperty("pin");
  });
});

// ──────────────────────────────────────────────
// requireAdmin — 403 for non-admin role
// ──────────────────────────────────────────────
describe("requireAdmin — employee role gets 403", () => {
  test("GET /api/employees returns 403 for employee role", async () => {
    const res = await request(app)
      .get("/api/employees")
      .set("Authorization", `Bearer ${employeeToken}`);

    expect(res.statusCode).toBe(403);
    expect(res.body.message).toBe("Admin only");
  });

  test("POST /api/employees returns 403 for employee role", async () => {
    const res = await request(app)
      .post("/api/employees")
      .set("Authorization", `Bearer ${employeeToken}`)
      .send(testEmployee);

    expect(res.statusCode).toBe(403);
    expect(res.body.message).toBe("Admin only");
  });

  test("DELETE /api/employees/:id returns 403 for employee role", async () => {
    const res = await request(app)
      .delete(`/api/employees/${createdEmployeeId}`)
      .set("Authorization", `Bearer ${employeeToken}`);

    expect(res.statusCode).toBe(403);
    expect(res.body.message).toBe("Admin only");
  });
});

// ──────────────────────────────────────────────
// DELETE /api/employees/:id
// ──────────────────────────────────────────────
describe("DELETE /api/employees/:id", () => {
  test("returns 404 for non-existent employee", async () => {
    const res = await request(app)
      .delete("/api/employees/999999")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(404);
    expect(res.body.error).toBe("Employee not found");
  });

  test("returns 200 and deletes the test employee (cleanup)", async () => {
    const res = await request(app)
      .delete(`/api/employees/${createdEmployeeId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe("Employee deleted successfully");
  });
});
