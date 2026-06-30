// Town › Barangay address data for Marinduque, used by the location chooser
// when Google geocoding isn't used. Each barangay resolves to a built-in
// coordinate via `barangayLocation` so a straight-line fare can be computed.
//
// NOTE: municipality centres are accurate; per-barangay coordinates are
// APPROXIMATE — derived as a small deterministic offset around the town centre
// so points are distinct and within the town's rough extent. Replace with
// surveyed coordinates when available for precise intra-town fares.

export interface MarinduqueTown {
  name: string;
  center: { latitude: number; longitude: number };
  barangays: string[];
}

export const MARINDUQUE_TOWNS: MarinduqueTown[] = [
  {
    name: 'Boac',
    center: { latitude: 13.4451, longitude: 121.8401 },
    barangays: [
      'Agot', 'Agumaymayan', 'Amoingon', 'Apitong', 'Balagasan', 'Balaring',
      'Balimbing', 'Balogo', 'Bamban', 'Bangbangalon', 'Bantad', 'Bantay',
      'Bayuti', 'Binunga', 'Boi', 'Boton', 'Buliasnin', 'Bunganay', 'Caganhao',
      'Canat', 'Catubugan', 'Cawit', 'Daig', 'Daypay', 'Duyay', 'Hinapulan',
      'Ihatub', 'Isok I (Poblacion)', 'Isok II (Poblacion)', 'Laylay', 'Lupac',
      'Mahinhin', 'Mainit', 'Malbog', 'Maligaya', 'Malusak (Poblacion)',
      'Mansiwat', 'Mataas na Bayan', 'Maybo', 'Mercado (Poblacion)',
      'Murallon (Poblacion)', 'Ogbac', 'Pawa', 'Pili', 'Poctoy', 'Poras',
      'Puting Buhangin', 'Puyog', 'Sabong', 'San Miguel (Poblacion)', 'Santol',
      'Sawi', 'Tabi', 'Tabigue', 'Tagwak', 'Tambunan', 'Tampus (Poblacion)',
      'Tanza', 'Tugos', 'Tumagabok', 'Tumapon',
    ],
  },
  {
    name: 'Mogpog',
    center: { latitude: 13.4744, longitude: 121.8606 },
    barangays: [
      'Anapog-Sibucao', 'Argao', 'Balanacan', 'Banto', 'Bintakay', 'Bocboc',
      'Butansapa', 'Candahon', 'Capayang', 'Danao', 'Danlog',
      'Dulong Bayan (Poblacion)', 'Gitnang Bayan (Poblacion)', 'Guisian',
      'Hinadharan', 'Hinanggayon', 'Ino', 'Janagdong', 'Lamesa', 'Laon',
      'Magapua', 'Malayak', 'Malusak', 'Mampaitan', 'Mangyan-Mababad',
      'Market Site (Poblacion)', 'Mataas na Bayan', 'Mendez', 'Nangka I',
      'Nangka II', 'Paye', 'Pili', 'Puting Buhangin', 'Sayao', 'Silangan',
      'Sumangga', 'Tarug',
    ],
  },
  {
    name: 'Gasan',
    center: { latitude: 13.3247, longitude: 121.8676 },
    barangays: [
      'Antipolo', 'Bachao Ibaba', 'Bachao Ilaya', 'Bacong-bacong', 'Bahi',
      'Bangbang', 'Banot', 'Banuyo', 'Barangay I (Poblacion)',
      'Barangay II (Poblacion)', 'Barangay III (Poblacion)', 'Bognuyan',
      'Cabugao', 'Dawis', 'Dili', 'Libtangin', 'Mahunig', 'Mangiliol', 'Masiga',
      'Matandang Gasan', 'Pangi', 'Pingan', 'Tabionan', 'Tapuyan', 'Tiguion',
    ],
  },
  {
    name: 'Buenavista',
    center: { latitude: 13.2581, longitude: 121.9389 },
    barangays: [
      'Bagacay', 'Bagtingon', 'Barangay I (Poblacion)', 'Barangay II (Poblacion)',
      'Barangay III (Poblacion)', 'Barangay IV (Poblacion)', 'Bicas-bicas',
      'Caigangan', 'Daykitin', 'Libas', 'Malbog', 'Sihi', 'Timbo',
      'Tungib-Lipata', 'Yook',
    ],
  },
  {
    name: 'Santa Cruz',
    center: { latitude: 13.4783, longitude: 122.0269 },
    barangays: [
      'Alobo', 'Angas', 'Aturan', 'Bagong Silang (Poblacion)', 'Baguidbirin',
      'Baliis', 'Balogo', 'Banahaw (Poblacion)', 'Bangcuangan', 'Banogbog',
      'Biga', 'Botilao', 'Buyabod', 'Dating Bayan', 'Devilla', 'Dolores',
      'Haguimit', 'Hupi', 'Ipil', 'Jolo', 'Kaganhao', 'Kalangkang', 'Kasily',
      'Kilo-kilo', 'Kiñaman', 'Labo', 'Lamesa', 'Landy', 'Lapu-lapu', 'Libjo',
      'Lipa', 'Lusok', 'Maharlika (Poblacion)', 'Makulapnit', 'Maniwaya',
      'Manlibunan', 'Masaguisi', 'Masalukot', 'Matalaba', 'Mongpong', 'Morales',
      'Napo', 'Pag-asa (Poblacion)', 'Pantayin', 'Polo', 'Pulong-Parang',
      'Punong', 'San Antonio', 'San Isidro', 'Tagum', 'Tamayo', 'Tambangan',
      'Taytay',
    ],
  },
  {
    name: 'Torrijos',
    center: { latitude: 13.3231, longitude: 122.0825 },
    barangays: [
      'Bangwayin', 'Bayakbakin', 'Bolo', 'Bonliw', 'Buangan', 'Cabuyo', 'Cagpo',
      'Dampulan', 'Kay Duke', 'Mabuhay', 'Makawayan', 'Malibago', 'Malinao',
      'Maranlig', 'Marlangga', 'Matuyatuya', 'Nangka', 'Pakaskasan', 'Payanan',
      'Poblacion', 'Sibuyao', 'Suha', 'Talawan', 'Tigwi',
    ],
  },
];

// Approximate coordinate for a barangay: a small deterministic offset around
// the town centre (~within ~1.2 km) so distinct barangays produce distinct
// straight-line fares without needing surveyed coordinates.
export function barangayLocation(
  town: MarinduqueTown,
  barangay: string
): { latitude: number; longitude: number } {
  let h = 0;
  for (let i = 0; i < barangay.length; i++) h = (h * 31 + barangay.charCodeAt(i)) >>> 0;
  const dLat = (((h % 1000) / 1000) - 0.5) * 0.020; // ±0.010° ≈ ±1.1 km
  const dLng = ((((h >>> 10) % 1000) / 1000) - 0.5) * 0.020;
  return {
    latitude: town.center.latitude + dLat,
    longitude: town.center.longitude + dLng,
  };
}
