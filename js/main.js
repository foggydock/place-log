// エントリーポイント：接続 → 認証チェック → ビュー切替
let plogInitDone = false;

(async function main() {
  const client = DB.init();
  if (!client) { showLogin(); return; }

  App.init();
  wireLogin();

  const session = await Auth.refreshSession();
  if (session) await startApp();
  else showLogin();

  plogInitDone = true;

  Auth.onChange((event) => {
    if (!plogInitDone) return;
    if (event === "SIGNED_OUT") location.reload();
  });
})();

function showLogin() {
  document.getElementById("app-header").style.display = "none";
  Util.showView("view-login");
}

async function startApp() {
  document.getElementById("app-header").style.display = "flex";
  await App.load();
  Util.showView("view-list");
  restoreMapState();
}

// 前回「地図を出す」にしていたら、次回も開いた状態で始める
function restoreMapState() {
  if (localStorage.getItem("plog_map_open") !== "1") return;
  const wrap = document.getElementById("map-wrap");
  wrap.classList.remove("hidden");
  document.getElementById("btn-map-toggle").textContent = "🗺️ 地図をしまう";
  MapView.show(App.getPlaces());
}

function wireLogin() {
  document.getElementById("login-form").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const btn = document.getElementById("btn-login");
    // 日本語入力がオンのまま打つと「＋」「＠」が全角になり、別のアドレス扱いで弾かれる。
    // NFKC で半角に寄せてから送る（パスワードは打った通りが正なので触らない）。
    const email = document.getElementById("login-email").value.trim().normalize("NFKC");
    const pw = document.getElementById("login-password").value;
    btn.disabled = true; btn.textContent = "ログイン中…";
    const { error } = await Auth.signInWithPassword(email, pw);
    if (error) {
      Util.showBanner(`ログインできません: ${error.message}`, "error");
      btn.disabled = false; btn.textContent = "ログイン";
      return;
    }
    location.reload();
  });
}
