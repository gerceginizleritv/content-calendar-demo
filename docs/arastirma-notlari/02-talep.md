# Araştırma notu: Talep sinyalleri

Bu dosya, 2 Eylül 2026 tarihli pazar araştırması sırasında üretilen ham araştırma çıktısıdır (İngilizce). Ana rapor: `docs/pazar-arastirmasi.md`. Buradaki bilgiler işlenmemiştir; kaynak bağlantıları ve güven işaretleri olduğu gibi bırakılmıştır.

---

Research is complete to the extent the environment allows. Everything below is compiled from 59 executed web searches (7 more were rejected because the search API cannot access reddit.com; 5 were rejected when the session's search budget ran out), plus direct data pulls from vidIQ (YouTube keyword demand), the GitHub API (stars, issues, locale files) and raw.githubusercontent.com. Note the hard limitation up front: the network egress policy blocked every general web page I tried to open (reddit.com, old.reddit, HN Algolia, Indie Hackers, Product Hunt, X, Linktree, Goldman Sachs, Kit, BusinessWire, Latka, Medium, dev.to, Gumroad, Notion, YouTube, eksisozluk, Turkish news sites, Metricool/Buffer help centers, etc.). So page-level facts come from search-result excerpts, not opened pages. I mark confidence per item: **[V]** verified directly by me, **[S]** search-result excerpt only, **[U]** unverified or conflicting.

---

# Demand research for "Slate" (planning-only content calendar for solo creators)

Report date: 2026-09-02. All sources accessed 2026-09-02.

## Demand verdict

**Moderate for one narrow niche, weak for the general product, weak-to-moderate for Türkiye as a paying market.** The underlying behaviour Slate targets is real and large: creators actively hunt for planning systems (YouTube search demand for "notion content calendar" ~47.6K/month, "content planning" ~30.5K/month, "content repurposing" ~28.6K/month and rising [V]), planning-only Instagram grid planners claim tens of millions of users [S], and the top Notion-template seller reported over $1M in 2022 from creator-planning templates [S]. But three things cut hard against a paid, standalone, non-posting calendar: (1) the demand is overwhelmingly for free/DIY substitutes (Notion, Google Sheets, Excel, Meta Business Suite, and now ChatGPT/NotebookLM/Claude-generated calendars), (2) I found no accessible evidence of creators asking for "planning without publishing" as a feature; in the two largest open-source scheduler issue trackers there are zero such requests, while users ask for more automation [V], and (3) creator willingness to pay is low (46% of full-time creators earn under $1,000/year [S]; Turkish RPMs cited at ~1 TL per 1,000 views [S]) and Turkish-language search demand for planning terms is effectively nil on YouTube (<750/month for every Turkish planning keyword tested [V]). The most defensible wedge is not "cheaper Buffer" but "better Creator's Companion": production-heavy video creators (documentary/on-location, multi-platform) already pay one-time prices ($17K–$298K per edition per year for Thomas Frank's Creator's Companion tiers in 2022 [S]) for script-to-shoot-to-publish tracking. Turkish UI is a real gap in Metricool/Buffer [S] but not a moat: Postiz (open source, free to self-host) already ships a 739-key Turkish locale [V].

## Method and limitations

- Executed 59 distinct web searches across English and Turkish queries; 7 Reddit-restricted searches were refused by the search API ("domains are not accessible to our user agent: reddit.com"); 5 final searches were refused by session budget.
- Roughly 60 attempts to open source pages were blocked by the egress proxy (403 CONNECT). Only raw.githubusercontent.com and the GitHub/vidIQ APIs were reachable. Consequence: **no verbatim Reddit, Hacker News, Indie Hackers or X thread quotes** could be captured; Google Trends/Ahrefs/Semrush volumes were not obtainable. vidIQ YouTube search-volume estimates are used as the only quantitative demand proxy.
- Where a number appears only in a third-party summary (e.g., Latka estimates, listicle blogs), it is marked [S] or [U].

---

## PART 1 — Voice of the customer

### 1a. How creators say they plan (what I could verify or excerpt)

**DIY tools dominate the "how do I plan" intent.** YouTube search demand (vidIQ, metrics as of 2026-09-02, global monthly estimates) [V]:

| Query | Est. monthly YouTube searches | Note |
|---|---|---|
| notion content calendar | 47,568 | +243% vs 30-day baseline (13,869); top markets EG 45%, US 27% |
| content calendar google sheets | 21,423 | |
| content calendar in google sheets | 11,811 | +43% |
| how to create content calendar in excel | 5,360 | |
| how to make content calendar in meta business suite | 5,341 | platform-native planning |
| how to create a content calendar for social media with chatgpt | 9,375 | AI-generated calendars |
| how to make a content calendar in notebooklm | 7,211 | |
| create linkedin content calendar with claude | 7,930 | |
| notion for content creators | 22,949 | |
| how i use notion as a content creator | 4,617 | |
| notion for youtubers / notion templates for youtube | 4,351 / 4,834 | |
| youtube workflow | 24,181 | +387% vs baseline 4,961 |
| youtube planning tools | <750 | almost nobody searches for a "tool" |
| content planner app | <750 | |

Reading: people search for *systems* (Notion, Sheets, Excel, AI) far more than for *apps*. That is evidence FOR the job-to-be-done and AGAINST a paid app being the expected solution.

**Creator-written workflow posts (search excerpts; pages could not be opened) [S]:**
- Jules Acree, "How I Plan, Organize, and Create My YouTube Videos | Notion, Workflow Equipment" — https://www.julesacree.com/all/plan-organize-create-youtube-videos (n.d.)
- madeonsundays.com: creators use Notion "to track important dates for YouTube videos, such as what month they want to publish the video, the filming date, and the date they're planning to publish it on their channel" — https://madeonsundays.com/how-to-plan-and-organize-your-youtube-video-content-with-notion/ (n.d.)
- YouTube video "How I Plan My Videos in 2025: The YouTube Planner I Built in Notion" — https://www.youtube.com/watch?v=_ECMLSO4_4g (2025; view count not verified, vidIQ credits exhausted)
- Notion Marketplace templates targeted at YouTubers: "Youtube video production workflow" (Tom's Odyssey), "YouTube Content Planner – Basic" (RageCreates), "Simple Content Planner for Creators" (Thomas Frank, free) — https://www.notion.com/templates/youtube-video-production-workflow, https://www.notion.com/templates/youtube-content-planner-basic, https://www.notion.com/templates/video-production (n.d.)
- Thomas Frank's paid "Notion Video Project Tracker": "designed for YouTubers, video editors, and video producers, allowing you to track and store all your video projects in a main table" with "editing and publishing checklists, pages for research and video scripts, and a hyper-advanced B-roll table" — https://thomasjfrank.com/templates/notion-video-project-tracker/ (n.d.). This is the closest existing analogue to Slate's Ideas → Script → Project chain.
- Dozens of Gumroad content-calendar/video-planner templates priced free–$39 (e.g., https://pinkeystudio.gumroad.com/l/ContentcalendarPro, https://bennybuildsit.gumroad.com/l/notion-content-calendar-pro, https://digitalsetco.gumroad.com/l/notion-youtube-video-production, https://uncai.gumroad.com/l/video-content-planner, https://upgroves.gumroad.com/l/short-video-planner). Sales counts were not visible in search results and pages could not be opened.

### 1b. "Spreadsheets are enough" vs "you need a tool" (evidence on both sides) [S]

- AGAINST paying: Spreadsheet Point page title: **"You don't need a $40/month scheduling tool. You need this free Google Sheets calendar."** — https://spreadsheetpoint.com/templates/social-media-calendar-template-google-sheets/ (n.d.)
- AGAINST: Stackby (2025 guide): "For solo content creators, freelancers, or small marketing teams, Google Sheets is a perfect launchpad because it's free, simple, and flexible enough for managing a basic editorial calendar." — but "starts showing cracks once operations scale ... if you have multiple pieces of content and platforms or people in the loop." — https://stackby.com/blog/google-sheets-content-calendar-template/
- AGAINST (from an incumbent): Hootsuite: "Free options like Trello or Notion work for individuals and very small teams, while mid-tier tools range from $20-100 per user per month for small to mid-sized teams." — https://blog.hootsuite.com/content-calendar-tools/ (2026)
- FOR: HubSpot: "Using a dedicated tool as opposed to a Google Doc or spreadsheet adds a level of organization and clarity that is hard to achieve without it." — https://blog.hubspot.com/marketing/social-media-calendar-tools (n.d.)
- AGAINST third-party tools broadly: Buffer's own 2026 outlook: **"In 2025, more work happened inside platforms — editing, publishing, reviewing performance — instead of entirely across third-party tools."** — https://buffer.com/resources/2026-predictions-social-media/ (late 2025/early 2026)

### 1c. Price frustration with incumbents (real churn drivers) [S]

- Later removed its free plan in 2024: "Later killed its free plan in 2024, with the Starter plan costing $25/month for one social set with 30 scheduled posts per month" and "dropped X/Twitter support in 2025" — https://posteverywhere.ai/blog/planoly-alternatives; "the free plan had been Later's primary acquisition funnel for years ... Removing it pushed casual users toward Buffer and Metricool (which still offer free tiers)" — https://www.velocity.li/blog/best-later-alternatives-creators-and-teams (2026); "7 Best Later Alternatives in 2026 (Free Plan Is Gone)" — https://www.usecarly.com/blog/later-alternatives/
- Buffer: "per-channel pricing that scales painfully, limited free plans, and weak AI assistance are common reasons people leave Buffer" — https://www.blotato.com/blog/buffer-alternatives (2026)
- Hootsuite reviews (AWS Marketplace): "expensive for most small businesses to use long term"; "excessively expensive, even with discounts for buying several memberships" — https://aws.amazon.com/marketplace/reviews/reviews-list/prodview-aptztymh6ie5q?page=341 (n.d.)
- Etsy sellers' forum thread "Hootsuite alternative to program in lot" exists — https://community.etsy.com/t5/EtsySocial/Hootsuite-alternative-to-program-in-lot/m-p/112012857 (content not read)
- Key nuance: where these users go is to *free tiers of schedulers* (Buffer, Metricool), not to paid planning-only tools.

### 1d. Is "planning without publishing" a feature or a gap?

- FOR (mass-market precedent): Preview – Planner for Instagram App Store listing: "used by over 15 million Instagrammers, content creators and business owners"; "choose to plan only your Instagram or TikTok posts - or both" — https://apps.apple.com/us/app/preview-planner-for-instagram/id1126609754 [S]. A competitor, "Feed Preview for Insta", markets "NO LOGIN to Instagram" grid planning — https://play.google.com/store/apps/details?id=com.charlyberthet.instagramfeedpreview [S]. Planning-only has product-market fit for *visual grid planning*.
- AGAINST (scheduler users want more automation, not less): in gitroomhq/postiz-app (35.4K stars) I searched issues for draft/plan-only/manual-publish requests and found none; instead users request auto-reply after posting (#276, 2024-10-01, "similar to the Auto-Plug functionality in ... HypeFury"), predefined posting schedules (#237, 2024-09-13), share-feed-post-to-Story (#1384, 2026-04-08: "useful for content creators who schedule feed posts and want to maximize reach"), multiple accounts per network (#1297, 2026-03-09, +3), Reels posting (#1770, 2026-07-23, +2), custom Reel covers (#1572, 2026-05-31, +3), and back-feeding YouTube links to other platforms (#612, 2025-02-13). Same search in inovector/mixpost: zero results. [V] Selection bias applies (scheduler users self-select for scheduling).
- FOR Slate's specific model (per-post content type, per-post time zone): scheduler issue trackers show these are live pain points: "Scheduled posts shift by 1h" (#1954, 2026-08-23), "User timezone stored as integer offset — breaks DST regions" (#1559, 2026-05-25), DST cron miscalculation (#1145, 2025-12-29), "Post now sends payload with date in the past (≈2h offset)" (#1176, 2026-01-19), and repurposing pain: "repurposing Twitter content across different platforms is a great way to maintain consistency, but manually creating screenshots for each platform can be time-consuming" (#277, 2024-10-01). [V]
- FOR BYOK: self-hosters expect AI features with their own key: "I have a self-installed Postiz ... with a working OpenAI API key ... I do not see many of the new AI features" (#875, 2025-07-16, +3). [V]

### 1e. Turkish creators (ekşi sözlük excerpts; entries could not be opened, dates unknown) [S]

Threads: "youtuber olacaklara tavsiyeler" (https://eksisozluk.com/youtuber-olacaklara-tavsiyeler--5425856), "youtuber olmak" (https://eksisozluk.com/youtuber-olmak--5531472), "youtube ile para kazanma" (https://eksisozluk.com/youtube-ile-para-kazanma--4376942), "youtuber'ların aylık kazançları" (https://eksisozluk.com/youtuberlarin-aylik-kazanclari--5861558).
- On money: "1000 izlenmeye ortalama 1 TL kazanıyorsunuz, 200 TL altında ödeme yapılmadığını düşünürseniz her ay düzenli gelir isteyen birinin ayda 200 bin kez izlenmesi gerekir"
- On tax burden: "Türkiye'de içerik üreticisi olup para kazanmaya başladığın anda vergi mükellefi olmak zorundasın. Ayda 5000 TL kazansan bile sana çıkan bağ-kur borcu 9000 TL."
- On tools: "doğru araçları ve yapay zekâyı 'asistan' olarak kullanarak, tek başına da olsan gayet profesyonel bir içerik operasyonu kurmak mümkün"
- Turkish businesses' habit: "Many businesses in Turkey prepare monthly social media calendars using Excel spreadsheets or social media calendar creation tools" (Ticimax blog, https://www.ticimax.com/blog/sosyal-medya-takvimi, n.d.)

---

## PART 2 — Survey / industry data

| Claim | Source | Confidence |
|---|---|---|
| 200M creators globally (Linktree definition) | Linktree Creator Report 2022/2023 via https://www.tubefilter.com/2023/09/27/linktree-2023-creator-report-attention-economy-stats-breakdown/ (2023-09-27) | [S] |
| 66% of creators are part-time; only 12% of full-time creators earn >$50K/yr; 46% of full-time creators earn <$1,000/yr; part-time: 3% >$50K, 68% <$1K (survey of ~9,500 creators) | https://techcrunch.com/2022/04/20/linktree-creator-economy-report-research/ (2022-04-20); https://linktr.ee/creator-report/ | [S] |
| 303M creators; +165M since 2020; "influencers" only 14% of creators; 17% are business owners, 39% aspire to be | Adobe Future of Creativity, https://news.adobe.com/news/news-details/2022/adobe-future-of-creativity-study-165m-creators-joined-creator-economy-since-2020 (2022-08/09) | [S] |
| Creator economy TAM $250B → ~$480B by 2027; 50M creators growing 10–20% CAGR | https://www.goldmansachs.com/insights/articles/the-creator-economy-could-approach-half-a-trillion-dollars-by-2027 (2023-04-19) | [S] |
| 59% of creators identify as entrepreneurs (up from 50%); entrepreneurial creators earn 25% more; creators "twice as likely to worry about the unpredictability of social media platforms compared to last year"; only 33% prioritize "money now" | Kajabi 2025 State of Creator Commerce, https://www.businesswire.com/news/home/20250417375846/en (2025-04-17) | [S] |
| "Median full-time creator in the United States earned $44,000 in 2025"; median part-time "under $5,000"; "59% of full-time creators reported burnout" attributed to Kit's State of the Creator Economy | Excerpt only; Kit's page blocked; a second source gives "$50,000–$75,000" median. Kit 2024 report: https://kit.com/reports/creator-economy-2024 | [U] |
| Global influencer marketing 2025 ≈ $32.55B (IMH benchmark) | cited via https://www.kornisonajans.com/influencer-marketing-istatistikleri-2026/ | [S] |
| Hootsuite Social Trends 2025: 3,864 marketers, Aug 2024, 99 countries | https://www.slideshare.net/slideshow/hootsuite-social-trends-2025-report_en-pdf/279326623 | [S] |
| Sprout Social Index 2025: 4,044 consumers, 900 practitioners, 322 leaders; 64% of consumers more likely to buy from brands partnering with trusted creators | https://sproutsocial.com/insights/index/ | [S] |
| HubSpot 2025: 75% of brands plan to work with influencers/creators; 2026 report from 1,100+ marketers; only 13.54% use AI for social listening | https://offers.hubspot.com/social-media-trends-report ; https://blog.hubspot.com/marketing/hubspot-blog-social-media-marketing-report | [S] |
| Buffer engagement benchmark: 52M+ posts from 200,000+ Buffer accounts (Jan 2024–Dec 2025) | https://buffer.com/social-media-benchmarks/state-of-social-media-engagement-2026 | [S] |

**What I could not find:** any 2024–2026 survey figure for what creators *spend on planning/scheduling software*. The Linktree 2023 report, Kit reports, IMH Creator Earnings Report 2025 (https://influencermarketinghub.com/creator-earnings-report-2025/), Patreon and Metricool studies were all blocked; the search excerpts contained no tool-spend statistic. Treat "creators spend $X on tools" as unknown.

---

## PART 3 — Search demand

Google/Ahrefs/Semrush/Google Trends data were not obtainable (all blocked; no blog post with published volumes surfaced). The table below is **YouTube search demand from vidIQ** (global estimated monthly searches; "growth" compares the current month to a 30-day baseline, so it is *not* a 2022→2026 trend). Metrics as of 2026-09-02 [V].

**English**

| Keyword | Est./month | 30-day baseline | Short-term change | US in-country |
|---|---|---|---|---|
| content calendar | 11,768 | 28,779 | −59% | 2,645 |
| content calendar for social media | 22,791 | 47,568 | −52% | 5,491 |
| social media content calendar | 7,729 | 7,729 | 0% | — |
| content calendar template | 4,321 | — | — | — |
| social media calendar | 3,954 | — | — | — |
| social media planner | 4,788 | — | — | — |
| social media planning | 4,290 | — | — | — |
| youtube video planner | 5,397 | — | — | — |
| youtube content calendar | 3,905 | — | — | — |
| content planner | 16,831 | 4,942 | +241% | — |
| content planner app | <750 | — | — | — |
| notion content planner | 6,756 | 12,468 | −46% | — |
| content planning | 30,513 | 33,492 | −9% | 10,048 |
| how to plan youtube videos | 5,282 | 9,748 | −46% | — |
| planning youtube videos | 5,351 | — | — | — |
| content repurposing | 28,623 | 16,750 | +71% | 13,010 |
| repurposing content | 10,009 | 5,423 | +85% | — |
| how to repurpose video content | 5,236 | — | — | — |
| social media automation | 90,367 | 61,342 | +47% | 5,830 |

Question-form demand (global): "how to create a monthly content calendar for social media" 50,361 (+271%); "how to plan content calendar" 11,013; "how to make content calendar for social media" 10,753 (+164%); "how to send content calendar for clients aproval?" 5,378 (agency use case); "where to make a content calendar" 5,373. [V]

**Turkish (country TR)**

| Keyword | Est./month | Note |
|---|---|---|
| içerik takvimi | <750 | |
| sosyal medya içerik takvimi | <750 | |
| sosyal medya takvimi | <750 | |
| sosyal medya planlama / planlaması | <750 | |
| içerik planlama | <750 | |
| youtube içerik planlama | <750 | |
| içerik planlayıcı | <750 | |
| instagram içerik planlama | 5,028 | metrics as of 2026-03-17 |
| sosyal medya yönetimi | 28,420 | TR in-country 31,155; +85% vs baseline |
| içerik üretimi | 7,453 | |
| youtube para kazanma | 118,195 | TR in-country 106,938 (90% TR) |

Reading: Turkish creators search massively for *earning* on YouTube and for *social media management* (an agency/job term), and essentially not at all for *planning/calendar* terms. Trend direction 2022→2026 for any of these terms could not be verified.

---

## PART 4 — Comparable small products: revenue evidence

| Product (maker) | Revenue evidence | Source (date) | Conf. |
|---|---|---|---|
| **FeedHive** (Simon Høiberg) | $8.5K MRR growing ~20%/mo (Nov 2021); "FeedHive is doing almost $20K MRR. Server cost is still < $400/month" (May 2022); Latka *estimate* $227.7K ARR 2024, ~5 staff; founder: "I hired a 5-man team at $300 MRR ... 3 months later... $50,000 poorer... I had to get rid of them all" (Oct 2025) | https://www.indiehackers.com/product/feedhive ; https://x.com/SimonHoiberg/status/1526517912328101889 (2022-05); https://getlatka.com/companies/feedhive ; https://x.com/SimonHoiberg/status/1979153866835763251 (2025-10) | [S] |
| **Typefully** (Fabrizio Rinaldi, Francesco Di Lorenzo) | "$1.6M ARR SaaS" (Marc Lou, Dec 2024); "$1.4M annual revenue with a team of three; 130,000 customers"; "$113K MRR (2026)" claim | https://x.com/marc_louvion/status/1869081388127019280 (2024-12-17); https://gaps.com/social-media/ ; https://bigideasdb.com/micro-saas-examples-2026 | [S]/[U] |
| **Hypefury** (Samy Dindane, Yannick Veys) | $500 MRR Dec 2019 → $4.4K in 4 months → $10K → "$23K MRR in 2 years" (Sept 2021); no 2025 figure verified | https://www.indiehackers.com/post/flying-past-23k-mrr-in-2-years-hypefury-45f73f0c0a (2021-09); https://baremetrics.com/blog/hypefury-growth ; https://growthlessons.co/how-twitter-automation-platform-hypefury-went-from-0-to-4-4k-mrr-in-4-months/ | [S] |
| **Tweet Hunter / Taplio** (Tibo Louis-Lucas) | Sold to lempire: "$2M upfront plus $8M in earn-out"; had to grow "from $1.5M ARR to $10M ARR"; "made it to $8M ARR — collecting $6M of the $8M earn-out"; Starter Story: "$3.5M ARR LinkedIn tool" | https://joinhampton.com/blog/thibault-tibo-sold-8m-regrets-indie-hacker-portfolio ; https://theygotacquired.com/saas/pony-express-acquired-by-lempire/ ; https://www.starterstory.com/stories/pony-express-studio | [S] |
| **Publer** (Ervin Kalemi, Albania, bootstrapped) | $60K (2020) → $435K (2021) → $810K (2022) → $1.6M (2023) → $2.4M (2024); 13.3K customers; ~$170K MRR | https://getlatka.com/companies/publer ; https://www.solounicorn.club/blog/day-15-publer ; https://saasstarterstack.com/interviews/publer | [S] |
| **Pallyy** (Tim Bennetto, solo) | $58K MRR → $74K MRR → ~$85K MRR/$1M ARR; 24,000+ users; pays 40% lifetime affiliate commission; +22% MRR via affiliates | https://www.indiehackers.com/post/tim-bennetto-the-solo-founder-who-built-a-74k-mrr-social-media-tool-after-teaching-himself-to-code-HEz8DdIsHYyUxXbCXcO1 ; https://www.startups.fyi/product/pallyy ; https://www.rewardful.com/case-studies/pallyy | [S] |
| **Postiz** (Nevo David, open source) | "$700 monthly" (dev.to); OSS launch Sept 2024 "making $2,000 per month already"; "$700/mo to $14.2K/mo in under a year"; "roughly $17,000 per month in MRR from 472 paying subscribers" (Mar 2026 article); "over $45K MRR" (Mixergy claim, date unclear). **Verified:** 35,393 stars, 6,731 forks (2026-09-02); README: "Postiz has over 7M downloads and 20k views per month"; ships 15 locales incl. **Turkish (739 keys)** | https://dev.to/nevodavid/i-am-making-700-monthly-with-my-open-source-scheduling-tool-you-can-do-it-too-33o7 ; https://medium.com/@nevo-david/you-can-get-your-financial-freedom-with-open-source-in-2025-47e46fcd3cdb ; https://www.thestartupstorys.com/2026/03/nevo-david-postiz-open-source-saas-17k-month.html ; https://mixergy.com/interviews/revenue-jumped-when-he-sold-to-ai-agents/ ; https://github.com/gitroomhq/postiz-app | [S] revenue / [V] GitHub |
| **Mixpost** (Inovector) | 3,650 stars (2026-09-02); MIT "Lite" + paid Pro/Enterprise; no revenue disclosed | https://github.com/inovector/mixpost | [V] |
| **Planable** | No public revenue found in accessible results | — | — |
| **Thomas Frank** (Notion templates) | "crossed $1,000,508 in revenue" Jan–Dec 2022; breakdown: Ultimate Brain $760K, Creator's Companion/Ultimate Brain bundle $298K, CC Ultimate Tasks $86K, CC Base $17K; ~$2.1M in ~2 years; ~$120K/month template revenue claimed | https://typefully.com/TomFrankly/dollar1-million-in-notion-template-sales-kuFT0iD ; https://www.starterstory.com/stories/thomas-frank ; https://easyaiplaybook.com/p/this-youtuber-makes-120k-mo-selling-boring-documents | [S] |
| **Easlo** (Notion templates) | $500K (2023), $779K (2024, Latka est.); e.g., "Ultimate Finance Tracker ... $39, and 260 people have already bought it" | https://getlatka.com/companies/easlo.co (updated 2025-04-10) | [S] |
| **Pascio** (Notion templates) | "sold over 250,000+ templates in a little over 3 years ... over $275,000"; "~$20,000/month" recurring claim | https://pascio.gumroad.com/p/10-000-month-selling-notion-templates-here-s-how ; https://medium.com/@typham2/how-pascio-earns-20-000-per-month-by-selling-notion-templates-343bba555209 | [S] |
| Content-calendar-specific Gumroad templates | Priced $0–$39; **no sales counts visible** in results (pages blocked) | e.g., https://pinkeystudio.gumroad.com/l/ContentcalendarPro | [U] |

**Marketplace / exit evidence (2024–2026)** [S]:
- Acquire.com biannual multiples (Jan 2026): "median SaaS profit multiple ... 3.9x for 2024-2025" — https://blog.acquire.com/acquire-com-biannual-acquisition-multiples-report-jan-2026/ ; Acquire "suggests not listing a business until it has verifiable revenue" — https://startupa.ge/blog/best-startup-marketplaces-buy-sell-saas
- "A neglected scheduling tool was listed on Acquire.com for $3,800 and grew to $1,200/month MRR within six months" — anecdote, https://www.buildmvpfast.com/blog/buy-micro-saas-grow-acquisition-playbook-2026 [U]
- Flippa 2025 recap: "SaaS transactions on Flippa surged 73.5% in 2025" — https://flippa.com/blog/2025-online-business-ma-insights-from-flippa/ ; a sold listing "schedulebotai.online — AI-powered social media scheduler ... Complete SaaS" (price not visible) — https://flippa.com/12220198-ai-powered-social-media-scheduler-automate-posts-across-12-platforms-complete-saas-with-payment-integration-analytics-ai-content-generation
- Small-deal multiples (attribution via marketplace guides): "Bootstrapped SaaS businesses under $1M ARR sell at an average 2.85x annual profit ... transactions under $100K close at just 1.68x profit" — https://startupa.ge/blog/how-to-sell-micro-saas [U]
- Microns.io lists micro-startups "ranging from $400 to $300,000" — https://www.microns.io/ ; no content-calendar-specific listing surfaced.
- GitHub signal (verified 2026-09-02): the fastest-growing "content calendar" repos are AI-agent skills that *generate and auto-post* calendars (Hao0321/claude-skill-social-post, 639 stars, created 2026-04-21; zubair-trabzada/ai-marketing-claude, 2,587 stars) — developer interest is moving toward AI-driven calendars, which both validates BYOK AI in Slate and threatens a manual board. Turkish "içerik takvimi" repos: 2, both 0 stars.

---

## PART 5 — The Turkish market

**Creator population** [S]:
- YouTube Türkiye Etki Raporu (Oxford Economics, published 2023-01-20, data year 2021): YouTube's creator ecosystem contributed "2 milyar Türk lirasından fazla" to GDP in 2021 and supports "45 binden fazla tam zamanlı işe eşdeğer istihdam"; survey of 2,000 users, 1,000+ creators, 500 businesses (Q4 2022) — https://webrazzi.com/2023/01/20/youtube-turkiye-etki-raporu-youtube-45-binden-fazla-tam-zamanli-ise-esdeger-istihdami-destekliyor/ ; https://egirisim.com/2023/01/20/turkiyedeki-45-binden-fazla-youtube-icerik-ureticisi-tam-zamanli-ise-esdeger-gelir-elde-ediyor/ . **Counts of channels >1K/10K/100K subscribers were not in any accessible excerpt — unverified.**
- Influencer Rating Report (Marketing Türkiye, 2024 data): "Instagram'da 268 bin 544 influencer ... TikTok'ta 74 bin 228 influencer ... YouTube'da ise 17 bin 491 kanal" analyzed (thresholds unknown) — https://www.marketingturkiye.com.tr/haberler/influencer-rating-report-yayinda-iste-sosyal-medyanin-etkilesimi-en-yuksek-influencerlari/
- Unsourced estimate: "Türkiye'de 200 binin üzerinde içerik üreticisi bulunuyor. Ancak bunların yaklaşık 20 bini aktif şekilde markalarla iş birliği gerçekleştiriyor ... yaklaşık 80 bini Instagram, 50 bini ise TikTok odaklı" — https://influencerpazarlamasi.com/turk-influencer-listesi-2025-turkiyenin-etkili-influencerlari/ [U]
- Top Turkish channels list (Social Blade data, 2025-10-11) — https://tr.wikipedia.org/wiki/En_%C3%A7ok_abonesi_olan_T%C3%BCrk_YouTube_kanallar%C4%B1_listesi

**Influencer marketing market size** [S]/[U] — figures conflict:
- 2017: 30M TL — https://webrazzi.com/2018/02/21/turkiyede-influencer-marketing-pazarinin-buyuklugu-30-milyon-tlyi-buldu/ (2018-02-21)
- "2024 yılının ilk yarısında 3,1 milyar TL seviyesine ulaşarak yüzde 87 oranında büyüdüğü" — https://www.avmtrend.com/perakende/turkiyede-influencer-marketing-pazari-hizla-buyuyor_12770 ; https://tclira.com/influencer-pazari-rekor-seviyede-buyudu/
- versus "2024 itibarıyla 100 milyon TL'yi aştı" — https://www.analizgazetesi.com.tr/haber/turkiyede-influencer-pazari-100-milyon-tlye-ulasti-9479/ — the two figures are irreconcilable; neither page could be opened.

**Communities**: ekşi sözlük threads above; Discord: "OST Studio Creator Network", "Türk Oyuncu Topluluğu" (roles for active YouTube/Twitch channels), YouTuber-run servers (Rammus53, Elwind) — https://shiftdelete.net/youtuberlarin-discord-sunuculari-iste-liste ; https://discord.me/turk-oyuncu-toplulugu [S]. No dedicated Turkish "creator tools" forum surfaced; r/Turkey could not be accessed.

**Turkish-language tools and prices** [S]:
- SosyalKöprü (Turkish scheduler; drag-and-drop calendar; auto-posts to Instagram/Facebook/LinkedIn/TikTok/YouTube) — https://www.sosyalkopru.com/ozellikler/icerik-planlayici ; pricing not found.
- Simplified has a Turkish-localized "Ücretsiz İçerik Takvimi" page — https://simplified.com/tr/social-media ; Pippit (ByteDance/CapCut) has a tr-tr social media calendar page — https://www.pippit.ai/tr-tr/tools/social-media-calendar
- Agency benchmark: "Sosyal medya yönetimi fiyatları 2026'da Türkiye'de aylık 8.000 ₺ ile 150.000 ₺ arasında"; "Temel paket (8–12 gönderi, tasarım, planlama): 8.000–20.000 ₺/ay" — https://www.edvido.com/tr/blog/sosyal-medya-yonetimi-fiyatlari (2026)
- Incumbent language support: Metricool interface languages "English, French, Spanish, Portuguese and German" — no Turkish — https://help.metricool.com/en/article/account-settings-and-shortcuts-v020os/ ; Buffer: "web dashboard at buffer.com and iOS mobile app are available in English only ... Android app now supports additional languages as of version 9.1.0 ... also available in Spanish" — https://support.buffer.com/article/638-using-the-buffer-mobile-app-in-another-language ; Later: unknown. **But** Postiz (free, self-hostable) ships a full Turkish UI (verified: 739 translated keys, e.g., "calendar": "Takvim") [V].

**Willingness to pay context** [S]:
- 2026 Turkish subscription prices: Netflix ₺189.99 / ₺289.99 / ₺379.99; YouTube Premium ₺159.99; Spotify Premium ₺99 (figure may be stale); ChatGPT Plus "$20/ay ... Mart 2026'da bu yaklaşık 700 TL" — https://kepyo.com/blog/2026-dijital-abonelik-maliyetleri-netflix-spotify-rehberi.html ; https://kentgundem.net/netflix-abonelik-ucreti-2026-turkiyede-guncel-fiyatlar/ ; https://www.merceknet.com/tr/2026/08/01/... (2026-08-01). "Netflix Standart 289,99 TL/ay asgari ücretin yaklaşık %0,8'ine" implies a net minimum wage near ₺36K/month [U]. A $10–15/month USD-priced SaaS would sit at roughly 1.5–2× Netflix Standard — high for a hobbyist creator earning ~1 TL per 1,000 views.
- Turkish planning-keyword search demand on YouTube is <750/month across the board [V]; "youtube para kazanma" is 118K/month. Turkish creators are asking "how do I earn", not "how do I plan".

---

## 10 strongest pieces of evidence FOR demand

1. Planning-only is already a mass category: Preview claims "over 15 million" users for Instagram/TikTok planning; "no-login" grid planners exist and are popular [S].
2. Creators pay real money for structured planning systems: Thomas Frank's Creator's Companion tiers alone reported $17K + $86K + $298K (bundle) in 2022; his template business crossed $1M in 2022 and ~$2.1M in two years [S].
3. Large and rising YouTube demand for planning systems: "notion content calendar" 47.6K/mo (+243%), "content planning" 30.5K/mo, "content calendar for social media" 22.8K/mo, "youtube workflow" 24.2K/mo (+387%) [V].
4. "One shoot → many posts" matches a rising intent: "content repurposing" 28.6K/mo (+71%), "repurposing content" +85%, "how to repurpose video content" 5.2K/mo [V].
5. Incumbents are pushing price-sensitive creators out: Later ended its free plan (2024) and now starts at $25/month for 30 posts; Buffer's "per-channel pricing that scales painfully"; Hootsuite "expensive for most small businesses" [S].
6. Indie makers earn durable revenue in adjacent tools: Pallyy $74–85K MRR solo; Publer $2.4M (2024) bootstrapped; Typefully $1.6M ARR with three people; Postiz ~$17K MRR from 472 subscribers within about a year of open-sourcing [S].
7. Open-source appetite for owning the content workflow is huge: Postiz 35.4K stars / 6.7K forks / "7M downloads"; Mixpost 3.65K stars [V].
8. Per-platform content types and time zones are documented pain in schedulers (Reels/cover-image requests, four DST/time-zone bugs in 2025–2026) — Slate's per-post type + time-zone model targets real defects [V].
9. Platform-anxiety and "entrepreneur" identity are rising (Kajabi: 59% entrepreneurs; twice as worried about platform unpredictability) — a local-first, BYOK, no-lock-in tool fits that mood [S].
10. Türkiye has a sizeable creator base (268K Instagram / 74K TikTok influencers and 17.5K YouTube channels analyzed; YouTube supports 45K FTE-equivalent jobs) and no Turkish UI at Metricool/Buffer; local agencies charge ₺8–20K/month for basic planning [S].

## 10 strongest pieces of evidence AGAINST demand

1. No accessible evidence that anyone asks for "planning without publishing" as a product; zero such requests in the Postiz and Mixpost issue trackers, where users instead ask for *more* automation (auto-reply, auto-plug, predefined schedules, share-to-story) [V].
2. The demand that exists is for free/DIY substitutes: Notion, Google Sheets, Excel, Meta Business Suite, and AI-generated calendars (ChatGPT 9.4K/mo, NotebookLM 7.2K/mo, Claude 7.9K/mo) [V]; "You don't need a $40/month scheduling tool" is a common message, and Hootsuite itself says Notion/Trello suffice for individuals [S].
3. Creator willingness to pay is very low: 66% part-time; 46% of *full-time* creators earn <$1,000/yr [S]; Turkish creators cite ~1 TL per 1,000 views and heavy tax/Bağ-Kur burdens [S].
4. Core "app" keywords are tiny or soft: "content planner app" <750/mo, "youtube planning tools" <750/mo; "content calendar" 11.8K vs 28.8K baseline (−59%), "content calendar for social media" −52% [V].
5. Turkish-language planning search demand on YouTube is effectively zero (<750/mo for içerik takvimi, sosyal medya takvimi, sosyal medya planlama, içerik planlama) [V].
6. Turkish UI is not a moat: Postiz already ships a 739-key Turkish locale for free; Simplified and Pippit have Turkish pages [V]/[S].
7. Work is moving *into* the platforms (Buffer: "more work happened inside platforms ... instead of entirely across third-party tools"; 5.3K/mo searches for making calendars in Meta Business Suite) [S]/[V].
8. The category is crowded and cheap: Buffer/Metricool free tiers, Blotato $29 for 20 channels, Postiz/Mixpost free self-host; Later's churned users go to free schedulers, not to paid planners [S].
9. Template/tool winners are audience-first creators (Thomas Frank, Easlo, Pascio) or heavy affiliate spenders (Pallyy's 40% lifetime commissions; FeedHive built a 50K following) — distribution, not product, drove revenue [S].
10. Resale/valuation evidence for micro-tools here is poor: sub-$100K deals at ~1.68x profit, a neglected scheduler listed for $3,800, marketplaces discouraging pre-revenue listings [S]/[U]; and developer energy (fast-growing GitHub repos) is moving to AI agents that generate and auto-post calendars, not manual boards [V].

---

## Practical implications (brief)

- Position against Notion/Gumroad templates (one-time or low-price freemium, PWA + local-first as the differentiator), not against Buffer/Later.
- Lead with the production chain (script → shoot logistics → fan-out to per-platform content types with time zones) for on-location/documentary video creators; that is the only segment with demonstrated payment for planning structure.
- Treat Turkish as a secondary language, not the market thesis; Turkish planning demand is unmeasurable today and WTP is constrained by TL pricing.
- Before building further: validate with a Gumroad/Product Hunt listing and by reading r/NewTubers, r/ContentCreators and r/Notion directly (they were inaccessible to me) for verbatim quotes on "planning-only" interest.

---

## Sources (all accessed 2026-09-02)

Verified directly [V]:
- GitHub: https://github.com/gitroomhq/postiz-app (35,393 stars) ; https://github.com/inovector/mixpost (3,650) ; issues #237, #276, #277, #439, #612, #875, #1052, #1145, #1152, #1176, #1213, #1259, #1297, #1384, #1559, #1572, #1770, #1779, #1954 ; Postiz README and locale files at https://raw.githubusercontent.com/gitroomhq/postiz-app/main/README.md and .../libraries/react-shared-libraries/src/translation/locales/tr/translation.json ; https://github.com/Hao0321/claude-skill-social-post ; https://github.com/zubair-trabzada/ai-marketing-claude ; https://github.com/stevenflanagan1/social-ai-team ; https://github.com/furkanlkarabulut-oss/Pdks-bulut-sosyal-medya-takvim
- vidIQ keyword research API (metrics as of 2026-09-02; some rows as of 2026-03 to 2026-08 as noted)

Search-result excerpts [S] (page not opened):
- https://techcrunch.com/2022/04/20/linktree-creator-economy-report-research/ (2022-04-20) ; https://linktr.ee/creator-report/ ; https://linktr.ee/creator-report-23/ ; https://www.tubefilter.com/2023/09/27/linktree-2023-creator-report-attention-economy-stats-breakdown/ (2023-09-27)
- https://news.adobe.com/news/news-details/2022/adobe-future-of-creativity-study-165m-creators-joined-creator-economy-since-2020 (2022)
- https://www.goldmansachs.com/insights/articles/the-creator-economy-could-approach-half-a-trillion-dollars-by-2027 (2023-04-19)
- https://www.businesswire.com/news/home/20250417375846/en (2025-04-17) ; https://www.lindseygamble.com/blog/new-data-from-kajabi-reveals-how-creators-are-finding-success-in-2025
- https://kit.com/reports/creator-economy-2024 ; https://kit.com/news/state-of-the-creator-economy-2024 ; https://nealschaffer.com/creator-economy-statistics/ ; https://influencermarketinghub.com/creator-earnings-report-2025/
- https://www.slideshare.net/slideshow/hootsuite-social-trends-2025-report_en-pdf/279326623 ; https://sproutsocial.com/insights/index/ ; https://offers.hubspot.com/social-media-trends-report ; https://blog.hubspot.com/marketing/hubspot-blog-social-media-marketing-report ; https://blog.hubspot.com/marketing/social-media-calendar-tools
- https://buffer.com/resources/2026-predictions-social-media/ ; https://buffer.com/social-media-benchmarks/state-of-social-media-engagement-2026
- https://spreadsheetpoint.com/templates/social-media-calendar-template-google-sheets/ ; https://stackby.com/blog/google-sheets-content-calendar-template/ ; https://blog.hootsuite.com/content-calendar-tools/
- https://posteverywhere.ai/blog/planoly-alternatives ; https://www.velocity.li/blog/best-later-alternatives-creators-and-teams ; https://www.usecarly.com/blog/later-alternatives/ ; https://www.blotato.com/blog/buffer-alternatives ; https://aws.amazon.com/marketplace/reviews/reviews-list/prodview-aptztymh6ie5q?page=341 ; https://community.etsy.com/t5/EtsySocial/Hootsuite-alternative-to-program-in-lot/m-p/112012857
- https://apps.apple.com/us/app/preview-planner-for-instagram/id1126609754 ; https://play.google.com/store/apps/details?id=com.charlyberthet.instagramfeedpreview
- https://thomasjfrank.com/templates/notion-video-project-tracker/ ; https://www.notion.com/templates/youtube-video-production-workflow ; https://www.notion.com/templates/youtube-content-planner-basic ; https://www.notion.com/templates/video-production ; https://www.julesacree.com/all/plan-organize-create-youtube-videos ; https://madeonsundays.com/how-to-plan-and-organize-your-youtube-video-content-with-notion/ ; https://www.youtube.com/watch?v=_ECMLSO4_4g ; Gumroad listings cited inline
- FeedHive: https://www.indiehackers.com/product/feedhive ; https://www.indiehackers.com/post/feedhive-crossed-65k-revenue-a7816b5fe4 ; https://x.com/SimonHoiberg/status/1526517912328101889 (2022-05) ; https://x.com/SimonHoiberg/status/1979153866835763251 (2025-10) ; https://getlatka.com/companies/feedhive
- Typefully: https://x.com/marc_louvion/status/1869081388127019280 (2024-12-17) ; https://gaps.com/social-media/ ; https://bigideasdb.com/micro-saas-examples-2026
- Hypefury: https://www.indiehackers.com/post/flying-past-23k-mrr-in-2-years-hypefury-45f73f0c0a (2021-09) ; https://baremetrics.com/blog/hypefury-growth ; https://growthlessons.co/how-twitter-automation-platform-hypefury-went-from-0-to-4-4k-mrr-in-4-months/
- Tweet Hunter/Taplio: https://joinhampton.com/blog/thibault-tibo-sold-8m-regrets-indie-hacker-portfolio ; https://theygotacquired.com/saas/pony-express-acquired-by-lempire/ ; https://www.starterstory.com/stories/pony-express-studio ; https://www.unicorngrowth.io/p/tweethunter-taplio-acquisition
- Publer: https://getlatka.com/companies/publer ; https://www.solounicorn.club/blog/day-15-publer ; https://saasstarterstack.com/interviews/publer ; https://www.therecursive.com/how-albanian-startup-publer-bootstrapped-its-way-to-product-hunt/
- Pallyy: https://www.indiehackers.com/post/tim-bennetto-the-solo-founder-who-built-a-74k-mrr-social-media-tool-after-teaching-himself-to-code-HEz8DdIsHYyUxXbCXcO1 ; https://www.startups.fyi/product/pallyy ; https://www.rewardful.com/case-studies/pallyy ; https://firstuserfridays.substack.com/p/first-user-fridays-issue-2-how-tim
- Postiz: https://dev.to/nevodavid/i-am-making-700-monthly-with-my-open-source-scheduling-tool-you-can-do-it-too-33o7 ; https://medium.com/@nevo-david/you-can-get-your-financial-freedom-with-open-source-in-2025-47e46fcd3cdb ; https://www.thestartupstorys.com/2026/03/nevo-david-postiz-open-source-saas-17k-month.html (2026-03) ; https://mixergy.com/interviews/revenue-jumped-when-he-sold-to-ai-agents/
- Notion sellers: https://typefully.com/TomFrankly/dollar1-million-in-notion-template-sales-kuFT0iD ; https://www.starterstory.com/stories/thomas-frank ; https://easyaiplaybook.com/p/this-youtuber-makes-120k-mo-selling-boring-documents ; https://getlatka.com/companies/easlo.co (updated 2025-04-10) ; https://pascio.gumroad.com/p/10-000-month-selling-notion-templates-here-s-how ; https://medium.com/@typham2/how-pascio-earns-20-000-per-month-by-selling-notion-templates-343bba555209
- Marketplaces: https://blog.acquire.com/acquire-com-biannual-acquisition-multiples-report-jan-2026/ (2026-01) ; https://www.buildmvpfast.com/blog/buy-micro-saas-grow-acquisition-playbook-2026 ; https://flippa.com/blog/2025-online-business-ma-insights-from-flippa/ ; https://flippa.com/12220198-ai-powered-social-media-scheduler-automate-posts-across-12-platforms-complete-saas-with-payment-integration-analytics-ai-content-generation ; https://startupa.ge/blog/how-to-sell-micro-saas ; https://startupa.ge/blog/best-startup-marketplaces-buy-sell-saas ; https://www.microns.io/
- Türkiye: https://webrazzi.com/2023/01/20/youtube-turkiye-etki-raporu-youtube-45-binden-fazla-tam-zamanli-ise-esdeger-istihdami-destekliyor/ (2023-01-20) ; https://egirisim.com/2023/01/20/turkiyedeki-45-binden-fazla-youtube-icerik-ureticisi-tam-zamanli-ise-esdeger-gelir-elde-ediyor/ ; https://www.marketingturkiye.com.tr/haberler/influencer-rating-report-yayinda-iste-sosyal-medyanin-etkilesimi-en-yuksek-influencerlari/ ; https://influencerpazarlamasi.com/turk-influencer-listesi-2025-turkiyenin-etkili-influencerlari/ ; https://tr.wikipedia.org/wiki/En_%C3%A7ok_abonesi_olan_T%C3%BCrk_YouTube_kanallar%C4%B1_listesi (data 2025-10-11) ; https://webrazzi.com/2018/02/21/turkiyede-influencer-marketing-pazarinin-buyuklugu-30-milyon-tlyi-buldu/ (2018-02-21) ; https://www.avmtrend.com/perakende/turkiyede-influencer-marketing-pazari-hizla-buyuyor_12770 ; https://tclira.com/influencer-pazari-rekor-seviyede-buyudu/ ; https://www.analizgazetesi.com.tr/haber/turkiyede-influencer-pazari-100-milyon-tlye-ulasti-9479/ ; https://www.kornisonajans.com/influencer-marketing-istatistikleri-2026/ ; https://www.newslabturkey.org/2025/01/10/influencer-pazarlama-kidfluencer/ (2025-01-10) ; https://intesisveren.intes.org.tr/uploads/20_dijital_2025_tu%CC%88rkiye_raporu.pdf ; ekşi sözlük threads listed in 1e ; https://shiftdelete.net/youtuberlarin-discord-sunuculari-iste-liste ; https://discord.me/turk-oyuncu-toplulugu ; https://www.sosyalkopru.com/ozellikler/icerik-planlayici ; https://simplified.com/tr/social-media ; https://www.pippit.ai/tr-tr/tools/social-media-calendar ; https://www.ticimax.com/blog/sosyal-medya-takvimi ; https://www.edvido.com/tr/blog/sosyal-medya-yonetimi-fiyatlari (2026) ; https://help.metricool.com/en/article/account-settings-and-shortcuts-v020os/ ; https://support.buffer.com/article/638-using-the-buffer-mobile-app-in-another-language ; https://kepyo.com/blog/2026-dijital-abonelik-maliyetleri-netflix-spotify-rehberi.html ; https://kentgundem.net/netflix-abonelik-ucreti-2026-turkiyede-guncel-fiyatlar/ ; https://www.merceknet.com/tr/2026/08/01/dijital-aboneliklerin-guncel-fiyatlari-belli-oldu-iste-netflix-disney-hbo-max-ve-spotify-fiyatlari/ (2026-08-01)

Not obtainable in this session (explicitly unverified): Reddit/HN/Indie Hackers/X thread text; Google/Ahrefs/Semrush search volumes and Google Trends 2022→2026; Turkish channel counts by subscriber tier; creators' software spend from any survey; Gumroad sales counts for content-calendar templates; Planable revenue; current (2025–2026) MRR for FeedHive and Hypefury; a reconciled Turkish influencer-market size.