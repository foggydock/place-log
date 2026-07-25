// Supabase クライアントと CRUD ラッパー（行った場所ノート）
const DB = (() => {
  let client = null;

  function init() {
    const cfg = window.PLOG_CONFIG;
    if (!cfg || !cfg.SUPABASE_URL || cfg.SUPABASE_ANON_KEY.startsWith("PASTE_") ||
        cfg.SUPABASE_URL.includes("YOUR-PROJECT")) {
      Util.showBanner("js/config.js に Supabase の URL と Publishable key を設定してください", "error");
      return null;
    }
    if (!window.supabase) {
      Util.showBanner("Supabase JS が読み込めていません（ネット未接続？）", "error");
      return null;
    }
    client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
    return client;
  }

  function getClient() { return client; }

  // 全件取得（1000件上限を超えてもページネーションで全部取る）
  async function _listAll(table, orderCol, ascending = false) {
    if (!client) return [];
    let all = [];
    let from = 0;
    const step = 1000;
    while (true) {
      const { data, error } = await client
        .from(table)
        .select("*")
        .order(orderCol, { ascending })
        .range(from, from + step - 1);
      if (error) {
        Util.showBanner(`読み込みエラー: ${error.message}`, "error");
        return all;
      }
      if (!data || data.length === 0) break;
      all = all.concat(data);
      if (data.length < step) break;
      from += step;
    }
    return all;
  }

  function listPlaces() { return _listAll("plog_places", "created_at", false); }
  function listVisits() { return _listAll("plog_visits", "visited_on", false); }

  async function insertPlace(row) {
    if (!client) return { error: { message: "未接続" } };
    const payload = { ...row, user_id: window.Auth?.getUserId?.() || undefined };
    return await client.from("plog_places").insert(payload).select().single();
  }

  async function updatePlace(id, fields) {
    if (!client) return { error: { message: "未接続" } };
    return await client.from("plog_places").update(fields).eq("id", id).select().single();
  }

  async function deletePlace(id) {
    if (!client) return { error: { message: "未接続" } };
    // plog_visits は on delete cascade なので訪問履歴も一緒に消える
    const { error } = await client.from("plog_places").delete().eq("id", id);
    return { error };
  }

  async function insertVisit(row) {
    if (!client) return { error: { message: "未接続" } };
    const payload = { ...row, user_id: window.Auth?.getUserId?.() || undefined };
    return await client.from("plog_visits").insert(payload).select().single();
  }

  async function updateVisit(id, fields) {
    if (!client) return { error: { message: "未接続" } };
    return await client.from("plog_visits").update(fields).eq("id", id).select().single();
  }

  async function deleteVisit(id) {
    if (!client) return { error: { message: "未接続" } };
    const { error } = await client.from("plog_visits").delete().eq("id", id);
    return { error };
  }

  // バックアップ復元用：id ごとに upsert
  async function upsertRows(table, rows) {
    if (!client) return { error: { message: "未接続" } };
    const uid = window.Auth?.getUserId?.() || undefined;
    const payload = rows.map((r) => ({ ...r, user_id: uid }));
    return await client.from(table).upsert(payload, { onConflict: "id" }).select();
  }

  return {
    init, getClient,
    listPlaces, insertPlace, updatePlace, deletePlace,
    listVisits, insertVisit, updateVisit, deleteVisit,
    upsertRows,
  };
})();
window.DB = DB;
