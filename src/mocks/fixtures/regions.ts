import type { components } from '../../generated/api-types';

const group = (satoCode: string, name: string, districts: ReadonlyArray<readonly [string, string]>): components['schemas']['LeadRegionGroupDto'] => ({
  satoCode,
  name,
  districts: districts.map(([code, district]) => ({ satoCode: code, name: district })),
});

/** `GET /regions/tree` namunasi (BE-38): viloyat → tuman, kalit SOATO, Elchi tartibida. Farg‘onada 7 tadan ko'p tuman — qidiruvli ro'yxat. */
export const REGION_TREE = [
  group('1703', 'Andijon viloyati', [['1703401', 'Andijon shahri'], ['1703202', 'Asaka tumani']]),
  group('1706', 'Buxoro viloyati', [['1706401', 'Buxoro shahri']]),
  group('1708', 'Jizzax viloyati', [['1708401', 'Jizzax shahri']]),
  group('1710', 'Qashqadaryo viloyati', [['1710401', 'Qarshi shahri']]),
  group('1712', 'Navoiy viloyati', [['1712401', 'Navoiy shahri']]),
  group('1714', 'Namangan viloyati', [['1714401', 'Namangan shahri'], ['1714204', 'Chortoq tumani']]),
  group('1718', 'Samarqand viloyati', [['1718401', 'Samarqand shahri'], ['1718233', 'Urgut tumani']]),
  group('1722', 'Surxondaryo viloyati', [['1722401', 'Termiz shahri']]),
  group('1724', 'Sirdaryo viloyati', [['1724401', 'Guliston shahri']]),
  group('1726', 'Toshkent shahri', [
    ['1726294', 'Chilonzor tumani'], ['1726266', 'Yunusobod tumani'], ['1726269', 'Mirzo Ulug‘bek tumani'], ['1726273', 'Mirobod tumani'],
    ['1726277', 'Shayxontohur tumani'], ['1726280', 'Olmazor tumani'], ['1726283', 'Bektemir tumani'], ['1726287', 'Yakkasaroy tumani'],
    ['1726290', 'Sergeli tumani'], ['1726262', 'Uchtepa tumani'], ['1726264', 'Yashnobod tumani'], ['1726292', 'Yangihayot tumani'],
  ]),
  group('1727', 'Toshkent viloyati', [['1727401', 'Nurafshon shahri']]),
  group('1730', 'Farg‘ona viloyati', [
    ['1730412', 'Qo‘qon shahri'], ['1730401', 'Farg‘ona shahri'], ['1730408', 'Marg‘ilon shahri'], ['1730413', 'Quvasoy shahri'],
    ['1730206', 'Beshariq tumani'], ['1730209', 'Bag‘dod tumani'], ['1730227', 'Rishton tumani'], ['1730203', 'Oltiariq tumani'],
    ['1730224', 'Quva tumani'], ['1730236', 'Uchko‘prik tumani'], ['1730233', 'Toshloq tumani'],
  ]),
  group('1733', 'Xorazm viloyati', [['1733401', 'Urganch shahri']]),
  group('1735', 'Qoraqalpog‘iston Respublikasi', [['1735401', 'Nukus shahri']]),
];
