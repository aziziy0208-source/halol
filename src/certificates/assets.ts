/**
 * Pseudo origin under which the PDF renderer serves the template assets
 * (fonts, logo from public/certificate). Kept separate from renderer.ts so that
 * code which only builds HTML never loads Playwright.
 */
export const ASSET_ORIGIN = "https://certificate-assets.local";
