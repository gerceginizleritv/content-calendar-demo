"""
Lojistik Teslimat Performans Dashboard — veri katmanı.

İki kaynak dosya:
  1. Lojistik Teslimat Raporu  (İrsaliye No, Talep Zamanı, Çıkış Zamanı,
     Tahmini Teslimat Zamanı, Teslim Tarihi, ...)
  2. İrsaliye Detay Raporu     (Fiş Numarası, Ekleme Tarihi, Ekleme Saati,
     Cari Hesap Unvanı, ...)

Birleştirme anahtarı: İrsaliye No == Fiş Numarası
"""
from __future__ import annotations

import io
import re
from dataclasses import dataclass, field

import pandas as pd

# --------------------------------------------------------------------------- #
# Sabitler
# --------------------------------------------------------------------------- #
IRS_PREFIX_RE = re.compile(r"^(?P<prefix>[A-Z]{3}\d{4})(?P<num>\d{9})$")
ONLY_NUM_RE = re.compile(r"^\d{1,9}$")

# Kullanıcının hazırladığı "Sipariş Teslimat Süreç Takibi" Excel'indeki SLA hedefleri (saat)
DEFAULT_SLA = {
    "depo_hazirlik": {"label": "Depo Hazırlık (İrsaliye → Lojistik Talebi)", "hedef": 18, "kritik": 24},
    "sevk_teslim": {"label": "Sevk Teslim (Talep → Depodan Çıkış)", "hedef": 4, "kritik": 8},
    "lojistik_tasima": {"label": "Lojistik Taşıma (Çıkış → Müşteriye Teslim)", "hedef": 36, "kritik": 54},
    "toplam": {"label": "Toplam Süre (İrsaliye → Teslim)", "hedef": 61, "kritik": 72},
}

LOJ_REQUIRED = ["İrsaliye No", "Talep Zamanı", "Çıkış Zamanı", "Tahmini Teslimat Zamanı", "Teslim Tarihi"]
IRS_REQUIRED = ["Fiş Numarası", "Ekleme Tarihi", "Ekleme Saati", "Cari Hesap Unvanı"]


# --------------------------------------------------------------------------- #
# Yardımcılar
# --------------------------------------------------------------------------- #
def _norm_col(c: str) -> str:
    """Sütun adlarını karşılaştırma için normalize et (küçük harf, boşluksuz, Türkçe-duyarsız)."""
    c = str(c).strip().lower()
    for a, b in (("ı", "i"), ("İ", "i"), ("ş", "s"), ("ğ", "g"), ("ü", "u"), ("ö", "o"), ("ç", "c"), ("â", "a")):
        c = c.replace(a, b)
    return re.sub(r"[^a-z0-9]", "", c)



def _to_datetime(s: pd.Series) -> pd.Series:
    """Önce ISO / Excel datetime, sonra gün-ay-yıl (Türkçe) biçimini dene."""
    if pd.api.types.is_datetime64_any_dtype(s):
        return s
    out = pd.to_datetime(s, errors="coerce", format="ISO8601")
    miss = out.isna() & s.notna()
    if miss.any():
        out.loc[miss] = pd.to_datetime(s[miss], errors="coerce", dayfirst=True)
    return out

def _find_header_row(raw: pd.DataFrame, required: list[str], max_scan: int = 15) -> int:
    """Rapor başlığı gibi üst satırlar varsa gerçek başlık satırını bul."""
    targets = {_norm_col(r) for r in required}
    for i in range(min(max_scan, len(raw))):
        cells = {_norm_col(v) for v in raw.iloc[i].tolist() if pd.notna(v)}
        if targets.issubset(cells):
            return i
    raise ValueError(
        "Başlık satırı bulunamadı. Beklenen sütunlar: " + ", ".join(required)
    )


def _read_any_excel(file, required: list[str]) -> pd.DataFrame:
    """xls / xlsx / csv dosyasını oku, başlık satırını otomatik bul, sütun adlarını temizle."""
    if hasattr(file, "seek"):
        file.seek(0)
    name = getattr(file, "name", "") or ""
    if name.lower().endswith(".csv"):
        raw = pd.read_csv(file, header=None, sep=None, engine="python")
    else:
        raw = pd.read_excel(file, header=None)
    hdr = _find_header_row(raw, required)
    df = raw.iloc[hdr + 1 :].copy()
    df.columns = [str(c).strip() for c in raw.iloc[hdr].tolist()]
    df = df.dropna(how="all").reset_index(drop=True)

    # Kullanıcının verdiği isimlerle birebir eşleşmese de normalize ederek eşle
    rename = {}
    for req in required:
        if req in df.columns:
            continue
        for c in df.columns:
            if _norm_col(c) == _norm_col(req):
                rename[c] = req
                break
    df = df.rename(columns=rename)
    missing = [r for r in required if r not in df.columns]
    if missing:
        raise ValueError("Eksik sütun(lar): " + ", ".join(missing))
    return df


def normalize_irsaliye_no(value, prefix_hint: str) -> tuple[list[str], str]:
    """
    Tek bir 'İrsaliye No' hücresini standart listeye çevirir.

    Döner: (anahtar listesi, düzeltme_tipi)
      düzeltme_tipi ∈ {"ok", "trim", "kisa_no", "coklu", "bos", "taninmadi"}

    Örnekler (prefix_hint='AIR2026'):
      'AIR2026000001441'                 -> ['AIR2026000001441'], 'ok'
      ' AIR2026000001441'                -> ['AIR2026000001441'], 'trim'
      '1521'                             -> ['AIR2026000001521'], 'kisa_no'
      '1538-1539-1540'                   -> ['AIR2026000001538', ..1539, ..1540], 'coklu'
      'AIR2026000001615-AIR2026000001619'-> [..1615, ..1619], 'coklu'
      NaN / ''                           -> [], 'bos'
    """
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return [], "bos"
    s = str(value).strip()
    if not s or s.lower() == "nan":
        return [], "bos"

    parts = [p.strip() for p in re.split(r"[-/,;\s]+", s) if p.strip()]
    keys, kinds = [], set()
    for p in parts:
        if IRS_PREFIX_RE.match(p):
            keys.append(p)
        elif ONLY_NUM_RE.match(p):
            keys.append(f"{prefix_hint}{int(p):09d}")
            kinds.add("kisa_no")
        else:
            return [], "taninmadi"

    if not keys:
        return [], "taninmadi"
    if len(keys) > 1:
        return keys, "coklu"
    if "kisa_no" in kinds:
        return keys, "kisa_no"
    if s != str(value):
        return keys, "trim"
    return keys, "ok"


def _guess_prefix(series: pd.Series) -> str:
    """İrsaliye numaralarındaki en yaygın ön eki (örn. AIR2026) bul."""
    pref = (
        series.dropna().astype(str).str.strip().str.extract(IRS_PREFIX_RE.pattern)["prefix"].dropna()
    )
    return pref.mode().iloc[0] if len(pref) else "AIR2026"


# --------------------------------------------------------------------------- #
# Okuma
# --------------------------------------------------------------------------- #
def load_logistics(file) -> pd.DataFrame:
    """1. Dosya — Lojistik Teslimat Raporu."""
    df = _read_any_excel(file, LOJ_REQUIRED)
    for c in ["Talep Zamanı", "Çıkış Zamanı", "Tahmini Teslimat Zamanı", "Teslim Tarihi"]:
        df[c] = _to_datetime(df[c])
    if "Ağırlık" in df.columns:
        df["Ağırlık"] = pd.to_numeric(df["Ağırlık"], errors="coerce")
    df["İrsaliye No (Ham)"] = df["İrsaliye No"]
    return df


def load_delivery_notes(file) -> pd.DataFrame:
    """2. Dosya — İrsaliye Detay Raporu. Ekleme Tarihi + Saati -> tek DateTime."""
    df = _read_any_excel(file, IRS_REQUIRED)
    tarih = _to_datetime(df["Ekleme Tarihi"]).dt.strftime("%Y-%m-%d")
    saat = df["Ekleme Saati"].astype(str).str.strip()
    df["İrsaliye Zamanı"] = pd.to_datetime(tarih + " " + saat, errors="coerce", format="ISO8601")
    # Saat parse edilemediyse en azından tarihi kullan
    df["İrsaliye Zamanı"] = df["İrsaliye Zamanı"].fillna(pd.to_datetime(tarih, errors="coerce", format="ISO8601"))
    df["Fiş Numarası"] = df["Fiş Numarası"].astype(str).str.strip()
    df["Cari Hesap Unvanı"] = df["Cari Hesap Unvanı"].astype(str).str.strip()
    for c in ["Fiş Net Toplamı", "Desi/Koli", "Fiş Toplamı"]:
        if c in df.columns:
            df[c] = pd.to_numeric(df[c], errors="coerce")
    return df


# --------------------------------------------------------------------------- #
# Birleştirme
# --------------------------------------------------------------------------- #
@dataclass
class MergeResult:
    data: pd.DataFrame                      # eşleşen + eşleşmeyen tüm lojistik satırları (analiz tablosu)
    matched: pd.DataFrame                   # sadece eşleşenler
    loj_unmatched: pd.DataFrame             # lojistik kaydı var, irsaliye bulunamadı (manuel düzeltme adayı)
    irs_unmatched: pd.DataFrame             # irsaliye var, lojistik kaydı yok
    fixes: pd.DataFrame                     # otomatik düzeltilen irsaliye numaraları
    stats: dict = field(default_factory=dict)


def merge_sources(loj: pd.DataFrame, irs: pd.DataFrame, manual_map: dict[str, str] | None = None) -> MergeResult:
    """
    Lojistik satırlarını irsaliye anahtarına göre patlat (çoklu irsaliye -> çoklu satır),
    numaraları normalize et, manuel düzeltmeleri uygula, birleştir.

    manual_map: {"lojistik No": "AIR2026000001234"} biçiminde elle düzeltme (opsiyonel).
    """
    manual_map = manual_map or {}
    prefix = _guess_prefix(irs["Fiş Numarası"])

    rows, fixes = [], []
    for _, r in loj.iterrows():
        raw = r["İrsaliye No (Ham)"]
        loj_no = str(r.get("No", "")).strip()
        if loj_no in manual_map and str(manual_map[loj_no]).strip():
            keys, kind = normalize_irsaliye_no(manual_map[loj_no], prefix)
            kind = "manuel"
        else:
            keys, kind = normalize_irsaliye_no(raw, prefix)

        if kind not in ("ok",):
            fixes.append({"No": loj_no, "Alıcı Adı": r.get("Alıcı Adı"), "Ham Değer": raw,
                          "Düzeltme": kind, "Kullanılan Anahtar(lar)": ", ".join(keys) if keys else ""})
        if not keys:
            rr = r.copy(); rr["İrsaliye No"] = None; rr["Anahtar Tipi"] = kind; rr["Çoklu İrsaliye"] = False
            rows.append(rr)
            continue
        for k in keys:
            rr = r.copy(); rr["İrsaliye No"] = k; rr["Anahtar Tipi"] = kind; rr["Çoklu İrsaliye"] = len(keys) > 1
            rows.append(rr)

    loj_x = pd.DataFrame(rows).reset_index(drop=True)

    irs_cols = ["Fiş Numarası", "İrsaliye Zamanı", "Cari Hesap Unvanı"]
    for extra in ["Sevkiyat Adresi Açıklaması", "Fiş Net Toplamı", "Desi/Koli", "Fatura Numarası", "Ekleyen Kullanıcı"]:
        if extra in irs.columns:
            irs_cols.append(extra)
    irs_small = irs[irs_cols].drop_duplicates("Fiş Numarası")

    data = loj_x.merge(irs_small, how="left", left_on="İrsaliye No", right_on="Fiş Numarası", indicator=True)
    data["Eşleşti"] = data["_merge"].eq("both")
    data = data.drop(columns=["_merge"])

    matched = data[data["Eşleşti"]].copy()
    loj_unmatched = data[~data["Eşleşti"]].copy()
    irs_unmatched = irs[~irs["Fiş Numarası"].isin(matched["İrsaliye No"])].copy()

    stats = {
        "lojistik_satir": int(len(loj)),
        "lojistik_anahtar": int(len(loj_x)),
        "irsaliye_satir": int(len(irs)),
        "eslesen": int(len(matched)),
        "lojistik_eslesmeyen": int(len(loj_unmatched)),
        "irsaliye_eslesmeyen": int(len(irs_unmatched)),
        "otomatik_duzeltme": int(len(fixes)),
        "prefix": prefix,
    }
    return MergeResult(data, matched, loj_unmatched, irs_unmatched, pd.DataFrame(fixes), stats)


# --------------------------------------------------------------------------- #
# Metrikler
# --------------------------------------------------------------------------- #
def _hours(a: pd.Series, b: pd.Series) -> pd.Series:
    return (b - a).dt.total_seconds() / 3600.0


def compute_metrics(data: pd.DataFrame, sla: dict | None = None) -> pd.DataFrame:
    """
    Aşama süreleri (saat), gecikme bayrakları ve genel durum.

    T0 İrsaliye Zamanı (Ekleme Tarihi+Saati)   -> sipariş operasyonun sisteme girdiği an
    T1 Talep Zamanı                            -> lojistik firmasına talep açıldı
    T2 Çıkış Zamanı                            -> ürün depodan çıktı
    T3 Teslim Tarihi                           -> müşteriye fiili teslim
    Tahmini Teslimat Zamanı                    -> hedef; sadece TARİH bilgisi taşır (saat 00:00),
                                                   bu yüzden gecikme gün bazında kıyaslanır.
    """
    sla = sla or DEFAULT_SLA
    d = data.copy()

    d["Depo Hazırlık (saat)"] = _hours(d["İrsaliye Zamanı"], d["Talep Zamanı"])
    d["Sevk Teslim (saat)"] = _hours(d["Talep Zamanı"], d["Çıkış Zamanı"])
    d["Lojistik Taşıma (saat)"] = _hours(d["Çıkış Zamanı"], d["Teslim Tarihi"])
    d["Toplam Süre (saat)"] = _hours(d["İrsaliye Zamanı"], d["Teslim Tarihi"])
    d["Teslimat Süresi (gün)"] = (d["Teslim Tarihi"].dt.normalize() - d["Çıkış Zamanı"].dt.normalize()).dt.days

    # Gecikme: tahmini vs gerçekleşen (gün bazında)
    d["Gecikme (gün)"] = (d["Teslim Tarihi"].dt.normalize() - d["Tahmini Teslimat Zamanı"].dt.normalize()).dt.days
    d["Teslim Edildi"] = d["Teslim Tarihi"].notna()
    d["Zamanında"] = d["Teslim Edildi"] & (d["Gecikme (gün)"] <= 0)
    d["Gecikti"] = d["Teslim Edildi"] & (d["Gecikme (gün)"] > 0)

    def durum(row):
        if not row["Teslim Edildi"]:
            return "Teslim Bekliyor"
        return "Gecikti" if row["Gecikme (gün)"] > 0 else "Zamanında"
    d["Teslimat Durumu"] = d.apply(durum, axis=1)

    # SLA bayrakları
    for key, col in (("depo_hazirlik", "Depo Hazırlık (saat)"), ("sevk_teslim", "Sevk Teslim (saat)"),
                     ("lojistik_tasima", "Lojistik Taşıma (saat)"), ("toplam", "Toplam Süre (saat)")):
        hedef, kritik = sla[key]["hedef"], sla[key]["kritik"]
        d[f"{col} SLA"] = pd.cut(d[col], bins=[-float("inf"), hedef, kritik, float("inf")],
                                 labels=["SLA İçinde", "Riskli", "SLA Aşıldı"])

    stage_cols = {"Depo Hazırlık": "Depo Hazırlık (saat)", "Sevk Teslim": "Sevk Teslim (saat)",
                  "Lojistik Taşıma": "Lojistik Taşıma (saat)"}
    stage_keys = {"Depo Hazırlık": "depo_hazirlik", "Sevk Teslim": "sevk_teslim", "Lojistik Taşıma": "lojistik_tasima"}

    def aksayan(row):
        worst, worst_ratio = None, 0.0
        for name, col in stage_cols.items():
            v = row[col]
            if pd.isna(v):
                continue
            ratio = v / sla[stage_keys[name]]["hedef"]
            if ratio > 1 and ratio > worst_ratio:
                worst, worst_ratio = name, ratio
        return worst or "-"
    d["Aksayan Aşama"] = d.apply(aksayan, axis=1)

    d["Hafta"] = d["Çıkış Zamanı"].dt.to_period("W").apply(lambda p: p.start_time.date() if pd.notna(p) else None)
    d["Çıkış Günü"] = d["Çıkış Zamanı"].dt.date
    d["Teslim Günü"] = d["Teslim Tarihi"].dt.date
    return d


def kpi_summary(d: pd.DataFrame) -> dict:
    delivered = d[d["Teslim Edildi"]]
    n = len(d)
    return {
        "toplam_sevkiyat": n,
        "teslim_edilen": int(delivered.shape[0]),
        "teslim_bekleyen": int(n - delivered.shape[0]),
        "zamaninda_oran": float(delivered["Zamanında"].mean()) if len(delivered) else None,
        "geciken": int(delivered["Gecikti"].sum()),
        "ort_gecikme_gun": float(delivered.loc[delivered["Gecikti"], "Gecikme (gün)"].mean()) if delivered["Gecikti"].any() else 0.0,
        "ort_depo_hazirlik": float(d["Depo Hazırlık (saat)"].mean()),
        "ort_sevk_teslim": float(d["Sevk Teslim (saat)"].mean()),
        "ort_tasima": float(delivered["Lojistik Taşıma (saat)"].mean()) if len(delivered) else None,
        "ort_toplam": float(delivered["Toplam Süre (saat)"].mean()) if len(delivered) else None,
        "musteri_sayisi": int(d["Cari Hesap Unvanı"].nunique()),
    }


def customer_summary(d: pd.DataFrame) -> pd.DataFrame:
    g = d.groupby("Cari Hesap Unvanı", dropna=False)
    out = pd.DataFrame({
        "Sevkiyat": g.size(),
        "Teslim Edilen": g["Teslim Edildi"].sum(),
        "Zamanında": g["Zamanında"].sum(),
        "Geciken": g["Gecikti"].sum(),
        "Ort. Gecikme (gün)": g.apply(lambda x: x.loc[x["Gecikti"], "Gecikme (gün)"].mean() if x["Gecikti"].any() else 0.0),
        "Ort. Depo Hazırlık (saat)": g["Depo Hazırlık (saat)"].mean(),
        "Ort. Taşıma (saat)": g["Lojistik Taşıma (saat)"].mean(),
        "Ort. Toplam (saat)": g["Toplam Süre (saat)"].mean(),
    })
    out["Zamanında Oranı"] = (out["Zamanında"] / out["Teslim Edilen"].replace(0, pd.NA)).astype(float)
    return out.sort_values("Sevkiyat", ascending=False).reset_index()


# --------------------------------------------------------------------------- #
# Excel çıktısı
# --------------------------------------------------------------------------- #
EXPORT_COLS = [
    "No", "İrsaliye No", "İrsaliye No (Ham)", "Anahtar Tipi", "Eşleşti", "Cari Hesap Unvanı", "Alıcı Adı",
    "Varış Yeri", "Sevkiyat Adresi Açıklaması", "İrsaliye Zamanı", "Talep Zamanı", "Çıkış Zamanı",
    "Tahmini Teslimat Zamanı", "Teslim Tarihi", "Teslimat", "Teslim Alan", "Açıklama", "Ağırlık",
    "Depo Hazırlık (saat)", "Sevk Teslim (saat)", "Lojistik Taşıma (saat)", "Toplam Süre (saat)",
    "Depo Hazırlık (saat) SLA", "Sevk Teslim (saat) SLA", "Lojistik Taşıma (saat) SLA", "Toplam Süre (saat) SLA",
    "Gecikme (gün)", "Teslimat Durumu", "Aksayan Aşama",
]


def to_excel_bytes(result: MergeResult, metrics: pd.DataFrame, cust: pd.DataFrame | None = None) -> bytes:
    buf = io.BytesIO()
    cols = [c for c in EXPORT_COLS if c in metrics.columns]
    with pd.ExcelWriter(buf, engine="xlsxwriter", datetime_format="yyyy-mm-dd hh:mm") as xw:
        metrics[cols].to_excel(xw, sheet_name="Analiz", index=False)
        if cust is not None:
            cust.to_excel(xw, sheet_name="Müşteri Özeti", index=False)
        result.loj_unmatched[[c for c in ["No", "Alıcı Adı", "İrsaliye No (Ham)", "Anahtar Tipi", "Açıklama", "Teslim Alan"] if c in result.loj_unmatched.columns]] \
            .to_excel(xw, sheet_name="Eşleşmeyen Lojistik", index=False)
        result.irs_unmatched[[c for c in ["Fiş Numarası", "Tarihi", "Cari Hesap Unvanı", "Sevkiyat Adresi Açıklaması", "İrsaliye Zamanı"] if c in result.irs_unmatched.columns]] \
            .to_excel(xw, sheet_name="Lojistik Kaydı Olmayan İrsaliye", index=False)
        result.fixes.to_excel(xw, sheet_name="Otomatik Düzeltmeler", index=False)
        for ws in xw.sheets.values():
            ws.freeze_panes(1, 0)
            ws.autofit()
    return buf.getvalue()
