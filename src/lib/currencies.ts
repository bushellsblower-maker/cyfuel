/** "standing" follows the currency of the country under the pin. Anything else is an explicit override. */
export const COMPARE_CURRENCIES = [
  "standing",
  "GBP",
  "EUR",
  "USD",
  "AUD",
  "CAD",
  "CHF",
  "JPY",
  "INR",
  "NZD",
  "SEK",
  "NOK",
  "DKK",
  "PLN",
  "CZK",
  "HUF",
  "TRY",
  "BRL",
  "MXN",
  "ZAR",
  "CNY",
  "SGD",
] as const;

export function displayCurrency(choice: string, localCurrency: string | null | undefined): string {
  if (choice !== "standing" && /^[A-Z]{3}$/.test(choice)) return choice;
  if (localCurrency && /^[A-Z]{3}$/.test(localCurrency)) return localCurrency;
  return "EUR";
}
