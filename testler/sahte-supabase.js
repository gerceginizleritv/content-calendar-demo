// Tarayici testinde gercek Supabase'e cikamiyoruz (bu ortamda ag kapali).
// Yerine ayni arayuzu tasiyan bir taklit koyuyoruz: uygulama farki
// anlamiyor, biz de hangi satirlarin yazildigini gorebiliyoruz.
window.__yazmalar = [];
(function(){
  const veri = window.__VERI__;   // { locations:[], calendar_events:[] }
  function sorgu(tablo){
    let satirlar = (veri[tablo] || []).slice();
    const b = {
      select(){ return b; },
      eq(){ return b; },
      is(){ return b; },
      in(_c, ids){ b._ids = ids; return b; },
      upsert(rows){
        window.__yazmalar.push({ tablo, islem:'upsert', adet: rows.length,
                                 kimlikler: rows.map(r=>r.id) });
        return Promise.resolve({ data: rows, error: null });
      },
      update(alanlar){
        b._update = alanlar;
        const p = Promise.resolve({ data: [], error: null });
        p.in = (c, ids) => { window.__yazmalar.push({ tablo, islem:'sil', adet: ids.length, kimlikler: ids });
                             return Promise.resolve({ data: [], error: null }); };
        return p;
      },
      then(res){ return Promise.resolve({ data: satirlar, error: null }).then(res); }
    };
    return b;
  }
  window.supabase = {
    createClient(){
      return {
        auth: {
          getSession: () => Promise.resolve({ data:{ session: window.__OTURUM__ } }),
          signInWithOAuth: () => Promise.resolve({ error: null }),
          signOut: () => Promise.resolve({ error: null })
        },
        from: sorgu
      };
    }
  };
})();
