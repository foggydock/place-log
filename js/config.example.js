// Supabase 接続設定の「テンプレート」（公開可・実際の鍵は入れない）
//
// 使い方：このファイルを js/config.js にコピーして、実際の値を貼る。
//   cp js/config.example.js js/config.js
//
// Publishable key（旧 anon key）は公開しても安全（RLS で守られる）。secret key は絶対に入れない。

window.PLOG_CONFIG = {
  SUPABASE_URL:      "https://YOUR-PROJECT.supabase.co",
  SUPABASE_ANON_KEY: "PASTE_YOUR_PUBLISHABLE_KEY_HERE",
};
