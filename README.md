# ग्राम आवाज़ — Single-village Sarpanch opinion poll

पूरा project सिर्फ **HTML + CSS + Vanilla JavaScript + JSON** में है। PHP, Firebase, database, API, Node server, npm, build command या CDN की जरूरत नहीं है। Photos और Hindi font भी ZIP में local हैं।

## पहले यह समझें

यह अनौपचारिक public-opinion demo है, सरकारी मतदान प्रणाली नहीं। यह browser में पसंद save करता है; किसी server को vote नहीं भेजता। सार्वजनिक वोट `data/poll.json` से आते हैं और संचालक को manually update करने पड़ते हैं। अलग-अलग लोगों के local votes जमा नहीं होते, refresh करने से भी नहीं। इसलिए इस package को centrally collected live poll कहकर इस्तेमाल न करें।

एक physical device या व्यक्ति का one-vote verification इसमें नहीं है। उसी browser और same origin पर localStorage से दोबारा पसंद रोकते हैं। Browser बदलना, incognito, DevTools या browser data साफ करना इसे bypass कर सकता है। Supported secure browsers में Web Locks tab writes serialize करता है; बाकी browsers में multi-tab protection best effort है।

## 1. चलाना

ZIP extract करें और `sarpanch-voting` folder खोलें।

**आसान तरीका:** VS Code का **Live Server** extension लगाएँ → `index.html` पर right-click → **Open with Live Server**।

यदि Python installed है, इस folder में terminal खोलकर:

```bash
python -m http.server 8080
```

फिर [http://localhost:8080](http://localhost:8080) खोलें। Python केवल files serve करने के लिए है, website में backend नहीं है।

`index.html` को सीधे double-click करके `file://` से खोलने पर browsers JSON fetch रोक सकते हैं। Page इस स्थिति में साफ संदेश दिखाता है। Local server या static hosting से चलाएँ।

## 2. अपना एक गाँव सेट करना

केवल `data/poll.json` edit करें:

- `settings.village`: गाँव का नाम
- `settings.gram_panchayat`: ग्राम पंचायत का नाम
- `settings.district` / `settings.state`: जिला / राज्य
- `settings.title`: hero का छोटा label
- `settings.heading_lines`: बड़ी Hindi headline की दोनों lines
- `settings.heading`: plain headline, `heading_lines` हटाने पर fallback
- `settings.subtitle`: introduction
- `settings.hero_image`: village photo का path
- `settings.hero_alt`: फोटो का accessible description
- `settings.notice`: अनौपचारिक survey notice
- `content`: buttons, sections, messages और बाकी UI labels
- `steps` / `faq`: जानकारी वाले sections

इसमें गाँव बदलने का dropdown नहीं है। एक ही गाँव का dedicated page है। नए गाँव का पहला poll शुरू करते समय `poll_id` भी अपना अलग रखें, जैसे `my-village-2026-001`।

## 3. असली candidates और photos लगाना

अभी तीन **काल्पनिक नाम और AI-generated demo portraits** हैं। ये वास्तविक सरपंच उम्मीदवार नहीं हैं। फोटो और जानकारी आप replace करें।

Photos को `assets/images/` में रखें और JSON के `candidates` में path बदलें। `.jpg`, `.png` और `.webp` सब चलेंगे। Recommended portrait: लगभग 640 × 800 px; चेहरे के ऊपर थोड़ी जगह रखें। Cards सभी candidates को एक जैसा space देते हैं। Photos missing हों तो silhouette fallback दिखेगा।

Example candidate:

```json
{
  "id": "candidate_4",
  "name": "वास्तविक उम्मीदवार का नाम",
  "village": "आपके गाँव का नाम",
  "photo": "assets/images/candidate-4.jpg",
  "description": "उम्मीदवार का छोटा परिचय",
  "votes": 0
}
```

इसे `candidates` array में जोड़ें। प्रत्येक `id` अलग होनी चाहिए; `id` और `poll_id` में English letters, digits, `_` और `-` रखें। JSON में comments या trailing comma न जोड़ें। हर candidate में `village`, `description` और non-negative integer `votes` रखें।

असली जानकारी लगाने पर `settings.demo_mode` को `false` करें। तब sample-data banner छिपेगा। सामान्य छोटे content/photo edits के लिए `poll_id` और candidate IDs वही रखें, ताकि पुराने browser choices बने रहें।

## 4. सार्वजनिक counts update करना

`candidates[].votes` की संख्या manually बदलें, और `settings.updated_at` में सही ISO date/time डालें:

```json
"updated_at": "2026-10-11T20:00:00+05:30"
```

फिर updated `poll.json` hosting पर upload करें। Page reload करें या **ताज़ा आँकड़े देखें** दबाएँ। JSON fetch में `cache: no-store` और timestamp query उपयोग होते हैं। Hosting/CDN का अपना cache हो तो वहाँ भी JSON cache बंद करें या purge करें।

Total और percentages code अपने-आप calculate करता है। शून्य total पर सभी bars 0% दिखती हैं। Percentages display में एक decimal तक round हो सकते हैं, इसलिए उनका displayed sum rounding से थोड़ा अलग हो सकता है। Candidate order JSON वाला ही रहता है; किसी को ranking के आधार पर ऊपर नहीं लाते।

Vote देने पर public count में fake +1 नहीं जोड़ा जाता। Selected card पर **आपने चुना**, सभी voting buttons disabled और confirmation animation दिखती है।

## 5. अन्य settings

```json
"voting_enabled": true,
"show_results": true,
"demo_mode": true
```

- `voting_enabled: false` → नई browser choices बंद; पुराने records बने रहेंगे।
- `show_results: false` → results section, links, candidate vote counts और public-total stat छिपेंगे।
- `demo_mode: true` → sample-data disclosure दिखेगा।
- `poll_id` बदलना → नया अलग poll; उसी browser में नई choice की अनुमति। Live poll में सिर्फ repeat votes खोलने के लिए ID न बदलें।

Stored key: `poll_vote_{poll_id}`. Stored value:

```json
{
  "candidate_id": "candidate_1",
  "voted_at": "2026-10-11T14:00:00.000Z"
}
```

Refresh, tab बंद करना या फिर से page खोलना इसे clear नहीं करता। यदि पुराना selected candidate list से हटे तो browser फिर भी locked रहेगा। Storage blocked या corrupt हो तो सफलता का झूठा message नहीं देते और दोबारा voting रोकते हैं।

## 6. Static hosting / Hostinger

Hosting के document root, जैसे `public_html`, में `index.html`, `assets/`, `data/` upload करें। पूरे folder को subdirectory में upload करना भी supported है; relative paths काम करेंगे। HTTPS इस्तेमाल करें। कोई PHP route या server process नहीं चाहिए। अगर files गाँव के अलग folder में रख रहे हैं तो उसी folder URL से खोलें।

## 7. Mobile और interaction checks

- DevTools में 320, 360, 390, 768 और 1280 px widths जाँचें। Mobile पर एक card, tablet पर दो, desktop पर तीन।
- Candidate → वापस जाएँ: vote save नहीं होना चाहिए।
- Candidate → हाँ, वोट दें: selected state और success animation दिखनी चाहिए।
- Reload: सभी voting buttons locked होने चाहिए। दूसरे tab को भी saved choice दिखनी चाहिए।
- अलग browser: previous choice उपलब्ध नहीं होगी; यही static storage की सीमा है।
- Zero counts, missing photo, `show_results: false`, और `voting_enabled: false` भी जाँचें।
- Keyboard Tab और Escape से dialog चलाएँ। Modal focus browser के native `<dialog>` द्वारा सीमित होता है; cancel पर पहली focus सुरक्षित विकल्प पर रखी जाती है।
- `prefers-reduced-motion` पर reveal, confetti और count animation बंद हो जाते हैं।

## 8. Files और design

- `index.html` — semantic page layout, modal और loading state
- `assets/css/style.css` — theme tokens, breakpoints और animations
- `assets/js/app.js` — JSON validation, safe text rendering, cards/results और interactions
- `assets/js/voting.js` — localStorage persistence, repeat-vote guard और Web Locks
- `data/poll.json` — edit करने वाला main content
- `assets/images/` — local optimized demo photos, fallback और favicon
- `assets/fonts/` — self-hosted Hind TTF font और SIL OFL license

सभी dynamic JSON text `textContent` से insert होते हैं। Arbitrary JSON HTML execute नहीं होता। Image paths local या HTTPS होने चाहिए। Photos `.webp` में optimized हैं, candidate images lazy-load होती हैं, और किसी runtime CDN की जरूरत नहीं है।

## Assets and provenance

Hind font: [Google Fonts repository](https://github.com/google/fonts/tree/main/ofl/hind), SIL Open Font License (`assets/fonts/OFL.txt`). Original TTF files are included.

Images generated with the built-in image-generation tool, then resized and encoded as WebP for this project. All people are fictional. Final project paths are `assets/images/village.webp`, `assets/images/candidate-1.webp`, `assets/images/candidate-2.webp`, `assets/images/candidate-3.webp`.

Generation briefs: cinematic Rajasthan village at golden hour with sandstone homes, green fields and a large tree, negative space on the left for hero copy; three separate neutral editorial portraits in a softly blurred sandstone courtyard, respectively a fictional middle-aged man in an off-white kurta and beige waistcoat, a fictional woman in a muted terracotta sari, and a fictional younger man in a white kurta and dusty teal vest. Each prompt requested realistic texture, natural warm daylight, no political symbols, no logos, no text or watermark. Full prompt set is in `IMAGE-PROMPTS.json`.

## Verification status

JavaScript syntax, JSON configuration, local asset references and automated DOM/voting behavior were checked during creation. Real-browser visual QA was unavailable in the creation environment; use the mobile and interaction checklist above for final hosting verification.
