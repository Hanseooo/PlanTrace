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
  await page.getByRole("link", { name: "Back to plans" }).click();
  await expect(page).toHaveURL(/\/plans$/);
  await expect(
    planRows
      .filter({ has: page.getByRole("link", { name: "LCCAP 2026–2030" }) })
      .getByRole("cell", { name: "Ready to confirm", exact: true }),
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
  await expect(
    page.getByRole("cell", { name: "Socialized housing project, Barangay 9" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Back to plans" }).click();
  await expect(page).toHaveURL(/\/plans$/);
  await expect(page.getByRole("heading", { name: "Plans" })).toBeVisible();

  // J4-J7: findings, reached through the nav; J5's drainage duplicate side by side.
  await mainNav(page).getByRole("link", { name: "Findings" }).click();
  await expect(page.getByRole("heading", { name: "Findings" })).toBeVisible();
  await expectShell(page);
  const findingList = page.getByRole("list", { name: "Findings" });
  await expect(findingList.getByRole("button")).toHaveCount(8);
  await findingList
    .getByRole("button", {
      name: /Drainage improvement, Barangay 5 vs Drainage canal upgrading, Barangay 5/,
    })
    .click();
  const detail = page.getByRole("region", { name: "Finding detail" });
  await expect(detail).toContainText("₱12,000,000");
  await expect(detail).toContainText("₱9,500,000");
  await expect(detail).toContainText("Source pages: 22, 32");

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
