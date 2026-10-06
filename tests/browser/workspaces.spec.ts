import { test, expect, type Page } from "@playwright/test";

async function login(page: Page, role: "admin" | "student") {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(`${role}@edutrack.test`);
  await page.getByLabel("Password", { exact: true }).fill("edutrack123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/${role}$`));
  await expect(
    page.getByRole("heading", { name: /Welcome back/ }),
  ).toBeVisible();
}

test("landing, protected routes, and invalid credentials", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Track Progress.",
  );
  await page.goto("/students");
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("Email", { exact: true }).fill("admin@edutrack.test");
  await page.getByLabel("Password", { exact: true }).fill("invalid-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.locator(".notice.error:visible")).toContainText(
    "Invalid email or password",
  );
});

test("admin workspaces load and forms expose the complete workflows", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await login(page, "admin");
  await expect(
    page.getByText("Active students", { exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "People", exact: true }).click();
  await expect(
    page.getByText("student@edutrack.test", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "+ Add account" }).click();
  await expect(page.getByLabel("Guardian phone (optional)")).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page
    .getByRole("row")
    .filter({ hasText: "student@edutrack.test" })
    .getByRole("button", { name: "Edit", exact: true })
    .click();
  const studentClassId = await page
    .getByRole("combobox", { name: "Class", exact: true })
    .inputValue();
  expect(studentClassId).not.toBe("");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page
    .getByRole("link", { name: "Classes & subjects", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Class directory" }),
  ).toBeVisible();
  await expect(
    page.getByText("Mathematics", { exact: true }).first(),
  ).toBeVisible();
  await page.getByRole("link", { name: "Attendance", exact: true }).click();
  await expect(page).toHaveURL(/\/attendance$/);
  await expect(
    page.getByRole("heading", { name: "Attendance", exact: true, level: 1 }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Class", exact: true })
    .selectOption(studentClassId);
  await expect(
    page.getByRole("combobox", { name: "Class", exact: true }),
  ).toHaveValue(studentClassId);
  await expect(
    page.getByRole("cell", { name: "Sam Student", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Save attendance", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Grades", exact: true }).click();
  await expect(page).toHaveURL(/\/grades$/);
  await page
    .getByRole("combobox", { name: "Student", exact: true })
    .selectOption({ label: "Sam Student | STU-0001" });
  await page.getByRole("button", { name: "+ Add assessment" }).click();
  await expect(page.getByLabel("Total possible")).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("link", { name: "Reports", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Export attendance CSV" }),
  ).toBeEnabled();
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export attendance CSV" }).click();
  expect((await downloadEvent).suggestedFilename()).toMatch(
    /edutrack-attendance-.*\.csv$/,
  );
  await page.getByRole("link", { name: "Announcements", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome to EduTrack" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Notifications", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Guardian email review & delivery history",
    }),
  ).toBeVisible();
  await expect(page.locator(".notice.error:visible")).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("link", { name: "Overview", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(
    page.getByRole("heading", { name: /Welcome back/ }),
  ).toBeVisible();
  await expect(
    page.getByText("Active students", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
  await page.screenshot({
    path: "test-results/admin-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: "test-results/admin-desktop.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

test("student portal is isolated from administration", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await login(page, "student");
  await expect(
    page.getByRole("link", { name: "People", exact: true }),
  ).toHaveCount(0);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/student$/);
  for (const [route, heading] of [
    ["attendance", "Attendance"],
    ["grades", "Grades"],
    ["reports", "Reports & analytics"],
    ["announcements", "Announcements"],
    ["notifications", "Notifications"],
  ] as const) {
    await page.goto(`/${route}`);
    await expect(
      page.getByRole("heading", { name: heading, exact: true, level: 1 }),
    ).toBeVisible();
  }
  await expect(
    page.getByRole("heading", { name: "My inbox", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Guardian email review & delivery history",
    }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Sign out" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Sign out", exact: true })
    .click();
  await expect(page).toHaveURL(/\/$/);
  expect(errors).toEqual([]);
});
