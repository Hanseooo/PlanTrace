import { expect, test, type Page } from "@playwright/test";

// The demo journey (J1 to J9, docs/specs/plantrace-spec.md). Later tickets add
// their steps here rather than new files (AGENTS.md "Testing").

function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(err.message));
  return errors;
}

async function expectShell(page: Page) {
  const nav = page.getByRole("navigation", { name: "Main" });
  await expect(nav.getByRole("link", { name: "Plans" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Findings" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "CCC matrix" })).toBeVisible();
  await expect(page.getByText("Synthetic demo data")).toBeVisible();
}

test("demo journey: every screen shows the nav and the synthetic label", async ({
  page,
}) => {
  const consoleErrors = collectConsoleErrors(page);

  // J1: opening the app lands on the plans list.
  await page.goto("/");
  await expect(page).toHaveURL(/\/plans$/);
  await expect(page.getByRole("heading", { name: "Plans" })).toBeVisible();
  await expectShell(page);

  // J2-J3: a plan's PPA table, with an in-app way back to the plans list.
  await page.goto("/plans/1");
  await expect(page.getByRole("heading", { name: "PPA table" })).toBeVisible();
  await expectShell(page);
  await page.getByRole("link", { name: "Back to plans" }).click();
  await expect(page).toHaveURL(/\/plans$/);

  // J4-J7: findings, reached through the nav.
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Findings" }).click();
  await expect(page.getByRole("heading", { name: "Findings" })).toBeVisible();
  await expectShell(page);

  // J8-J9: the CCC matrix, reached through the nav.
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "CCC matrix" }).click();
  await expect(page.getByRole("heading", { name: "CCC matrix" })).toBeVisible();
  await expectShell(page);

  expect(consoleErrors).toEqual([]);
});
