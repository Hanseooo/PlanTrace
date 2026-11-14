import path from "node:path";
import { expect, test, type Page, type Route } from "@playwright/test";

// The demo journey (J1 to J9, docs/specs/plantrace-spec.md). Later tickets add
// their steps here rather than new files (AGENTS.md "Testing").
// J1's plans come from the seeded database (S1-11); later steps' values are still
// from seed/fixtures/, which the other endpoints serve until their slices land.

function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(err.message));
  return errors;
}

const mainNav = (page: Page) =>
  page.getByRole("banner").getByRole("navigation", { name: "Main" });

// The nav and the label come from the root layout's header.
async function expectShell(page: Page) {
  for (const name of ["Plans", "Findings", "CCC matrix"]) {
    await expect(mainNav(page).getByRole("link", { name })).toBeVisible();
  }
  await expect(
    page.getByRole("banner").getByText("Synthetic demo data"),
  ).toBeVisible();
}

test("demo journey: every screen shows the nav, the label, its data and its states", async ({
  page,
  baseURL,
}) => {
  const consoleErrors = collectConsoleErrors(page);

  // J1: opening the app lands on the plans list with the 4 seeded plans, each
  // confirmed, under the synthetic label (expectShell).
  await page.goto("/");
  await expect(page).toHaveURL(/\/plans$/);
  await expect(page.getByRole("heading", { name: "Plans" })).toBeVisible();
  await expectShell(page);
  const planRows = page.getByRole("table").getByRole("row");
  // The header row plus one row per plan.
  await expect(planRows).toHaveCount(5);
  for (const title of [
    "City of Sampaguita Comprehensive Land Use Plan 2023-2031",
    "City of Sampaguita Comprehensive Development Plan 2026-2031",
    "City of Sampaguita Local DRRM Plan 2026-2028",
    "City of Sampaguita Annual Investment Program 2027",
  ]) {
    await expect(
      planRows
        .filter({ has: page.getByRole("link", { name: title, exact: true }) })
        .getByRole("cell", { name: "Confirmed", exact: true }),
    ).toBeVisible();
  }
  await expect(
    page.getByRole("button", { name: "Upload", exact: true }),
  ).toBeDisabled();

  // J2: upload the LCCAP; the plan page shows its status, then the draft table.
  // CI primes the cached extraction (app.extract.load_cache), so no model is called.
  const upload = page.getByRole("form", { name: "Upload a plan" });
  await upload
    .getByLabel("PDF file")
    .setInputFiles(path.join(process.cwd(), "..", "seed", "pdfs", "lccap.pdf"));
  await upload.getByLabel("Plan type").selectOption("LCCAP");
  await upload.getByLabel("Start year").fill("2026");
  await upload.getByLabel("End year").fill("2030");
  await upload.getByRole("button", { name: "Upload", exact: true }).click();
  await expect(page).toHaveURL(/\/plans\/\d+$/);
  await expect(page.getByText("LCCAP 2026–2030")).toBeVisible();
  await expect(page.getByText("Ready to confirm")).toBeVisible({
    timeout: 30_000,
  });
  // The header row plus the 3 draft PPAs.
  await expect(page.getByRole("table").getByRole("row")).toHaveCount(4);
  // J3 source panel (S3-12): a row's "p. N" opens its page beside the table;
  // Escape closes it and focus goes back to the button. The cache puts all 3
  // LCCAP rows on page 2.
  const sourceButton = page
    .getByRole("row", { name: /LCCAP-01/ })
    .getByRole("button", { name: "Source page 2" });
  await expect(sourceButton).toHaveText("p. 2");
  await sourceButton.click();
  const panel = page.getByRole("complementary", { name: "Source page" });
  await expect(panel.getByRole("heading", { name: "Page 2" })).toBeVisible();
  await expect(panel).toContainText("LCCAP-01");
  await expect(panel).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
  await expect(sourceButton).toBeFocused();
  // J3 edit (S3-09 to S3-11): a wrong cost stays in the cell and Escape restores
  // it without a request; an office edit saves on Enter and survives a reload.
  let patches = 0;
  page.on("request", (r) => {
    if (r.method() === "PATCH") patches += 1;
  });
  const cost = page.getByRole("button", { name: "Cost for LCCAP-01" });
  await expect(cost).toHaveText("₱3,000,000");
  await cost.click();
  const costInput = page.getByRole("textbox", { name: "Cost for LCCAP-01" });
  await expect(costInput).toBeFocused();
  await costInput.fill("-1");
  await costInput.press("Enter");
  await expect(
    page.getByRole("alert").filter({ hasText: "Cost can't be below 0" }),
  ).toBeVisible();
  await costInput.press("Escape");
  await expect(cost).toHaveText("₱3,000,000");
  await expect(cost).toBeFocused();
  const office = page.getByRole("button", { name: "Office for LCCAP-01" });
  await office.click();
  const officeInput = page.getByRole("textbox", {
    name: "Office for LCCAP-01",
  });
  await expect(officeInput).toBeFocused();
  await officeInput.fill("City Environment Office");
  const saved = page.waitForResponse(
    (r) => r.request().method() === "PATCH" && r.url().includes("/ppas/"),
  );
  await officeInput.press("Enter");
  expect((await saved).ok()).toBe(true);
  await expect(office).toHaveText("City Environment Office");
  expect(patches).toBe(1);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Office for LCCAP-01" }),
  ).toHaveText("City Environment Office");
  // Barangay cells show names, not PSGC codes.
  await expect(
    page.getByRole("button", { name: "Barangays for LCCAP-03" }),
  ).toHaveText("Barangay 10, Barangay 11");
  // J3 add and delete (S3-13, S3-14): Add row opens the new row's first editor;
  // Delete asks first, Cancel keeps the row and returns focus, Delete removes it.
  const ppaRows = page.getByRole("table").getByRole("row");
  await page.getByRole("button", { name: "Add row" }).click();
  await expect(
    page.getByRole("textbox", { name: "Code for row 4" }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(ppaRows).toHaveCount(5);
  const deleteRow = page.getByRole("button", { name: "Delete PPA row 4" });
  await deleteRow.click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText("Delete PPA row 4? This can't be undone.");
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();
  await expect(deleteRow).toBeFocused();
  await deleteRow.click();
  await dialog.getByRole("button", { name: "Delete" }).click();
  await expect(dialog).toBeHidden();
  await expect(ppaRows).toHaveCount(4);
  // J3 confirm (S3-15): the badge replaces the button and the rows are confirmed.
  await page.getByRole("button", { name: "Confirm plan" }).click();
  await expect(page.getByText("Confirmed", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirm plan" })).toHaveCount(
    0,
  );
  await expect(
    page
      .getByRole("row", { name: /LCCAP-01/ })
      .getByRole("cell", { name: "confirmed", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Back to plans" }).click();
  await expect(page).toHaveURL(/\/plans$/);
  await expect(
    planRows
      .filter({ has: page.getByRole("link", { name: "LCCAP 2026–2030" }) })
      .getByRole("cell", { name: "Confirmed", exact: true }),
  ).toBeVisible();

  // J3: a confirmed plan's PPA table, with an in-app way back to the plans list.
  await page
    .getByRole("link", {
      name: "City of Sampaguita Comprehensive Development Plan 2026-2031",
    })
    .click();
  await expect(page).toHaveURL(/\/plans\/2$/);
  await expect(page.getByRole("heading", { name: "PPA table" })).toBeVisible();
  await expectShell(page);
  // A confirmed plan shows only the badge (S3-15).
  await expect(page.getByText("Confirmed", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirm plan" })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("button", { name: /^Title for / }).filter({
      hasText: "Socialized housing project, Barangay 9",
    }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Back to plans" }).click();
  await expect(page).toHaveURL(/\/plans$/);
  await expect(page.getByRole("heading", { name: "Plans" })).toBeVisible();

  // J4-J7 (S4): findings, reached through the nav. Before any run, the screen says so.
  // Accepting a parent changes later runs, so these steps stay before the CCC step.
  await mainNav(page).getByRole("link", { name: "Findings" }).click();
  await expect(page.getByRole("heading", { name: "Findings" })).toBeVisible();
  await expectShell(page);
  await expect(page.getByText("Checks haven't been run yet.")).toBeVisible();
  // J4: Run checks, disabled while the run is in flight. The run is held so the
  // in-flight state can be seen.
  let releaseRun!: () => void;
  const runHeld = new Promise<void>((resolve) => (releaseRun = resolve));
  const isRun = (url: URL) => url.pathname === "/checks/run";
  await page.route(isRun, async (route) => {
    await runHeld;
    await route.continue();
  });
  await page.getByRole("button", { name: "Run checks" }).click();
  await expect(
    page.getByRole("button", { name: "Running checks…" }),
  ).toBeDisabled();
  releaseRun();
  await expect(page.getByRole("button", { name: "Run checks" })).toBeEnabled();
  await page.unroute(isRun);
  await expect(page.getByText(/^Last run /)).toBeVisible();
  // J3 confirmed the LCCAP, so: 3 duplicates, 2 orphans, 1 zone. 8 after S5 adds CCC.
  const findingList = page.getByRole("region", { name: "Findings list" });
  await expect(findingList.getByRole("button")).toHaveCount(6);

  // J5: the drainage duplicate side by side, its sources, and the reject dialog.
  await findingList
    .getByRole("button", {
      name: /Drainage improvement, Barangay 5 vs Drainage improvement works, Barangay 5/,
    })
    .click();
  const detail = page.getByRole("region", { name: "Finding detail" });
  await expect(detail).toContainText("₱12,000,000");
  await expect(detail).toContainText("₱9,500,000");
  await expect(detail).toContainText("₱2,500,000");
  await expect(detail).toContainText("2027 vs 2028");
  const findingSource = detail
    .getByRole("button", { name: /^Source page \d+$/ })
    .first();
  await findingSource.click();
  const findingPanel = page.getByRole("complementary", { name: "Source page" });
  await expect(findingPanel).toContainText(/CDP-02|LDRRMP-01/);
  await page.keyboard.press("Escape");
  await expect(findingPanel).toBeHidden();
  await expect(findingSource).toBeFocused();
  const reject = detail.getByRole("button", { name: "Reject" });
  await reject.click();
  const rejectDialog = page.getByRole("alertdialog", {
    name: "Reject this finding?",
  });
  await expect(rejectDialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(rejectDialog).toBeHidden();
  await expect(reject).toBeFocused();
  await expect(detail).toContainText("AI suggestion");

  // J6: the AIP-04 orphan's suggested parent; Accept parent confirms it.
  await findingList
    .getByRole("button", {
      name: /Upland sitio road concreting → Farm-to-market roads program/,
    })
    .click();
  await expect(detail).toContainText("Suggested parent");
  await expect(detail).toContainText("AI suggestion");
  await expect(detail).toContainText("Farm-to-market roads program");
  await detail.getByRole("button", { name: "Accept parent" }).click();
  await expect(detail.getByText("Confirmed", { exact: true })).toBeVisible();

  // J7 (zone half): the Zone group for Barangay 9.
  await expect(
    findingList
      .getByRole("region", { name: "Zone", exact: true })
      .getByRole("region", { name: "Barangay 9", exact: true }),
  ).toContainText("Socialized housing project, Barangay 9");

  // J8-J9: the CCC matrix, reached through the nav, and its export.
  await mainNav(page).getByRole("link", { name: "CCC matrix" }).click();
  await expect(page.getByRole("heading", { name: "CCC matrix" })).toBeVisible();
  await expectShell(page);
  await expect(
    page.getByRole("cell", {
      name: "Conflict: CDP: Socialized housing project, Barangay 9 × LDRRMP: Evacuation centre, Barangay 9",
    }),
  ).toHaveText("C");
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Export CCC matrix (.xlsx)" }).click();
  expect((await download).suggestedFilename()).toBe("ccc_export.xlsx");

  expect(consoleErrors).toEqual([]);

  // RS-01 states, last because the aborted calls log console errors:
  // hold, then fail, then empty every api call; let the web app's own requests through.
  const webOrigin = new URL(baseURL!).origin;
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  let apiCalls = 0;
  await page.route(
    (url) => url.origin !== webOrigin,
    async (route: Route) => {
      apiCalls += 1;
      if (apiCalls <= 2) {
        // The first call and TanStack Query's one retry.
        await held;
        return route.abort();
      }
      return route.fulfill({
        json: [],
        headers: { "access-control-allow-origin": "*" },
      });
    },
  );

  await page.goto("/plans");
  await expect(page.getByRole("status")).toHaveText("Loading plans…");
  release();
  const alert = page
    .getByRole("alert")
    .filter({ hasText: "Couldn't load plans." });
  await expect(alert).toContainText("Can't reach the PlanTrace API");
  await alert.getByRole("button", { name: "Retry" }).click();
  await expect(page.getByText("No plans yet.")).toBeVisible();
});
