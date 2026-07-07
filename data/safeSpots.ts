// Curated, well-lit public venues per city, suggested when creating an outing
// so first meetups default to safer public locations.
export const SAFE_SPOTS: Record<string, string[]> = {
  Bengaluru: ["Cubbon Park (main gate)", "Third Wave Coffee, Indiranagar", "UB City Mall atrium", "Church Street"],
  Mumbai: ["Marine Drive (Nariman Point end)", "Carter Road promenade", "Phoenix Marketcity atrium", "Bandra Bandstand"],
  Delhi: ["Lodhi Garden (main entrance)", "Connaught Place inner circle", "Select Citywalk atrium", "Hauz Khas Village square"],
  Chennai: ["Marina Beach (lighthouse end)", "Phoenix Marketcity atrium", "Semmozhi Poonga entrance", "Besant Nagar Beach"],
  Hyderabad: ["Jubilee Hills Check Post", "GVK One Mall atrium", "Necklace Road promenade", "Inorbit Mall entrance"],
  Pune: ["FC Road (Vaishali entrance)", "Phoenix Marketcity atrium", "Koregaon Park North Main Road", "Shaniwar Wada entrance"],
};

export function safeSpotsForCity(city: string): string[] {
  return SAFE_SPOTS[city.trim()] ?? [];
}
