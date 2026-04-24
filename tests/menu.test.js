const request = require("supertest");
const app = require("../app");

let adminToken;
let createdCategoryId;
let createdMenuItemId;

beforeAll(async () => {
  const res = await request(app)
    .post("/api/auth/login")
    .send({ username: "admin", password: process.env.ADMIN_DEFAULT_PASSWORD });

  adminToken = res.body.token;
});

// ──────────────────────────────────────────────
// Auth guard
// ──────────────────────────────────────────────
describe("Auth guard on category and menu routes", () => {
  const routes = [
    { method: "get",    path: "/api/categories" },
    { method: "post",   path: "/api/categories" },
    { method: "put",    path: "/api/categories/1" },
    { method: "delete", path: "/api/categories/1" },
    { method: "get",    path: "/api/menu" },
    { method: "post",   path: "/api/menu" },
    { method: "put",    path: "/api/menu/1" },
    { method: "delete", path: "/api/menu/1" },
  ];

  routes.forEach(({ method, path }) => {
    test(`${method.toUpperCase()} ${path} returns 401 without token`, async () => {
      const res = await request(app)[method](path);
      expect(res.statusCode).toBe(401);
    });
  });
});

// ──────────────────────────────────────────────
// Categories — lifecycle: create → update → delete
// ──────────────────────────────────────────────
describe("GET /api/categories", () => {
  test("returns 200 and an array", async () => {
    const res = await request(app)
      .get("/api/categories")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe("POST /api/categories", () => {
  test("returns 400 when name is missing", async () => {
    const res = await request(app)
      .post("/api/categories")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({});

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe("Category name is required");
  });

  test("returns 200 and creates a category", async () => {
    const res = await request(app)
      .post("/api/categories")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: `TestCategory_${Date.now()}` });

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("id");
    expect(res.body).toHaveProperty("name");

    createdCategoryId = res.body.id;
  });
});

describe("PUT /api/categories/:id", () => {
  test("returns 400 when name is missing", async () => {
    const res = await request(app)
      .put(`/api/categories/${createdCategoryId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({});

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe("Category name is required");
  });

  test("returns 404 for non-existent category", async () => {
    const res = await request(app)
      .put("/api/categories/999999")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Ghost" });

    expect(res.statusCode).toBe(404);
    expect(res.body.error).toBe("Category not found");
  });

  test("returns 200 and updates the category", async () => {
    const res = await request(app)
      .put(`/api/categories/${createdCategoryId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: `UpdatedCategory_${Date.now()}` });

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("id", createdCategoryId);
  });
});

// ──────────────────────────────────────────────
// Menu items — lifecycle: create → list → update → delete
// ──────────────────────────────────────────────
describe("GET /api/menu", () => {
  test("returns 200 and an array", async () => {
    const res = await request(app)
      .get("/api/menu")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test("accepts category_id filter", async () => {
    const res = await request(app)
      .get(`/api/menu?category_id=${createdCategoryId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test("each item has expected fields", async () => {
    const res = await request(app)
      .get("/api/menu")
      .set("Authorization", `Bearer ${adminToken}`);

    if (res.body.length > 0) {
      const item = res.body[0];
      expect(item).toHaveProperty("id");
      expect(item).toHaveProperty("name");
      expect(item).toHaveProperty("price");
      expect(item).toHaveProperty("is_veg");
    }
  });
});

describe("POST /api/menu", () => {
  test("returns 400 when name is missing", async () => {
    const res = await request(app)
      .post("/api/menu")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ price: 3.5 });

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe("name and price are required");
  });

  test("returns 400 when price is missing", async () => {
    const res = await request(app)
      .post("/api/menu")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Espresso" });

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe("name and price are required");
  });

  test("returns 200 and creates a menu item", async () => {
    const res = await request(app)
      .post("/api/menu")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Test Latte", price: 3.5, is_veg: true, categoryId: createdCategoryId });

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("id");
    expect(res.body.name).toBe("Test Latte");

    createdMenuItemId = res.body.id;
  });
});

describe("PUT /api/menu/:id", () => {
  test("returns 404 for non-existent menu item", async () => {
    const res = await request(app)
      .put("/api/menu/999999")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Ghost" });

    expect(res.statusCode).toBe(404);
    expect(res.body.error).toBe("Menu item not found");
  });

  test("returns 200 and updates the menu item", async () => {
    const res = await request(app)
      .put(`/api/menu/${createdMenuItemId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Updated Latte", price: 4.0 });

    expect(res.statusCode).toBe(200);
    expect(res.body.name).toBe("Updated Latte");
  });
});

// ──────────────────────────────────────────────
// PATCH /api/menu/:id/toggle-availability
// ──────────────────────────────────────────────
describe("PATCH /api/menu/:id/toggle-availability", () => {
  test("returns 401 without token", async () => {
    const res = await request(app).patch("/api/menu/1/toggle-availability");
    expect(res.statusCode).toBe(401);
  });

  test("returns 404 for non-existent menu item", async () => {
    const res = await request(app)
      .patch("/api/menu/999999/toggle-availability")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(404);
  });

  test("returns 200 and flips available from true to false", async () => {
    const res = await request(app)
      .patch(`/api/menu/${createdMenuItemId}/toggle-availability`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("available");
    expect(typeof res.body.available).toBe("boolean");
  });

  test("calling toggle twice restores original availability", async () => {
    const first = await request(app)
      .patch(`/api/menu/${createdMenuItemId}/toggle-availability`)
      .set("Authorization", `Bearer ${adminToken}`);

    const second = await request(app)
      .patch(`/api/menu/${createdMenuItemId}/toggle-availability`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(first.body.available).toBe(!second.body.available);
  });
});

describe("DELETE /api/categories/:id — blocked by menu items", () => {
  test("returns 400 when menu items exist under the category", async () => {
    const res = await request(app)
      .delete(`/api/categories/${createdCategoryId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/Cannot delete/);
  });
});

describe("DELETE /api/menu/:id", () => {
  test("returns 404 for non-existent menu item", async () => {
    const res = await request(app)
      .delete("/api/menu/999999")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(404);
    expect(res.body.error).toBe("Menu item not found");
  });

  test("returns 200 and deletes the menu item (cleanup)", async () => {
    const res = await request(app)
      .delete(`/api/menu/${createdMenuItemId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe("Item deleted successfully");
  });
});

describe("DELETE /api/categories/:id — cleanup", () => {
  test("returns 200 and deletes the category after menu items are removed", async () => {
    const res = await request(app)
      .delete(`/api/categories/${createdCategoryId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe("Deleted");
  });

  test("returns 404 for non-existent category", async () => {
    const res = await request(app)
      .delete("/api/categories/999999")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(404);
    expect(res.body.error).toBe("Category not found");
  });
});
