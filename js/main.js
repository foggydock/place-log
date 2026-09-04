// エントリーポイント：接続 → 認証チェック → ビュー切替
let plogInitDone = false;

// 全体の安全網：Supabaseが{error}を返すケースは各所で拾っているが、
// それとは別に「配列だと思ったら文字列だった」等の素のJS例外が
// クリック処理や描画の途中で起きると、拾う場所がどこにもなく、
// ボタンを押しても何も起きない・無言で固まる、という事故になる
// （ジャンルをtext[]化した際、実際にこれでログイン後の描画が
// 落ち、原因不明の「ログインできない」に見えた）。
// 何が起きても最低限バナーには出す、という最後の砦としてここに置く。
window.addEventListener("error", (ev) => {
  console.error(ev.error || ev.message);
  Util.showBanner?.(`エラーが発生しました: ${ev.error?.message || ev.message}`, "error");
});
window.addEventListener("unhandledrejection", (ev) => {
  console.error(ev.reason);
  Util.showBanner?.(`エラーが発生しました: ${ev.reason?.message || ev.reason}`, "error");
});

(async function main() {
  const client = DB.init();
  if (!client) { showLogin(); return; }

  App.init();
  wireLogin();

  const session = await Auth.refreshSession();
  if (session) {
    try {
      await startApp();
    } catch (e) {
      // 黙ってログイン画面に戻ると「ログインできない」と誤解される。必ず理由を出す。
      console.error(e);
      showLogin();
      Util.showBanner(`データの読み込みに失敗しました: ${e.message}`, "error");
    }
  } else {
    showLogin();
  }

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
    const raw = document.getElementById("login-email").value.trim();
    const email = raw.normalize("NFKC");
    const pw = document.getElementById("login-password").value;
    btn.disabled = true; btn.textContent = "ログイン中…";

    const fail = (msg) => {
      Util.showBanner(msg, "error");
      btn.disabled = false; btn.textContent = "ログイン";
    };

    const { error } = await Auth.signInWithPassword(email, pw);
    if (error) {
      // どのアドレスで試したかを必ず出す。別アプリ用のアドレスが
      // ブラウザの自動入力で紛れ込んでいても気づけるようにする。
      fail(`ログインできません（${email} で試行）: ${error.message}`);
      return;
    }

    // セッションが保存できたか確かめてから画面を切り替える。
    // 以前は無条件に reload していたため、保存に失敗すると
    // エラーも出ないままログイン画面に戻り、原因が分からなかった。
    const session = await Auth.refreshSession();
    if (!session) {
      fail("ログインは通りましたが、セッションを保存できませんでした。ブラウザのCookie／サイトデータのブロック設定を確認してください。");
      return;
    }
    // 読み込み・描画で落ちても「ログイン中…」のまま固まらないようにする。
    // 原因が画面に出ないと、ログインの失敗と見分けがつかなくなる。
    try {
      await startApp();
    } catch (e) {
      console.error(e);
      fail(`ログインはできましたが、データの読み込みで失敗しました: ${e.message}`);
    }
  });
}
