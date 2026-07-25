// バックアップ：JSON（復元用）/ Markdown（読む用）の書き出し、JSON の取り込み
const Backup = (() => {
  function stamp() {
    const d = new Date(), p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
  }

  function download(filename, text, mime) {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportJson() {
    const places = App.getPlaces();
    const visits = App.getVisits();
    const payload = { app: "place-log", version: 1, exported_at: new Date().toISOString(), places, visits };
    download(`行った場所ノート_backup_${stamp()}.json`, JSON.stringify(payload, null, 2), "application/json");
    Util.showBanner(`${places.length}か所 / ${visits.length}回をJSONで書き出しました`, "success");
  }

  function exportMarkdown() {
    const places = App.getPlaces();
    const lines = [`# 行った場所ノート（${new Date().toLocaleString("ja-JP")} 時点・${places.length}か所）`, ""];
    places.forEach((p) => {
      const star = p.stars ? " " + "★".repeat(p.stars) : "";
      lines.push(`## ${p.name}${star}`);
      if (p.genre) lines.push(`- ジャンル：${p.genre}`);
      if (p.area) lines.push(`- エリア：${p.area}`);
      if (p.address) lines.push(`- 場所：${p.address}`);
      if (p.lat != null && p.lng != null) lines.push(`- 座標：${p.lat}, ${p.lng}`);
      if ((p.tags || []).length) lines.push(`- タグ：${p.tags.map((t) => "#" + t).join(" ")}`);
      if (p.note) lines.push(`- メモ：${p.note.replace(/\n/g, " ")}`);
      const vs = App.visitsOf(p.id);
      if (vs.length) {
        lines.push(`- 訪問（${vs.length}回）：`);
        vs.forEach((v) => lines.push(`    - ${v.visited_on}${v.memo ? "　" + v.memo.replace(/\n/g, " ") : ""}`));
      }
      lines.push("");
    });
    download(`行った場所ノート_backup_${stamp()}.md`, lines.join("\n"), "text/markdown");
    Util.showBanner(`${places.length}か所をMarkdownで書き出しました`, "success");
  }

  function importJson() {
    const input = document.createElement("input");
    input.type = "file"; input.accept = "application/json,.json";
    input.addEventListener("change", async () => {
      const file = input.files[0]; if (!file) return;
      let parsed;
      try { parsed = JSON.parse(await file.text()); }
      catch { Util.showBanner("JSONを読めませんでした", "error"); return; }
      const places = parsed.places, visits = parsed.visits;
      if (!Array.isArray(places) || places.length === 0) { Util.showBanner("場所データが見つかりません", "error"); return; }
      if (!confirm(`${places.length}か所 / ${(visits || []).length}回を取り込みます（同じIDは上書き）。よろしいですか？`)) return;
      // 場所を先に入れる（訪問が place_id を参照するため順番は必須）
      const r1 = await DB.upsertRows("plog_places", places);
      if (r1.error) { Util.showBanner(`取り込み失敗（場所）: ${r1.error.message}`, "error"); return; }
      if (Array.isArray(visits) && visits.length) {
        const r2 = await DB.upsertRows("plog_visits", visits);
        if (r2.error) { Util.showBanner(`取り込み失敗（訪問）: ${r2.error.message}`, "error"); return; }
      }
      Util.showBanner("取り込みました", "success");
      await App.load();
    });
    input.click();
  }

  function menu() {
    const choice = prompt(
      "バックアップ：番号を入力してください\n" +
      "  1 = JSONで書き出す（復元用）\n" +
      "  2 = Markdownで書き出す（読む用）\n" +
      "  3 = JSONから取り込む（復元）"
    );
    if (choice === "1") exportJson();
    else if (choice === "2") exportMarkdown();
    else if (choice === "3") importJson();
  }

  return { menu, exportJson, exportMarkdown, importJson };
})();
window.Backup = Backup;
