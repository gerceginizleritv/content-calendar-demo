# Meta hata bildirimi — Facebook reels dağıtılmıyor

5 Ekim 2026. Bu dosyanın ilk bölümü **sana** (nereye, nasıl), ikinci bölümü
**Meta'ya kopyalanacak metin** (İngilizce, çünkü bildirimler İngilizce
inceleniyor).

---

## ADIM 0 — Göndermeden önce bir şeyi kontrol et (5 dakika)

Bildirimi göndermeden önce bu ikisine bak. İkincisi **sorunun gerçek sebebi
olabilir** ve öyleyse Meta'dan cevap beklemeden çözülür:

1. **Sayfada kısıtlama var mı?**
   Meta Business Suite → sol altta **Hesap Durumu** (Account Status) ve
   **Sayfa Kalitesi** (Page Quality).
   *Beklenen: temiz.* Elle attığın reels 127 bin görüntülenme aldığı için
   sayfa kısıtı ihtimali zaten büyük ölçüde elenmiş durumda — ama bakması
   bedava.

2. **Uygulamanın izni "Advanced Access" mi?**
   developers.facebook.com → uygulamamız → **App Review → Permissions and
   Features** → `pages_manage_posts` satırına bak. **Standard** mı
   **Advanced** mı yazıyor?

   Niye bakıyoruz: Standard Access yalnızca uygulamanın kendi
   yöneticilerinin gördüğü içerik üretir — bu, gördüğümüz tabloyu birebir
   açıklardı (yayınlanıyor, hata dönmüyor, herkese açık görünüyor, ama tek
   tekil görüntüleyen = 1, yani sen).

   **⚠ Ama bizim verimiz buna karşı çıkıyor,** o yüzden bunu "muhtemel
   sebep" diye sunmuyorum: Facebook **hikâyeleri** aynı uygulamadan, aynı
   token'la, aynı kod yolundan gidiyor ve **109-422 gerçek kişiye**
   ulaşıyor. İzin seviyesi sorun olsaydı hikâyeler de görünmez olurdu.
   Yani cevap büyük olasılıkla "Advanced" çıkacak — yine de bakmaya değer,
   çünkü reels'in hikâyelerden farklı bir inceleme şartı olabilir ve bakmak
   iki dakika sürüyor.

Bana hangisini gördüğünü söyle, oraya göre devam ederim.

---

## NEREYE GÖNDERİLECEK

**Birincil — Platform Bug Report** (asıl yer, çünkü sorun API'ye özgü):
<https://developers.facebook.com/support/bugs/>
Sağ üstte **Report a Bug**. Uygulamayı seçmen istenir; Shootboard'ın
kullandığı uygulamayı seç. Aşağıdaki metni `Description` alanına yapıştır.

**İkincil — Business Support Home** (sayfa tarafı, bir hafta cevap
gelmezse):
<https://business.facebook.com/business-support-home>
Varlık olarak sayfayı seç → listede karşılığı yoksa en altta **Other Page
Issue** → aynı metni yapıştır.

İkisini birden göndermek sorun değil, farklı ekiplere gidiyor.

---

## META'YA KOPYALANACAK METİN (aşağıdaki çizgiden itibaren)

---

**Title:** Reels published via `POST /{page-id}/video_reels` get no
distribution (1 unique viewer); the identical file posted manually on the
same Page reaches 127,672 views

**Page ID:** 880482471822163

**API version:** v26.0

### Summary

Reels published to our Page through the Graph API endpoint
`POST /{page-id}/video_reels` receive essentially zero distribution. The API
returns success, the resulting post is public, not hidden, and identical in
every field we can read to a reel posted by hand — but it reaches 1 unique
viewer.

The same video files, published **through the same automated pipeline, in
the same minute**, to our Instagram Business account via the Instagram Graph
API, perform normally. So this is specific to Facebook reels created through
the API.

### The controlled comparison

Each row below is **one video file**, published to both platforms by the same
automated pipeline within the same minute, from the same public HTTPS URL.
Facebook figures are `post_media_view` / `post_total_media_view_unique`
(lifetime); Instagram figures are owner-insights plays.

| Date (UTC) | Length | Instagram (API) | Facebook (API) | FB unique viewers |
|---|---|---|---|---|
| 2026-10-02 07:01 | 86 s | 3,819 plays | **3 views** | **1** |
| 2026-10-03 07:01 | 100 s | 8,148 plays | **19 views** | **1** |

For comparison, the next day's file was posted to Facebook **by hand** (Meta
Business Suite) instead of through the API, while still going to Instagram
through the API:

| Date (UTC) | Length | Instagram (API) | Facebook (**manual**) | FB unique viewers |
|---|---|---|---|---|
| 2026-10-04 07:00 / 07:13 | 96 s | 555,538 plays | **127,672 views** | 116,594 |

Two more hand-posted reels on the same Page, for scale: 1,461 views
(2026-10-02 18:00 UTC) and 1,553 views (2026-10-04 17:01 UTC).

### Post IDs

Published through the API (affected):

- `880482471822163_122149236795165085` — video `1723995951993079`,
  2026-10-03 07:01:04 UTC, 100.4 s, 76,458,331 bytes — 19 views, 1 unique
- `880482471822163_122149116705165085` — video `936776402412641`,
  2026-10-02 07:01:01 UTC, 86 s — 3 views, 1 unique

Posted manually (unaffected), same Page:

- `880482471822163_122149351509165085` — video `1082425381359573`,
  2026-10-04 07:13:02 UTC, 96 s — 127,672 views, 116,594 unique
- `880482471822163_122149404453165085` — video `1128147762993566`,
  2026-10-04 17:01:18 UTC, 17 s — 1,553 views, 1,358 unique
- `880482471822163_122149175661165085` — video `1409695434638812`,
  2026-10-02 18:00:48 UTC — 1,461 views, 1,330 unique

### Steps to reproduce

1. `POST /{page-id}/video_reels` with `upload_phase=start`
2. Upload the file with `rupload.facebook.com` using the returned
   `video_id`, sending `file_size` and `Authorization: OAuth {page-token}`
3. `POST /{page-id}/video_reels` with `upload_phase=finish`,
   `video_state=PUBLISHED`, `description`, and optionally `title`
4. Optionally set a cover via the thumbnail endpoint
5. The call succeeds and returns the video ID. No error at any step.
6. Read `post_media_view` and `post_total_media_view_unique` after 24-48 h

### Expected vs actual

**Expected:** a reel published through the API enters the same distribution
and recommendation surfaces as a reel posted through Meta Business Suite.

**Actual:** it reaches 1 unique viewer. The only viewer is the Page admin.

### What we have already ruled out

- **The file.** The identical file, from the identical public URL, performs
  normally on Instagram through the same pipeline in the same minute.
- **Length.** 86 s, 96 s and 100 s are all affected. Longer videos on this
  Page reach 912,601 / 253,978 / 58,337 views.
- **The cover image.** The hand-posted reel that reached 127,672 views had
  **no** cover. API-posted reels **with** covers reached 19.
- **The `title` field.** One API reel was published without `title` to test
  this; it still reached 19 views / 1 unique viewer.
- **Bitrate / file size.** Lowered from 9.03 Mbps to 6.09 Mbps across the
  test set. No change.
- **Copyright.** `copyright_check_status.matches_found: false`.
- **Privacy.** `privacy.value = "EVERYONE"` on every post, API and manual
  alike.
- **Visibility flags.** `is_hidden: false`, `is_published: true` on all.
- **Post shape.** `status_type: "added_video"` and
  `is_eligible_for_promotion: true` are identical on the API posts and the
  hand-posted ones. We can find no field that differs.
- **Aspect ratio.** 1080×1920 native on both routes.
- **The Page.** Not a Page-level restriction: hand-posted reels on this same
  Page, in the same days, reach 127,672 views.
- **The token and the app.** Facebook **Stories** published through the
  **same app, same Page token and same code path** are unaffected and
  consistently reach 109-422 views each. Only reels are affected.
- **The endpoint call.** Every step returns success; no error code, no
  warning, no `video_status` problem.

### Questions

1. Is there a distribution or recommendation limitation applied to reels
   created through `POST /{page-id}/video_reels` — for this Page, for this
   app, or in general?
2. Does publishing reels that are eligible for distribution require any
   permission or review step beyond `pages_manage_posts`? We ask because
   an access-level explanation does not fit on its own: Stories published
   through the same app, the same Page token and the same code path reach
   109-422 real viewers, so content this app publishes is demonstrably
   visible to people who are not Page admins. Whatever excludes these
   reels appears to be specific to reels.
3. Is there any field on the video or post object that we can read to detect
   that a reel has been excluded from distribution? Right now the API
   reports complete success and a fully public post, and there is no
   programmatic way to tell that the content will not be shown to anyone.

Question 3 matters most to us regardless of the cause: an API that reports
success for content it will not distribute gives developers no way to detect
the problem.
