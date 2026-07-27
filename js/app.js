// 行った場所ノート：一覧・フォーム・詳細（訪問履歴）の画面ロジック
const App = (() => {
  let places = [];          // plog_places の全行
  let visits = [];          // plog_visits の全行
  let images = [];          // plog_images の全行
  let editingId = null;     // 編集中の場所ID（null なら新規）
  let detailId = null;      // 詳細表示中の場所ID
  let modalImageId = null;  // 画像モーダルで開いている画像ID
  let filterGenre = "";     // ジャンル絞り込み（空＝すべて）
  let filterTag = "";       // タグ絞り込み（空＝すべて）
  let searchText = "";
  let sortKey = "recent";
  let formStars = 0;
  let formRevisit = 0;
  let formLatLng = { lat: null, lng: null };

  const REVISIT_LABELS = { 0: "未設定", 1: "もういいかな", 2: "また行きたい", 3: "絶対また行く" };

  // ---------- データの導出 ----------

  // place_id -> その場所の訪問リスト（新しい順）
  function visitsOf(placeId) {
    return visits
      .filter((v) => v.place_id === placeId)
      .sort((a, b) => String(b.visited_on).localeCompare(String(a.visited_on)));
  }

  function lastVisitOf(placeId) {
    const vs = visitsOf(placeId);
    return vs.length ? vs[0].visited_on : null;
  }

  function getPlaces() { return places; }
  function getVisits() { return visits; }
  function findPlace(id) { return places.find((p) => p.id === id) || null; }

  function allGenres() {
    return [...new Set(places.map((p) => (p.genre || "").trim()).filter(Boolean))].sort();
  }

  function allTags() {
    const s = new Set();
    places.forEach((p) => (p.tags || []).forEach((t) => s.add(t)));
    return [...s].sort();
  }

  // ---------- 読み込み ----------

  async function load() {
    [places, visits, images] = await Promise.all([DB.listPlaces(), DB.listVisits(), DB.listImages()]);
    render();
  }

  function imagesOf(placeId) {
    return images
      .filter((i) => i.place_id === placeId)
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  }

  // ---------- 一覧の描画 ----------

  function visiblePlaces() {
    const q = searchText.trim().toLowerCase();
    let list = places.filter((p) => {
      if (filterGenre && (p.genre || "") !== filterGenre) return false;
      if (filterTag && !(p.tags || []).includes(filterTag)) return false;
      if (!q) return true;
      const hay = [
        p.name, p.genre, p.area, p.address, p.note,
        (p.tags || []).join(" "),
        visitsOf(p.id).map((v) => v.memo).join(" "),
      ].join(" ").toLowerCase();
      return hay.includes(q);
    });

    const cmp = {
      recent:  (a, b) => Util.daysSince(lastVisitOf(a.id)) - Util.daysSince(lastVisitOf(b.id)),
      stale:   (a, b) => Util.daysSince(lastVisitOf(b.id)) - Util.daysSince(lastVisitOf(a.id)),
      stars:   (a, b) => (b.stars || 0) - (a.stars || 0),
      revisit: (a, b) => (b.revisit || 0) - (a.revisit || 0),
      count:   (a, b) => visitsOf(b.id).length - visitsOf(a.id).length,
      created: (a, b) => String(b.created_at).localeCompare(String(a.created_at)),
      name:    (a, b) => String(a.name).localeCompare(String(b.name), "ja"),
    }[sortKey] || ((a, b) => 0);

    return list.sort(cmp);
  }

  function render() {
    renderFilters();
    renderList();
    document.getElementById("place-count").textContent =
      places.length ? `${places.length}か所 / ${visits.length}回` : "";
    if (window.MapView) MapView.refresh(visiblePlaces());
  }

  function renderFilters() {
    const genres = allGenres();
    const gBox = document.getElementById("genre-filter");
    if (!genres.length) {
      gBox.style.display = "none";
    } else {
      gBox.style.display = "flex";
      gBox.innerHTML =
        `<button type="button" class="chip ${filterGenre ? "" : "chip-on"}" data-genre="">すべて</button>` +
        genres.map((g) =>
          `<button type="button" class="chip ${filterGenre === g ? "chip-on" : ""}" data-genre="${Util.esc(g)}">${Util.esc(g)}</button>`
        ).join("");
    }

    const tags = allTags();
    const tBox = document.getElementById("tag-filter");
    if (!tags.length) {
      tBox.style.display = "none";
    } else {
      tBox.style.display = "flex";
      tBox.innerHTML = tags.map((t) =>
        `<button type="button" class="chip chip-tag ${filterTag === t ? "chip-on" : ""}" data-tag="${Util.esc(t)}">#${Util.esc(t)}</button>`
      ).join("");
    }
  }

  function starsHtml(n) {
    n = Number(n) || 0;
    if (!n) return "";
    return `<span class="stars">${"★".repeat(n)}<span class="stars-off">${"★".repeat(5 - n)}</span></span>`;
  }

  function cardHtml(p) {
    const vs = visitsOf(p.id);
    const last = vs.length ? vs[0].visited_on : null;
    const bits = [];
    if (p.genre) bits.push(`<span class="badge badge-genre">${Util.esc(p.genre)}</span>`);
    if (p.area)  bits.push(`<span class="badge">${Util.esc(p.area)}</span>`);
    if (p.revisit === 3) bits.push(`<span class="badge badge-hot">絶対また行く</span>`);
    return `
      <article class="card" data-id="${p.id}" tabindex="0">
        <div class="card-head">
          <h3 class="card-name">${Util.esc(p.name)}</h3>
          ${starsHtml(p.stars)}
        </div>
        <div class="card-badges">${bits.join("")}</div>
        <div class="card-meta">
          <span class="visit-count">${vs.length}回</span>
          ${last ? `<span class="visit-last">最後は ${Util.relDay(last)}</span>` : `<span class="visit-last dim">訪問日の記録なし</span>`}
          ${p.lat != null ? `<span class="pin-mark" title="地図にピンあり">📍</span>` : ""}
        </div>
        ${(p.tags || []).length ? `<div class="card-tags">${p.tags.map((t) => `<span class="tag">#${Util.esc(t)}</span>`).join("")}</div>` : ""}
        ${p.note ? `<p class="card-note">${Util.esc(p.note)}</p>` : ""}
      </article>`;
  }

  function renderList() {
    const list = visiblePlaces();
    const grid = document.getElementById("place-grid");
    const empty = document.getElementById("list-empty");
    grid.innerHTML = list.map(cardHtml).join("");
    if (!list.length) {
      empty.style.display = "block";
      empty.textContent = places.length
        ? "条件に合う場所がありません。検索や絞り込みを外してみてください。"
        : "まだ記録がありません。「＋ 行った場所」から最初の1件を入れてみましょう。";
    } else {
      empty.style.display = "none";
    }
  }

  // ---------- 詳細（訪問履歴） ----------

  function openDetail(id) {
    const p = findPlace(id);
    if (!p) return;
    detailId = id;
    const vs = visitsOf(id);

    document.getElementById("detail-name").textContent = p.name;
    const bits = [];
    if (p.genre) bits.push(`<span class="badge badge-genre">${Util.esc(p.genre)}</span>`);
    if (p.area)  bits.push(`<span class="badge">${Util.esc(p.area)}</span>`);
    if (p.revisit) bits.push(`<span class="badge">${REVISIT_LABELS[p.revisit]}</span>`);
    document.getElementById("detail-badges").innerHTML = bits.join("") + starsHtml(p.stars);

    const info = [];
    if (p.address) info.push(`<div class="detail-row"><span class="detail-label">場所</span>${Util.esc(p.address)}</div>`);
    if ((p.tags || []).length) info.push(`<div class="detail-row"><span class="detail-label">タグ</span>${p.tags.map((t) => `<span class="tag">#${Util.esc(t)}</span>`).join("")}</div>`);
    if (p.note) info.push(`<div class="detail-row"><span class="detail-label">メモ</span>${Util.nl2br(p.note)}</div>`);
    if (p.lat != null && p.lng != null) {
      const g = `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`;
      info.push(`<div class="detail-row"><span class="detail-label">座標</span>${p.lat.toFixed(5)}, ${p.lng.toFixed(5)} <a class="link" href="${g}" target="_blank" rel="noopener">地図で開く</a></div>`);
    }
    document.getElementById("detail-info").innerHTML = info.join("");

    renderImages(id);

    document.getElementById("detail-visit-count").textContent = `訪問 ${vs.length}回`;
    document.getElementById("visit-list").innerHTML = vs.length
      ? vs.map((v) => `
        <li class="visit-item" data-visit-id="${v.id}">
          <div class="visit-date">${Util.esc(v.visited_on)} <span class="dim">(${Util.relDay(v.visited_on)})</span></div>
          ${v.memo ? `<div class="visit-memo">${Util.nl2br(v.memo)}</div>` : ""}
          <button type="button" class="btn btn-ghost btn-xs btn-visit-del" data-visit-id="${v.id}">削除</button>
        </li>`).join("")
      : `<li class="empty-small">まだ訪問日の記録がありません。</li>`;

    Util.showView("view-detail");
  }

  // ---------- 画像（名刺・写真など） ----------

  async function renderImages(placeId) {
    const imgs = imagesOf(placeId);
    const grid = document.getElementById("image-grid");
    if (!imgs.length) { grid.innerHTML = ""; return; }
    grid.innerHTML = imgs.map((i) => `<button type="button" class="image-thumb" data-image-id="${i.id}"><img alt="" data-loading></button>`).join("");
    imgs.forEach(async (i) => {
      const url = await DB.getImageUrl(i.storage_path);
      const btn = grid.querySelector(`[data-image-id="${i.id}"] img`);
      if (btn && url) btn.src = url;
    });
  }

  async function uploadImages(fileList) {
    if (!detailId || !fileList || !fileList.length) return;
    Util.showBanner("画像をアップロード中…", "success");
    for (const file of fileList) {
      const { error } = await DB.uploadImage(detailId, file);
      if (error) { Util.showBanner(`アップロードできません: ${error.message}`, "error"); }
    }
    images = await DB.listImages();
    renderImages(detailId);
  }

  async function openImageModal(imageId) {
    const img = images.find((i) => i.id === imageId);
    if (!img) return;
    modalImageId = imageId;
    const url = await DB.getImageUrl(img.storage_path);
    document.getElementById("image-modal-img").src = url || "";
    document.getElementById("image-modal").classList.remove("hidden");
  }

  function closeImageModal() {
    modalImageId = null;
    document.getElementById("image-modal").classList.add("hidden");
    document.getElementById("image-modal-img").src = "";
  }

  async function deleteCurrentImage() {
    if (!modalImageId) return;
    const img = images.find((i) => i.id === modalImageId);
    if (!img) return;
    if (!confirm("この画像を削除します。よろしいですか？")) return;
    const { error } = await DB.deleteImage(img.id, img.storage_path);
    if (error) { Util.showBanner(`削除できません: ${error.message}`, "error"); return; }
    closeImageModal();
    images = await DB.listImages();
    renderImages(detailId);
    Util.showBanner("画像を削除しました", "success");
  }

  // ---------- フォーム ----------

  function setStars(n) {
    formStars = n;
    document.querySelectorAll("#star-input span").forEach((el) => {
      el.classList.toggle("on", Number(el.dataset.star) <= n);
    });
    document.getElementById("star-hint").textContent =
      n ? `よかった度 ${n}（もう一度タップで0に戻せます）` : "よかった度（任意・タップで設定）";
  }

  function setRevisit(n) {
    formRevisit = n;
    document.querySelectorAll("#revisit-input button").forEach((el) => {
      el.classList.toggle("chip-on", Number(el.dataset.revisit) === n);
    });
  }

  function setLatLng(lat, lng) {
    formLatLng = { lat, lng };
    const hint = document.getElementById("gps-status");
    if (lat == null) {
      hint.textContent = "現在地をとると地図にピンが立ちます（店名は自動では取れないので手入力です）";
      hint.classList.remove("ok");
      document.getElementById("btn-gps-clear").style.display = "none";
    } else {
      hint.textContent = `📍 ${lat.toFixed(5)}, ${lng.toFixed(5)} を記録します`;
      hint.classList.add("ok");
      document.getElementById("btn-gps-clear").style.display = "";
    }
  }

  function openNew() {
    editingId = null;
    document.getElementById("form-title").textContent = "行った場所をいれる";
    document.getElementById("place-form").reset();
    document.getElementById("f-visited-on").value = Util.todayStr();
    document.getElementById("first-visit-block").style.display = "";
    document.getElementById("btn-delete").style.display = "none";
    setStars(0); setRevisit(0); setLatLng(null, null);
    renderKnownLists();
    Util.showView("view-form");
    document.getElementById("f-name").focus();
  }

  function openEdit(id) {
    const p = findPlace(id);
    if (!p) return;
    editingId = id;
    document.getElementById("form-title").textContent = "場所をなおす";
    document.getElementById("f-name").value = p.name || "";
    document.getElementById("f-genre").value = p.genre || "";
    document.getElementById("f-area").value = p.area || "";
    document.getElementById("f-address").value = p.address || "";
    document.getElementById("f-tags").value = (p.tags || []).join(", ");
    document.getElementById("f-note").value = p.note || "";
    document.getElementById("first-visit-block").style.display = "none";
    document.getElementById("btn-delete").style.display = "";
    setStars(p.stars || 0); setRevisit(p.revisit || 0);
    setLatLng(p.lat ?? null, p.lng ?? null);
    renderKnownLists();
    Util.showView("view-form");
  }

  // 「これまで使ったジャンル/タグ」をタップで入れられるように出す
  function renderKnownLists() {
    const gs = allGenres();
    const gBox = document.getElementById("known-genres");
    gBox.style.display = gs.length ? "block" : "none";
    document.getElementById("known-genres-list").innerHTML =
      gs.map((g) => `<button type="button" class="chip chip-sm" data-set-genre="${Util.esc(g)}">${Util.esc(g)}</button>`).join("");

    const ts = allTags();
    const tBox = document.getElementById("known-tags");
    tBox.style.display = ts.length ? "block" : "none";
    document.getElementById("known-tags-list").innerHTML =
      ts.map((t) => `<button type="button" class="chip chip-sm" data-add-tag="${Util.esc(t)}">#${Util.esc(t)}</button>`).join("");
  }

  async function save(ev) {
    ev.preventDefault();
    const name = document.getElementById("f-name").value.trim();
    if (!name) { Util.showBanner("場所の名前を入れてください", "error"); return; }

    const row = {
      name,
      genre:   document.getElementById("f-genre").value.trim(),
      area:    document.getElementById("f-area").value.trim(),
      address: document.getElementById("f-address").value.trim(),
      tags:    Util.parseTags(document.getElementById("f-tags").value),
      note:    document.getElementById("f-note").value.trim(),
      stars:   formStars,
      revisit: formRevisit,
      lat:     formLatLng.lat,
      lng:     formLatLng.lng,
    };

    const btn = document.getElementById("btn-save");
    btn.disabled = true; btn.textContent = "保存中…";

    let placeId = editingId;
    if (editingId) {
      const { error } = await DB.updatePlace(editingId, row);
      if (error) { Util.showBanner(`保存できません: ${error.message}`, "error"); btn.disabled = false; btn.textContent = "保存"; return; }
    } else {
      const { data, error } = await DB.insertPlace(row);
      if (error) { Util.showBanner(`保存できません: ${error.message}`, "error"); btn.disabled = false; btn.textContent = "保存"; return; }
      placeId = data.id;
      // 新規のときは初回の訪問も一緒に記録する
      const visitedOn = document.getElementById("f-visited-on").value || Util.todayStr();
      const memo = document.getElementById("f-visit-memo").value.trim();
      const r = await DB.insertVisit({ place_id: placeId, visited_on: visitedOn, memo });
      if (r.error) Util.showBanner(`場所は保存しましたが訪問日を記録できません: ${r.error.message}`, "error");
    }

    btn.disabled = false; btn.textContent = "保存";
    await load();
    Util.showBanner(editingId ? "なおしました" : "記録しました", "success");
    if (editingId) openDetail(placeId);
    else Util.showView("view-list");
  }

  async function removePlace() {
    if (!editingId) return;
    const p = findPlace(editingId);
    const n = visitsOf(editingId).length;
    if (!confirm(`「${p?.name}」を削除します。訪問履歴${n}件も一緒に消えます。よろしいですか？`)) return;
    const { error } = await DB.deletePlace(editingId);
    if (error) { Util.showBanner(`削除できません: ${error.message}`, "error"); return; }
    editingId = null;
    await load();
    Util.showBanner("削除しました", "success");
    Util.showView("view-list");
  }

  // ---------- また行った（訪問の追記） ----------

  function openAddVisit() {
    if (!detailId) return;
    document.getElementById("v-date").value = Util.todayStr();
    document.getElementById("v-memo").value = "";
    document.getElementById("visit-modal").classList.remove("hidden");
    document.getElementById("v-date").focus();
  }

  function closeAddVisit() {
    document.getElementById("visit-modal").classList.add("hidden");
  }

  async function saveVisit(ev) {
    ev.preventDefault();
    if (!detailId) return;
    const visited_on = document.getElementById("v-date").value || Util.todayStr();
    const memo = document.getElementById("v-memo").value.trim();
    const { error } = await DB.insertVisit({ place_id: detailId, visited_on, memo });
    if (error) { Util.showBanner(`記録できません: ${error.message}`, "error"); return; }
    closeAddVisit();
    await load();
    openDetail(detailId);
    Util.showBanner("訪問を追記しました", "success");
  }

  async function removeVisit(visitId) {
    const v = visits.find((x) => x.id === visitId);
    if (!v) return;
    if (!confirm(`${v.visited_on} の訪問記録を削除します。よろしいですか？`)) return;
    const { error } = await DB.deleteVisit(visitId);
    if (error) { Util.showBanner(`削除できません: ${error.message}`, "error"); return; }
    await load();
    openDetail(detailId);
  }

  // ---------- 配線 ----------

  function init() {
    document.getElementById("btn-new").addEventListener("click", openNew);
    document.getElementById("place-form").addEventListener("submit", save);
    document.getElementById("btn-cancel").addEventListener("click", () => {
      if (editingId) openDetail(editingId); else Util.showView("view-list");
    });
    document.getElementById("btn-delete").addEventListener("click", removePlace);

    document.getElementById("search-input").addEventListener("input", Util.debounce((e) => {
      searchText = e.target.value; render();
    }, 150));

    document.getElementById("sort-select").addEventListener("change", (e) => {
      sortKey = e.target.value; render();
    });

    document.getElementById("genre-filter").addEventListener("click", (e) => {
      const b = e.target.closest("[data-genre]"); if (!b) return;
      filterGenre = b.dataset.genre; render();
    });

    document.getElementById("tag-filter").addEventListener("click", (e) => {
      const b = e.target.closest("[data-tag]"); if (!b) return;
      filterTag = (filterTag === b.dataset.tag) ? "" : b.dataset.tag; render();
    });

    document.getElementById("place-grid").addEventListener("click", (e) => {
      const card = e.target.closest(".card"); if (!card) return;
      openDetail(card.dataset.id);
    });
    document.getElementById("place-grid").addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      const card = e.target.closest(".card"); if (!card) return;
      openDetail(card.dataset.id);
    });

    // 詳細画面
    document.getElementById("btn-detail-back").addEventListener("click", () => Util.showView("view-list"));
    document.getElementById("btn-detail-edit").addEventListener("click", () => openEdit(detailId));
    document.getElementById("btn-add-visit").addEventListener("click", openAddVisit);
    document.getElementById("f-image-input").addEventListener("change", (e) => {
      uploadImages(e.target.files);
      e.target.value = "";
    });
    document.getElementById("image-grid").addEventListener("click", (e) => {
      const b = e.target.closest("[data-image-id]"); if (!b) return;
      openImageModal(b.dataset.imageId);
    });
    document.getElementById("btn-image-close").addEventListener("click", closeImageModal);
    document.getElementById("btn-image-delete").addEventListener("click", deleteCurrentImage);
    document.getElementById("image-modal").addEventListener("click", (e) => {
      if (e.target.id === "image-modal") closeImageModal();
    });
    document.getElementById("visit-list").addEventListener("click", (e) => {
      const b = e.target.closest(".btn-visit-del"); if (!b) return;
      removeVisit(b.dataset.visitId);
    });

    // 訪問追記モーダル
    document.getElementById("visit-form").addEventListener("submit", saveVisit);
    document.getElementById("btn-visit-cancel").addEventListener("click", closeAddVisit);
    document.getElementById("visit-modal").addEventListener("click", (e) => {
      if (e.target.id === "visit-modal") closeAddVisit();
    });

    // ★とまた行きたい度
    document.getElementById("star-input").addEventListener("click", (e) => {
      const s = e.target.closest("[data-star]"); if (!s) return;
      const n = Number(s.dataset.star);
      setStars(n === formStars ? 0 : n);
    });
    document.getElementById("revisit-input").addEventListener("click", (e) => {
      const b = e.target.closest("[data-revisit]"); if (!b) return;
      const n = Number(b.dataset.revisit);
      setRevisit(n === formRevisit ? 0 : n);
    });

    // 現在地
    document.getElementById("btn-gps").addEventListener("click", async () => {
      const btn = document.getElementById("btn-gps");
      const hint = document.getElementById("gps-status");
      btn.disabled = true; hint.textContent = "現在地を確認中…"; hint.classList.remove("ok");
      try {
        const { lat, lng } = await Util.getCurrentPosition();
        setLatLng(lat, lng);
      } catch (err) {
        hint.textContent = err.message;
        hint.classList.remove("ok");
      } finally {
        btn.disabled = false;
      }
    });
    document.getElementById("btn-gps-clear").addEventListener("click", () => setLatLng(null, null));

    // 既存ジャンル/タグのタップ入力
    document.getElementById("known-genres-list").addEventListener("click", (e) => {
      const b = e.target.closest("[data-set-genre]"); if (!b) return;
      document.getElementById("f-genre").value = b.dataset.setGenre;
    });
    document.getElementById("known-tags-list").addEventListener("click", (e) => {
      const b = e.target.closest("[data-add-tag]"); if (!b) return;
      const input = document.getElementById("f-tags");
      const cur = Util.parseTags(input.value);
      if (!cur.includes(b.dataset.addTag)) cur.push(b.dataset.addTag);
      input.value = cur.join(", ");
    });

    document.getElementById("btn-backup").addEventListener("click", () => Backup.menu());
    document.getElementById("btn-logout").addEventListener("click", async () => {
      await Auth.signOut();
      location.reload();
    });

    // 地図の表示切替
    document.getElementById("btn-map-toggle").addEventListener("click", () => {
      const wrap = document.getElementById("map-wrap");
      const on = wrap.classList.toggle("hidden");
      document.getElementById("btn-map-toggle").textContent = on ? "🗺️ 地図を出す" : "🗺️ 地図をしまう";
      localStorage.setItem("plog_map_open", on ? "0" : "1");
      if (!on && window.MapView) MapView.show(visiblePlaces());
    });
  }

  return {
    init, load, render, getPlaces, getVisits, visitsOf, lastVisitOf, findPlace, openDetail,
  };
})();
window.App = App;
