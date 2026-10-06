import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const countriesFile = require.resolve('@countrystatecity/countries/data/countries.json');
const dataDirectory = dirname(countriesFile);
const outputDirectory = join(process.cwd(), 'public', 'data');
const outputFile = join(outputDirectory, 'locations.json');

const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));

const normalize = (value) => String(value ?? '')
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase()
  .trim();

const slugify = (value) => normalize(value)
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '');

const countries = readJson(countriesFile);
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

for (const countryDirectory of readdirSync(dataDirectory, { withFileTypes: true })) {
  if (!countryDirectory.isDirectory()) continue;

  const countryCode = countryDirectory.name.split('-').at(-1)?.toUpperCase() ?? '';
  if (!countryByCode.has(countryCode)) continue;

  const countryPath = join(dataDirectory, countryDirectory.name);

  for (const stateDirectory of readdirSync(countryPath, { withFileTypes: true })) {
    if (!stateDirectory.isDirectory()) continue;

    const citiesPath = join(countryPath, stateDirectory.name, 'cities.json');

    let cities;
    try {
      cities = readJson(citiesPath);
    } catch {
      continue;
    }

    for (const city of cities) {
      const name = String(city.name ?? '').trim();
      const cityCountryCode = String(city.country_code ?? city.countryCode ?? countryCode).toUpperCase();
      const latitude = Number(city.latitude);
      const longitude = Number(city.longitude);

      if (!name || !cityCountryCode || !Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;

      const country = countryByCode.get(cityCountryCode);
      const cityId = city.id != null
        ? String(city.id)
        : slugify(name) + '-' + latitude + '-' + longitude;

      locations.push({
        id: cityCountryCode.toLowerCase() + '-' + cityId,
        name,
        country: country?.name || cityCountryCode,
        countryCode: cityCountryCode,
        flag: country?.flag || '',
        latitude,
        longitude,
        timezone: String(city.timezone || 'UTC'),
        tier: 3
      });
    }
  }
}

const uniqueLocations = new Map();

for (const location of locations) {
  const key = normalize(location.name) + '|' + normalize(location.countryCode);
  if (!uniqueLocations.has(key)) uniqueLocations.set(key, location);
}

const catalogue = [...uniqueLocations.values()]
  .sort((a, b) => a.country.localeCompare(b.country) || a.name.localeCompare(b.name));

if (!catalogue.length) {
  throw new Error('The country/city catalogue generated no locations.');
}

mkdirSync(outputDirectory, { recursive: true });
writeFileSync(outputFile, JSON.stringify(catalogue));

console.log(`Generated ${catalogue.length} locations at ${outputFile}`);
