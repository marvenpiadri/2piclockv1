import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getCountries, getAllCitiesInWorld } from '@countrystatecity/countries';

const root = process.cwd();
const outputDirectory = join(root, 'public', 'data');
const outputFile = join(outputDirectory, 'locations.json');

const normalize = (value) =>
  String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .trim();

const slugify = (value) =>
  normalize(value).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const [countries, cities] = await Promise.all([
  getCountries(),
  getAllCitiesInWorld()
]);

const countryByCode = new Map(
  countries.map((country) => [
    String(country.iso2 ?? '').toUpperCase(),
    {
      name: String(country.name ?? ''),
      flag: String(country.emoji ?? '')
    }
  ])
);

const locations = [];

for (const city of cities) {
  const name = String(city.name ?? '').trim();
  const countryCode = String(city.countryCode ?? '').toUpperCase();
  const latitude = Number(city.latitude);
  const longitude = Number(city.longitude);

  if (!name || !countryCode || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    continue;
  }

  const country = countryByCode.get(countryCode);
  const cityId = city.id != null
    ? String(city.id)
    : `${slugify(name)}-${latitude}-${longitude}`;

  locations.push({
    id: `${countryCode.toLowerCase()}-${cityId}`,
    name,
    country: country?.name || countryCode,
    countryCode,
    flag: country?.flag || '',
    latitude,
    longitude,
    timezone: String(city.timezone || 'UTC')
  });
}

await mkdir(outputDirectory, { recursive: true });
await writeFile(
  outputFile,
  JSON.stringify({
    version: '1',
    source: 'country-state-city-database',
    count: locations.length,
    locations
  })
);

console.log(`Generated ${locations.length.toLocaleString()} global locations at ${outputFile}`);
