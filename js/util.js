// 小さな共通ユーティリティ
const Util = (() => {
  function showView(id) {
    document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
    const el = document.getElementById(id);
    if (el) el.classList.add("active");
    window.scrollTo(0, 0);
  }

  let bannerTimer = null;
  function showBanner(msg, type = "info") {
    let b = document.getElementById("banner");
    if (!b) {
      b = document.createElement("div");
      b.id = "banner";
      document.body.appendChild(b);
    }
    b.textContent = msg;
    b.className = `banner banner-${type} show`;
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => b.classList.remove("show"), 4000);
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function nl2br(s) { return esc(s).replace(/\n/g, "<br>"); }

  function todayStr() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  // "YYYY-MM-DD" -> "今日 / 昨日 / N日前 / Nか月前 / YYYY-MM-DD"
  function relDay(dateStr) {
    if (!dateStr) return "";
    const then = new Date(String(dateStr).slice(0, 10) + "T00:00:00");
    if (isNaN(then)) return "";
    const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const days = Math.round((startOfDay(new Date()) - startOfDay(then)) / 86400000);
    if (days <= 0) return "今日";
    if (days === 1) return "昨日";
    if (days < 30) return `${days}日前`;
    if (days < 365) return `${Math.floor(days / 30)}か月前`;
    return `${Math.floor(days / 365)}年前`;
  }

  // 「ごぶさた順」の並び替え用：最終訪問日からの経過日数（未訪問は大きい値）
  function daysSince(dateStr) {
    if (!dateStr) return 99999;
    const then = new Date(String(dateStr).slice(0, 10) + "T00:00:00");
    if (isNaN(then)) return 99999;
    return Math.round((Date.now() - then.getTime()) / 86400000);
  }

  function debounce(fn, ms = 200) {
    let t = null;
    return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  }

  // "tag1, tag2 , tag3" -> ["tag1","tag2","tag3"]（前後#や空白を除去・重複排除）
  function parseTags(str) {
    return [...new Set(
      String(str || "")
        .split(/[,、\n]/)
        .map((t) => t.trim().replace(/^#+/, ""))
        .filter(Boolean)
    )];
  }

  // 端末のGPSで現在地の緯度経度を取る（店名は取れない＝手入力）。
  // HTTPS（GitHub Pages）か localhost でのみ動く。許可ダイアログが出る。
  function getCurrentPosition(timeoutMs = 12000) {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("この端末では現在地を取得できません"));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy }),
        (err) => {
          const msg = err.code === 1 ? "位置情報が許可されていません（端末の設定で許可してください）"
                    : err.code === 3 ? "現在地の取得がタイムアウトしました"
                    : "現在地を取得できませんでした";
          reject(new Error(msg));
        },
        { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30000 }
      );
    });
  }

  // 2点間の距離（km）。緯度経度どちらか欠けていたら null。
  function distanceKm(lat1, lng1, lat2, lng2) {
    if (lat1 == null || lng1 == null || lat2 == null || lng2 == null) return null;
    const R = 6371;
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  return { showView, showBanner, esc, nl2br, todayStr, relDay, daysSince, debounce, parseTags, getCurrentPosition, distanceKm };
})();
window.Util = Util;
