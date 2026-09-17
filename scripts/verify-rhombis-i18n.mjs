// Same checks as verify-i18n.mjs, for RHOMBIS's own dictionary
// (src/rhombis/i18n.js) -- a separate file since it's a genuinely
// different key set, not a duplicate check.
import { __I18N_FOR_VERIFY_ONLY__ as I18N, LANG_ORDER, LANG_META, t } from '../src/rhombis/i18n.js';

let failures = 0;
function check(label, condition) {
  console.log(`${condition ? 'OK  ' : 'FAIL'} ${label}`);
  if (!condition) failures++;
}

check('LANG_ORDER has every language I18N actually defines, and no others', JSON.stringify([...LANG_ORDER].sort()) === JSON.stringify([...Object.keys(I18N)].sort()));

for (const lang of LANG_ORDER) {
  check(`LANG_META has a native-name entry for "${lang}"`, !!LANG_META[lang]?.native);
}

const englishKeys = Object.keys(I18N.en).sort();
check(`English itself has a non-empty key set (${englishKeys.length} keys)`, englishKeys.length > 0);

for (const lang of LANG_ORDER) {
  if (lang === 'en') continue;
  const dict = I18N[lang];
  const keys = Object.keys(dict).sort();
  check(`${lang}: has exactly English's ${englishKeys.length} keys (no missing, no extra)`, JSON.stringify(keys) === JSON.stringify(englishKeys));
  for (const key of englishKeys) {
    if (dict[key] === undefined) continue;
    check(`${lang}.${key}: is non-empty`, dict[key].trim().length > 0);
  }
}

for (const lang of LANG_ORDER) {
  for (const key of englishKeys) {
    const viaT = t(key, lang);
    const direct = I18N[lang][key] ?? I18N.en[key];
    check(`t("${key}", "${lang}") matches the dictionary directly`, viaT === direct);
  }
}

console.log(`\n${failures} failures.`);
process.exit(failures === 0 ? 0 : 1);
