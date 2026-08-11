// 地図（Leaflet + OpenStreetMap）。APIキー不要・無料。
// 緯度経度を持つ場所だけピンを立てる。ピンをタップすると詳細画面へ。
const MapView = (() => {
  let map = null;
  let layer = null;
  let fittedOnce = false;

  function ensureMap() {
    if (map) return map;
    if (!window.L) return null;
    // 初期位置は東京（現在地が取れるまでの仮表示）。取得できたら現在地中心・拡大に切り替える。
    map = L.map("map", { zoomControl: true }).setView([35.6812, 139.7671], 13);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    layer = L.layerGroup().addTo(map);
    return map;
  }

  function isOpen() {
    const wrap = document.getElementById("map-wrap");
    return wrap && !wrap.classList.contains("hidden");
  }

  // 一覧が変わったら呼ぶ。地図が閉じているときは何もしない（開いたときに描く）。
  function refresh(places) {
    if (!isOpen()) return;
    draw(places);
  }

  // 地図を開いたときに呼ぶ。Leaflet は非表示のまま初期化するとサイズを誤るので
  // 表示された後に invalidateSize() が要る。
  function show(places) {
    const m = ensureMap();
    if (!m) return;
    setTimeout(() => {
      m.invalidateSize();
      draw(places);
      centerOnCurrentLocationOnce(m);
    }, 0);
  }

  // 初回表示時だけ、現在地を中心にやや拡大した状態にする。
  // 取得できない/拒否された場合は fitBounds の結果のままにしておく。
  let locatedOnce = false;
  function centerOnCurrentLocationOnce(m) {
    if (locatedOnce) return;
    locatedOnce = true;
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        m.setView([pos.coords.latitude, pos.coords.longitude], 15);
      },
      () => {},
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 }
    );
  }

  function draw(places) {
    const m = ensureMap();
    if (!m || !layer) return;
    layer.clearLayers();
    const pts = [];
    (places || []).forEach((p) => {
      if (p.lat == null || p.lng == null) return;
      const vs = App.visitsOf(p.id);
      const last = vs.length ? vs[0].visited_on : null;
      const html =
        `<b>${Util.esc(p.name)}</b><br>` +
        (p.genre ? `${Util.esc(p.genre)}<br>` : "") +
        `${vs.length}回` + (last ? `・最後は ${Util.relDay(last)}` : "") +
        `<br><a href="#" data-open-place="${p.id}">くわしく見る</a>`;
      const mk = L.marker([p.lat, p.lng]).addTo(layer).bindPopup(html);
      pts.push([p.lat, p.lng]);
    });

    document.getElementById("map-empty").style.display = pts.length ? "none" : "block";

    if (pts.length && !fittedOnce) {
      m.fitBounds(pts, { padding: [30, 30], maxZoom: 16 });
      fittedOnce = true;
    }
  }

  // ポップアップ内の「くわしく見る」リンク（動的生成なので委譲で拾う）
  document.addEventListener("click", (e) => {
    const a = e.target.closest("[data-open-place]");
    if (!a) return;
    e.preventDefault();
    App.openDetail(a.dataset.openPlace);
  });

  return { show, refresh };
})();
window.MapView = MapView;
