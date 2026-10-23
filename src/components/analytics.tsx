import Script from "next/script";

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

// There is no consent banner, so visitors from the EEA, the UK and Switzerland are measured without cookies.
const CONSENT_REGIONS = [
  "AT",
  "BE",
  "BG",
  "HR",
  "CY",
  "CZ",
  "DK",
  "EE",
  "FI",
  "FR",
  "DE",
  "GR",
  "HU",
  "IS",
  "IE",
  "IT",
  "LV",
  "LI",
  "LT",
  "LU",
  "MT",
  "NL",
  "NO",
  "PL",
  "PT",
  "RO",
  "SK",
  "SI",
  "ES",
  "SE",
  "GB",
  "CH",
];

export function Analytics() {
  if (!GA_ID) return null;
  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
const denied = { ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" };
gtag("consent", "default", { ...denied, analytics_storage: "denied", region: ${JSON.stringify(CONSENT_REGIONS)} });
gtag("consent", "default", { ...denied, analytics_storage: "granted" });
gtag("js", new Date());
gtag("config", "${GA_ID}");`}
      </Script>
    </>
  );
}
