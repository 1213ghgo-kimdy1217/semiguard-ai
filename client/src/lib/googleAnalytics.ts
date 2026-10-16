export const GA_ID = "G-QRC8S79SK3"; // Public measurement ID, not a credential.
export const GA_ORIGIN = "https://semiguard-ai-five.vercel.app";
export const GA_CONSENT_KEY = "semiguard:google-analytics-consent:v1";
export const GA_CONSENT_DAYS = 30;
export type AnalyticsConsent = { enabled: boolean; qa: boolean; expires: number };
const off: AnalyticsConsent = { enabled: false, qa: false, expires: 0 };

export function parseAnalyticsConsent(raw: string | null, now = Date.now()): AnalyticsConsent {
  try {
    const value = JSON.parse(raw ?? "null");
    return value?.enabled === true && typeof value.qa === "boolean"
      && Number.isFinite(value.expires) && value.expires > now
      && value.expires <= now + GA_CONSENT_DAYS * 86400000
      ? { enabled: true, qa: value.qa, expires: value.expires } : off;
  } catch { return off; }
}

/** Never accept record IDs, share tokens, callback paths, query text or titles. */
export function analyticsPage(path: string) {
  const clean = path.split(/[?#]/)[0];
  if (["/", "/welcome", "/login", "/signup", "/preview", "/learn", "/training", "/training/etch", "/live", "/dashboard", "/dashboard/legacy", "/dashboard/simulation"].includes(clean)) return clean;
  return /^\/training\/process\/(wafer|oxidation|photo|etch|deposition|metal|eds|packaging)$/.test(clean) ? clean : null;
}

/** Override all automatic campaign fields, accepting only published fixed tags. */
export function analyticsCampaign(search: string) {
  const p = new URLSearchParams(search);
  const source = p.get("utm_source");
  const medium = p.get("utm_medium");
  return {
    campaign_source: ["school", "instagram", "youtube", "naver_blog"].includes(source ?? "") ? source! : "direct",
    campaign_medium: ["direct", "social", "video", "blog"].includes(medium ?? "") ? medium! : "none",
    campaign_name: p.get("utm_campaign") === "pilot_20261016" ? "pilot_20261016" : "none",
    campaign_id: "none", campaign_term: "none", campaign_content: "none",
  };
}

type Port = {
  isCanonical: () => boolean;
  consent: () => AnalyticsConsent;
  send: (...args: unknown[]) => void;
  load: (onError: () => void) => void;
  disable: (disabled: boolean) => void;
  discardQueue: () => void;
  clearCookies: () => void;
};

/** Small, independently testable boundary; no account, answer or arbitrary payload API. */
export class GoogleAnalyticsController {
  private initialized = false;
  private lastPage: string | null = null;
  private path = "";
  private qa: boolean | null = null;
  private blocked = false;
  constructor(private port: Port, private campaign = analyticsCampaign("")) {}

  stop(clearCookies = false) {
    this.port.disable(true);
    this.port.discardQueue();
    this.initialized = false;
    this.lastPage = null;
    if (clearCookies) this.port.clearCookies();
  }

  block() { this.blocked = true; this.stop(true); }
  allow() { this.blocked = false; }

  sync(path: string) {
    this.path = path;
    const page = analyticsPage(path), consent = this.port.consent();
    if (this.blocked || !this.port.isCanonical() || !consent.enabled || !page) { this.stop(!consent.enabled); return; }
    this.port.disable(false);
    const metadata = { page_location: GA_ORIGIN + page, page_referrer: "", page_title: "SemiGuard AI", ...this.campaign };
    const settings = { ...metadata, send_page_view: false, allow_google_signals: false,
      allow_ad_personalization_signals: false, ignore_referrer: true, cookie_domain: "none",
      cookie_expires: GA_CONSENT_DAYS * 86400, cookie_update: false, cookie_flags: "SameSite=Lax;Secure",
      debug_mode: consent.qa, traffic_type: consent.qa ? "internal" : "external" };
    // Set safe defaults before loading the library, including for its basic session events.
    this.port.send("set", settings);
    if (!this.initialized) {
      this.port.send("consent", "default", { analytics_storage: "granted", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" });
      this.port.send("js", new Date());
      this.port.send("config", GA_ID, settings);
      this.initialized = true;
      this.port.load(() => this.block());
    } else this.port.send("config", GA_ID, { ...settings, update: true });
    if (this.lastPage !== page || this.qa !== consent.qa) {
      this.port.send("event", "page_view", { ...metadata, debug_mode: consent.qa,
        traffic_type: consent.qa ? "internal" : "external", send_to: GA_ID });
      this.lastPage = page;
    }
    this.qa = consent.qa;
  }

  track(kind: "practice_started" | "practice_completed") {
    if (!["practice_started", "practice_completed"].includes(kind)) return;
    const consent = this.port.consent();
    const page = analyticsPage(this.path);
    if (!this.initialized || !this.port.isCanonical() || !consent.enabled || !page
      || !(page === "/training/etch" || page.startsWith("/training/process/") || page === "/training")) return;
    this.port.send("event", kind === "practice_started" ? "sg_practice_start" : "sg_practice_complete", {
      send_to: GA_ID, page_location: GA_ORIGIN + page, page_referrer: "", page_title: "SemiGuard AI",
      debug_mode: consent.qa, traffic_type: consent.qa ? "internal" : "external",
    });
  }
}
