import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'countryFlag',
  standalone: true
})
export class CountryFlagPipe implements PipeTransform {
  transform(countryCode: string): string {
    if (!countryCode || countryCode.length !== 2) {
      return countryCode === 'GPS' ? '📍' : (countryCode === '🌐' ? '🌐' : '🏳️');
    }
    try {
      const codePoints = countryCode
        .toUpperCase()
        .split('')
        .map(char => 127397 + char.charCodeAt(0));
      return String.fromCodePoint(...codePoints);
    } catch {
      return '🏳️';
    }
  }
}
