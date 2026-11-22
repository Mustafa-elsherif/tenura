"""Exercise the dashboard in a real Chromium browser and optionally capture screenshots."""

import argparse
import re
import time
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

VIEWS = {
    "Overview": "Workforce overview",
    "Attrition": "Attrition analysis",
    "Segmentation": "Employee segmentation",
    "Risk explorer": "Retention risk explorer",
    "Recommendations": "Retention recommendations",
    "Model evaluation": "Model evaluation",
}
VIEWPORTS = {"desktop": (1440, 1080), "tablet": (820, 1180), "mobile": (390, 844)}


def select_view(page, name):
    sidebar = page.get_by_test_id("stSidebar")
    radio = sidebar.get_by_text(name, exact=True)
    if (sidebar.count() == 0 or sidebar.get_attribute("data-collapsed") == "true"
            or sidebar.get_attribute("aria-expanded") == "false"):
        page.get_by_test_id("stExpandSidebarButton").click()
    radio.click()
    expect(page.get_by_role("heading", name=VIEWS[name], exact=True)).to_be_visible()
    if page.viewport_size["width"] < 768:
        collapse = sidebar.get_by_test_id("stSidebarCollapseButton").get_by_role("button")
        if collapse.is_visible():
            collapse.click()


def check_geometry(page, label):
    metrics = page.locator("[data-testid=stMetric]").evaluate_all(
        """elements => elements.map(element => {
            const rect = element.getBoundingClientRect();
            const value = element.querySelector('[data-testid=stMetricValue]');
            return {left: rect.left, right: rect.right, width: rect.width,
                    value: value.clientWidth, content: value.scrollWidth};
        })"""
    )
    assert all(rect["left"] >= -2 and rect["right"] <= page.viewport_size["width"] + 2
               and rect["content"] <= rect["value"] + 2 for rect in metrics), (label, metrics)
    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth + 2"), label


def exercise(browser, url, label, dimensions, screenshots):
    width, height = dimensions
    page = browser.new_page(viewport={"width": width, "height": height},
                            device_scale_factor=1, is_mobile=label == "mobile", has_touch=label == "mobile")
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    start = time.perf_counter()
    page.goto(url, wait_until="domcontentloaded", timeout=90000)
    expect(page.get_by_text("1,470", exact=True).first).to_be_visible(timeout=180000)
    expect(page.get_by_test_id("stPlotlyChart").first).to_be_visible(timeout=60000)
    print(f"{label}: first overview chart in {time.perf_counter() - start:.2f}s", flush=True)
    for index, (name, heading) in enumerate(VIEWS.items()):
        if index:
            select_view(page, name)
        expect(page.get_by_role("heading", name=heading, exact=True)).to_be_visible()
        expect(page.get_by_test_id("stPlotlyChart").first).to_be_visible()
        assert not page.get_by_test_id("stException").count(), (label, name)
        check_geometry(page, f"{label}/{name}")
        if screenshots and name == "Overview" and label in {"desktop", "mobile"}:
            page.screenshot(path=screenshots / f"overview-{label}.png", animations="disabled")
        if screenshots and name == "Attrition" and label == "desktop":
            page.screenshot(path=screenshots / "attrition-desktop.png", animations="disabled")
        if name == "Risk explorer":
            slider = page.get_by_role("slider", name="High-risk threshold")
            slider.focus()
            slider.press("End")
            expect(page.get_by_text(re.compile("No records meet this threshold"))).to_be_visible()
        if name == "Recommendations":
            page.get_by_text("Overtime policy", exact=True).click()
            expect(page.get_by_text("Review a proposed overtime cap", exact=False)).to_be_visible()
    assert not errors, errors
    page.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("url")
    parser.add_argument("--viewport", choices=VIEWPORTS, action="append")
    parser.add_argument("--screenshots", type=Path)
    parser.add_argument("--channel", choices=["chrome", "msedge", "chromium"])
    args = parser.parse_args()
    if args.screenshots:
        args.screenshots.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(channel=args.channel, headless=True)
        for label in args.viewport or VIEWPORTS:
            exercise(browser, args.url, label, VIEWPORTS[label], args.screenshots)
        browser.close()
    print("Browser checks passed.")


if __name__ == "__main__":
    main()
