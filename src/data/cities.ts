export type City = {
  name: string;
  country: string;
  lat: number;
  lon: number;
  blurb: string;
};

/** Fallback places when the browser will not share a location. */
export const CITIES: City[] = [
  { name: "London", country: "United Kingdom", lat: 51.5074, lon: -0.1278, blurb: "Real pumps. Real pennies." },
  { name: "Manchester", country: "United Kingdom", lat: 53.4808, lon: -2.2426, blurb: "The north has nozzles too." },
  { name: "Edinburgh", country: "United Kingdom", lat: 55.9533, lon: -3.1883, blurb: "A sensible glug before the hills." },
  { name: "Cardiff", country: "United Kingdom", lat: 51.4816, lon: -3.1791, blurb: "Welsh pumps, same honest maths." },
  { name: "Belfast", country: "United Kingdom", lat: 54.5973, lon: -5.9301, blurb: "Across the water, still a pump." },
  { name: "Paris", country: "France", lat: 48.8566, lon: 2.3522, blurb: "Government pumps, croissant optional." },
  { name: "Lyon", country: "France", lat: 45.764, lon: 4.8357, blurb: "Rhône-side nozzles." },
  { name: "Madrid", country: "Spain", lat: 40.4168, lon: -3.7038, blurb: "Official Spanish stickers." },
  { name: "Barcelona", country: "Spain", lat: 41.3874, lon: 2.1686, blurb: "Sea breeze, land prices." },
  { name: "Rome", country: "Italy", lat: 41.9028, lon: 12.4964, blurb: "All roads lead to a slightly cheaper pump." },
  { name: "Milan", country: "Italy", lat: 45.4642, lon: 9.19, blurb: "Fashionably fuelled." },
  { name: "Berlin", country: "Germany", lat: 52.52, lon: 13.405, blurb: "National average. Local pumps still hiding." },
  { name: "Amsterdam", country: "Netherlands", lat: 52.3676, lon: 4.9041, blurb: "Bikes win. Cars still ask." },
  { name: "Dublin", country: "Ireland", lat: 53.3498, lon: -6.2603, blurb: "Average only — the nozzles are shy." },
  { name: "Lisbon", country: "Portugal", lat: 38.7223, lon: -9.1393, blurb: "Country colour, not a forecourt." },
  { name: "Perth", country: "Australia", lat: -31.9523, lon: 115.8613, blurb: "Western Australia actually lists pumps." },
  { name: "Sydney", country: "Australia", lat: -33.8688, lon: 151.2093, blurb: "East coast: average only, for now." },
  { name: "Auckland", country: "New Zealand", lat: -36.8509, lon: 174.7645, blurb: "Long way for a litre." },
  { name: "Tokyo", country: "Japan", lat: 35.6762, lon: 139.6503, blurb: "National average, very polite." },
  { name: "Singapore", country: "Singapore", lat: 1.3521, lon: 103.8198, blurb: "A small country, one average." },
  { name: "Delhi", country: "India", lat: 28.6139, lon: 77.209, blurb: "Country figure, not a kerbside pump." },
  { name: "Dubai", country: "United Arab Emirates", lat: 25.2048, lon: 55.2708, blurb: "Warm air, published average." },
  { name: "Cape Town", country: "South Africa", lat: -33.9249, lon: 18.4241, blurb: "The mountain is not a pump." },
  { name: "Nairobi", country: "Kenya", lat: -1.2921, lon: 36.8219, blurb: "Average until local feeds show up." },
  { name: "New York", country: "United States", lat: 40.7128, lon: -74.006, blurb: "US prices start life per gallon." },
  { name: "Los Angeles", country: "United States", lat: 34.0522, lon: -118.2437, blurb: "Traffic may cost more than fuel." },
  { name: "Toronto", country: "Canada", lat: 43.6532, lon: -79.3832, blurb: "National average, maple not included." },
  { name: "Mexico City", country: "Mexico", lat: 19.4326, lon: -99.1332, blurb: "Country colour over the valley." },
  { name: "São Paulo", country: "Brazil", lat: -23.5558, lon: -46.6396, blurb: "A very large average." },
  { name: "Stockholm", country: "Sweden", lat: 59.3293, lon: 18.0686, blurb: "Cool air, published price." },
  { name: "Warsaw", country: "Poland", lat: 52.2297, lon: 21.0122, blurb: "Average until a local feed waves." },
  { name: "Istanbul", country: "Türkiye", lat: 41.0082, lon: 28.9784, blurb: "Two continents, one average." },
];
