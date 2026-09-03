"""
Lojistik Teslimat Performans Dashboard — Streamlit uygulaması.

Çalıştırma:  streamlit run app.py
"""
from __future__ import annotations

import warnings

import pandas as pd
import streamlit as st

from data_pipeline import (
    DEFAULT_SLA,
    compute_metrics,
    customer_summary,
    kpi_summary,
    load_delivery_notes,
    load_logistics,
    merge_sources,
    to_excel_bytes,
)

warnings.filterwarnings("ignore")

st.set_page_config(page_title="Lojistik Teslimat Performansı", page_icon="🚚", layout="wide")

st.title("🚚 Siparişten Teslimata Süreç Takibi")
st.caption("Adım 1 — Dosya yükleme, irsaliye eşleştirme ve veri kalitesi kontrolü")

# --------------------------------------------------------------------------- #
# Sidebar: dosya yükleme + SLA
# --------------------------------------------------------------------------- #
with st.sidebar:
    st.header("📂 Dosyalar")
    loj_file = st.file_uploader("1) Lojistik Teslimat Raporu", type=["xlsx", "xls", "csv"], key="loj",
                                help="İrsaliye No, Talep Zamanı, Çıkış Zamanı, Tahmini Teslimat Zamanı, Teslim Tarihi")
    irs_file = st.file_uploader("2) İrsaliye Detay Raporu", type=["xlsx", "xls", "csv"], key="irs",
                                help="Fiş Numarası, Ekleme Tarihi, Ekleme Saati, Cari Hesap Unvanı")

    st.header("🎯 SLA Hedefleri (saat)")
    sla = {}
    for key, cfg in DEFAULT_SLA.items():
        c1, c2 = st.columns(2)
        hedef = c1.number_input(f"{cfg['label']} — Hedef", min_value=0.0, value=float(cfg["hedef"]), step=1.0, key=f"h_{key}")
        kritik = c2.number_input("Kritik", min_value=0.0, value=float(cfg["kritik"]), step=1.0, key=f"k_{key}")
        sla[key] = {"label": cfg["label"], "hedef": hedef, "kritik": kritik}

if not (loj_file and irs_file):
    st.info("Başlamak için sol menüden iki Excel dosyasını sürükleyip bırakın.")
    st.markdown(
        """
        **Beklenen sütunlar**

        | Dosya | Zorunlu sütunlar |
        |---|---|
        | Lojistik Teslimat Raporu | `İrsaliye No`, `Talep Zamanı`, `Çıkış Zamanı`, `Tahmini Teslimat Zamanı`, `Teslim Tarihi` |
        | İrsaliye Detay Raporu | `Fiş Numarası`, `Ekleme Tarihi`, `Ekleme Saati`, `Cari Hesap Unvanı` |

        Rapor başlığı gibi üst satırlar otomatik atlanır; `.xls`, `.xlsx` ve `.csv` desteklenir.
        """
    )
    st.stop()

# --------------------------------------------------------------------------- #
# Okuma
# --------------------------------------------------------------------------- #
@st.cache_data(show_spinner="Dosyalar okunuyor…")
def _load(loj_bytes: bytes, loj_name: str, irs_bytes: bytes, irs_name: str):
    import io
    lf = io.BytesIO(loj_bytes); lf.name = loj_name
    rf = io.BytesIO(irs_bytes); rf.name = irs_name
    return load_logistics(lf), load_delivery_notes(rf)

try:
    loj, irs = _load(loj_file.getvalue(), loj_file.name, irs_file.getvalue(), irs_file.name)
except Exception as e:  # noqa: BLE001
    st.error(f"Dosya okunamadı: {e}")
    st.stop()

# --------------------------------------------------------------------------- #
# Manuel düzeltme (eşleşmeyen irsaliye numaraları)
# --------------------------------------------------------------------------- #
if "manual_map" not in st.session_state:
    st.session_state.manual_map = {}

result = merge_sources(loj, irs, st.session_state.manual_map)
s = result.stats

# --------------------------------------------------------------------------- #
# Eşleştirme özeti
# --------------------------------------------------------------------------- #
st.subheader("🔗 Eşleştirme Özeti")
c = st.columns(5)
c[0].metric("Lojistik satırı", s["lojistik_satir"])
c[1].metric("İrsaliye satırı", s["irsaliye_satir"])
c[2].metric("Eşleşen", s["eslesen"], help="Çoklu irsaliye taşıyan sevkiyatlar her irsaliye için ayrı satıra açılır.")
c[3].metric("Eşleşmeyen lojistik", s["lojistik_eslesmeyen"], delta=None if s["lojistik_eslesmeyen"] == 0 else "manuel kontrol", delta_color="inverse")
c[4].metric("Lojistik kaydı olmayan irsaliye", s["irsaliye_eslesmeyen"])

tab_fix, tab_auto, tab_irs, tab_prev = st.tabs([
    f"⚠️ Eşleşmeyen lojistik ({s['lojistik_eslesmeyen']})",
    f"🛠️ Otomatik düzeltmeler ({s['otomatik_duzeltme']})",
    f"📄 Lojistik kaydı olmayan irsaliyeler ({s['irsaliye_eslesmeyen']})",
    "👁️ Birleşik veri önizleme",
])

with tab_fix:
    if result.loj_unmatched.empty:
        st.success("Tüm lojistik kayıtları bir irsaliye ile eşleşti.")
    else:
        st.markdown(
            "Bu sevkiyatların irsaliye numarası boş, tanınmadı veya irsaliye listesinde yok. "
            "**Doğru İrsaliye No** sütununa numarayı yazıp *Uygula* deyin; birden fazla irsaliye için `1538-1539` gibi tire ile ayırın."
        )
        show_cols = [c for c in ["No", "Alıcı Adı", "Varış Yeri", "İrsaliye No (Ham)", "Anahtar Tipi", "Açıklama", "Teslim Alan", "Çıkış Zamanı"] if c in result.loj_unmatched.columns]
        edit = result.loj_unmatched[show_cols].drop_duplicates("No").copy()
        edit.insert(1, "Doğru İrsaliye No", [st.session_state.manual_map.get(str(n), "") for n in edit["No"]])
        edited = st.data_editor(edit, hide_index=True, width='stretch',
                                disabled=[c for c in edit.columns if c != "Doğru İrsaliye No"], key="fix_editor")
        if st.button("Düzeltmeleri uygula", type="primary"):
            for _, r in edited.iterrows():
                v = str(r["Doğru İrsaliye No"]).strip()
                if v:
                    st.session_state.manual_map[str(r["No"])] = v
                else:
                    st.session_state.manual_map.pop(str(r["No"]), None)
            st.rerun()

with tab_auto:
    if result.fixes.empty:
        st.success("Otomatik düzeltme gerekmedi.")
    else:
        st.markdown(
            "`kisa_no`: sadece rakam girilmiş, ön ek (**%s**) eklendi · `coklu`: birden fazla irsaliye, satır çoğaltıldı · "
            "`trim`: baş/son boşluk temizlendi · `bos`: numara yok · `manuel`: sizin girdiğiniz değer" % s["prefix"]
        )
        st.dataframe(result.fixes, hide_index=True, width='stretch')

with tab_irs:
    st.markdown("İrsaliye kesilmiş ama lojistik raporunda karşılığı yok (henüz sevk edilmemiş, başka taşıyıcı veya rapor dönemi dışı olabilir).")
    cols = [c for c in ["Fiş Numarası", "İrsaliye Zamanı", "Cari Hesap Unvanı", "Sevkiyat Adresi Açıklaması", "Fiş Net Toplamı"] if c in result.irs_unmatched.columns]
    st.dataframe(result.irs_unmatched[cols], hide_index=True, width='stretch')
    if not result.irs_unmatched.empty:
        st.bar_chart(result.irs_unmatched["Cari Hesap Unvanı"].value_counts())

# --------------------------------------------------------------------------- #
# Metrikler (ön izleme — Adım 2'de tam dashboard)
# --------------------------------------------------------------------------- #
metrics = compute_metrics(result.matched, sla)
cust = customer_summary(metrics)
k = kpi_summary(metrics)

with tab_prev:
    prev_cols = [c for c in ["No", "İrsaliye No", "Cari Hesap Unvanı", "Alıcı Adı", "İrsaliye Zamanı", "Talep Zamanı", "Çıkış Zamanı",
                             "Tahmini Teslimat Zamanı", "Teslim Tarihi", "Depo Hazırlık (saat)", "Sevk Teslim (saat)",
                             "Lojistik Taşıma (saat)", "Toplam Süre (saat)", "Gecikme (gün)", "Teslimat Durumu", "Aksayan Aşama"] if c in metrics.columns]
    st.dataframe(metrics[prev_cols].round(1), hide_index=True, width='stretch', height=420)

st.divider()
st.subheader("📊 Hızlı KPI Önizleme")
c = st.columns(6)
c[0].metric("Sevkiyat", k["toplam_sevkiyat"])
c[1].metric("Teslim edilen", k["teslim_edilen"], f"{k['teslim_bekleyen']} bekliyor", delta_color="off")
c[2].metric("Zamanında teslim", f"%{k['zamaninda_oran']*100:.0f}" if k["zamaninda_oran"] is not None else "-")
c[3].metric("Geciken", k["geciken"], f"ort. {k['ort_gecikme_gun']:.1f} gün", delta_color="inverse")
c[4].metric("Ort. taşıma", f"{k['ort_tasima']:.0f} sa" if k["ort_tasima"] else "-", f"hedef {sla['lojistik_tasima']['hedef']:.0f} sa", delta_color="off")
c[5].metric("Ort. toplam süre", f"{k['ort_toplam']:.0f} sa" if k["ort_toplam"] else "-", f"hedef {sla['toplam']['hedef']:.0f} sa", delta_color="off")

st.markdown("**Müşteri bazlı özet**")
st.dataframe(
    cust.style.format({"Zamanında Oranı": "{:.0%}", "Ort. Gecikme (gün)": "{:.1f}", "Ort. Depo Hazırlık (saat)": "{:.0f}",
                       "Ort. Taşıma (saat)": "{:.0f}", "Ort. Toplam (saat)": "{:.0f}"}, na_rep="-"),
    hide_index=True, width='stretch',
)

st.download_button(
    "⬇️ Birleşik analiz dosyasını indir (Excel)",
    data=to_excel_bytes(result, metrics, cust),
    file_name="teslimat_analizi.xlsx",
    mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
)
