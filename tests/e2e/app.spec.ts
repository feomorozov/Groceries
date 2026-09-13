import { expect, test } from "@playwright/test";

test.skip(process.env.RUN_E2E !== "1", "Set RUN_E2E=1 to run tests against a dedicated Supabase test project.");

async function cleanupTestTrips(page: import("@playwright/test").Page) {
  const testTrips = page.locator(".trip").filter({ hasText: /Test Market|Image Test/ });
  while (await testTrips.count()) {
    await testTrips.first().click();
    await page.getByRole("button", { name: "Delete receipt" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete receipt" }).click();
    await expect(page).toHaveURL("http://localhost:3000/");
  }
}

test("manual receipt can be created, edited, and deleted", async ({ page }, testInfo) => {
  page.on("pageerror", (error) => console.error("Browser error:", error.message));
  await page.goto("/");
  await cleanupTestTrips(page);
  await page.getByRole("link", { name: "Add receipt" }).click();
  await page.getByLabel("Kevin").check();
  await page.getByRole("button", { name: "Enter manually" }).click();
  await page.getByLabel("Store").fill("Test Market");
  await page.getByLabel("Item name").fill("Apples");
  await page.getByLabel("Apples amount").fill("10.00");
  await page.getByLabel("Apples amount").blur();
  await page.getByLabel("Receipt total").fill("10.00");
  await page.getByLabel("Receipt total").blur();
  await page.getByRole("button", { name: "Reconcile" }).click();
  await Promise.all([page.waitForURL(/\/receipts\/[0-9a-f-]{36}$/), page.getByRole("button", { name: "Save receipt" }).click()]);
  await Promise.all([page.waitForURL("http://localhost:3000/"), page.getByRole("link", { name: "Back to groceries" }).click()]);
  await page.reload();
  await expect(page.locator(".trip").filter({ hasText: "Test Market" })).toBeVisible();
  const initialBalance = testInfo.project.name === "mobile" ? page.locator(".mobile-pair").filter({ hasText: "Michael → Kevin" }) : page.locator(".pair-value").filter({ hasText: "Michael owes Kevin" });
  await expect(initialBalance).toBeVisible();
  await page.locator(".trip").filter({ hasText: "Test Market" }).click();
  await page.getByLabel("Receipt total").fill("8.00"); await page.getByLabel("Receipt total").blur();
  await page.getByLabel("Apples amount").fill("8.00"); await page.getByLabel("Apples amount").blur();
  await page.getByRole("button", { name: "Reconcile" }).click();
  await Promise.all([page.waitForResponse((response) => response.request().method() === "PUT" && response.url().includes("/api/receipts/")), page.getByRole("button", { name: "Save receipt" }).click()]);
  await Promise.all([page.waitForURL("http://localhost:3000/"), page.getByRole("link", { name: "Back to groceries" }).click()]);
  const editedBalance = testInfo.project.name === "mobile" ? page.locator(".mobile-pair").filter({ hasText: "Michael → Kevin" }) : page.locator(".pair-value").filter({ hasText: "Michael owes Kevin" });
  await expect(editedBalance.getByText("$2.00", { exact:true })).toBeVisible();
  await page.locator(".trip").filter({ hasText: "Test Market" }).click();
  await page.getByRole("button", { name: "Delete receipt" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete receipt" }).click();
  await expect(page).toHaveURL("http://localhost:3000/");
  await expect(page.getByText("No grocery trips yet.")).toBeVisible();
});

test("responsive balance views switch at the mobile breakpoint", async ({ page }, testInfo) => {
  await page.goto("/");
  if (testInfo.project.name === "mobile") {
    await expect(page.locator(".mobile-pairs")).toBeVisible(); await expect(page.locator(".pair-table")).toBeHidden();
  } else {
    await expect(page.locator(".pair-table")).toBeVisible(); await expect(page.locator(".mobile-pairs")).toBeHidden();
  }
});

test("receipt image persists and extraction failure keeps manual entry available", async ({ page }) => {
  await page.goto("/"); await cleanupTestTrips(page); await page.goto("/receipts/new");
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
  await page.locator('input[type="file"]').setInputFiles({ name: "receipt.png", mimeType: "image/png", buffer: png });
  await expect(page.getByAltText("Selected receipt preview")).toBeVisible();
  await page.getByLabel("Michael").check();
  await page.getByRole("button", { name: "Read receipt" }).click();
  await expect(page.locator(".error")).toContainText("isn't configured");
  await page.getByRole("button", { name: "Enter manually" }).click();
  await page.getByLabel("Store").fill("Image Test"); await page.getByLabel("Item name").fill("Milk");
  await page.getByLabel("Milk amount").fill("1.00"); await page.getByLabel("Milk amount").blur();
  await page.getByLabel("Receipt total").fill("1.00"); await page.getByLabel("Receipt total").blur();
  await page.getByRole("button", { name: "Reconcile" }).click();
  await Promise.all([page.waitForURL(/\/receipts\/[0-9a-f-]{36}$/), page.getByRole("button", { name: "Save receipt" }).click()]);
  await page.reload();
  await page.getByText("View original receipt").click();
  await expect.poll(() => page.getByAltText("Uploaded receipt").evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(1);
  await page.getByRole("button", { name: "Delete receipt" }).click(); await page.getByRole("dialog").getByRole("button", { name: "Delete receipt" }).click();
  await expect(page).toHaveURL("http://localhost:3000/");
});
