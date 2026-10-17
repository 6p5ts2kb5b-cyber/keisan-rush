# まなびラッシュ App Store 公開ガイド

この フォルダ（appstore/）に、App Store に 出す ための ものが そろっています。
**無料版も 有料版も アプリの 中身は 同じ**です。App Store Connect の 価格で 切りかえます（職場の 返事を 待つ 間も 準備を 進められます）。

## 入っている もの
| 場所 | なに |
|---|---|
| `www/` | App Store 版の ゲーム本体（古着編なし・フォント内蔵・オフラインで 動く） |
| `tools/build_app.py` | Web版（../index.html）から `www/` を 作りなおす スクリプト |
| `assets/` | アイコン（1024×1024）と 起動画面 |
| `capacitor.config.json` / `package.json` | iPhone アプリに する ための 設定（Capacitor） |
| `tools/ios_setup.sh` | iPhone専用・たて画面・カメラ説明文などを 設定 |
| `../codemagic.yaml` | Mac なしで 組み立てる ときの 設定（Codemagic） |
| `store/metadata_ja.md` | App Store Connect に 入力する 文章（コピペ用） |
| `store/screenshots/6.7inch/` | スクリーンショット 6枚 |
| `../privacy.html` / `../support.html` | プライバシーポリシー・サポートページ（GitHub Pages で 公開ずみ） |

### App Store 版で 変えて いる こと
- 古着編（西海岸・東海岸・日本編）を 外す（他社の 商標を ふくむ ため）
- 「英検・漢検・算数検定」を「英語テスト・漢字テスト・算数テスト」に（他団体の 商標の ため）
- Google Fonts を やめ、フォントを アプリに 内蔵（ネット なしで 動く）
- 裏機能「たま」は 外す（`DEVWORD=あいことば python3 tools/build_app.py` で 自分だけの 合言葉に できる）
- タイトルに「クレジット・ライセンス」画面を 追加
- セーブデータを iOS の 保存領域にも バックアップ

---

## ステップ 0：最初に 1回だけ（あなた）
1. **Apple Developer Program に 登録**（年99ドル）— developer.apple.com/programs
2. **App ID を 作る**：Certificates, Identifiers & Profiles → Identifiers → ＋ → App IDs → Bundle ID に `jp.manabirush.app`
   - ほかの 人が 使っていて エラーに なったら `jp.（好きな英字）.manabirush` などに 変えて、`capacitor.config.json` の `appId` と `codemagic.yaml` の `bundle_identifier` も 同じに する。
3. **App Store Connect で アプリを 作る**：マイApp → ＋ → 新規App → iOS・名前「まなびラッシュ」・日本語・Bundle ID・SKU（`store/metadata_ja.md` を 見てね）
   - 名前が すでに 使われて いたら「まなびラッシュ 学習RPG」などに。

## ステップ 1A：Mac が ある 場合
```bash
# 必要な もの：Xcode（App Store から 無料）、Node.js 20、CocoaPods（sudo gem install cocoapods）
git clone https://github.com/6p5ts2kb5b-cyber/keisan-rush.git
cd keisan-rush/appstore
git clone --depth 1 --filter=blob:none --sparse https://github.com/google/fonts fonts-src
(cd fonts-src && git sparse-checkout set ofl/delagothicone ofl/zenmarugothic ofl/mplusrounded1c ofl/kleeone)
pip3 install fonttools
python3 tools/build_app.py      # www/ を 最新に（もう 入って いるので 省略 OK）
npm install
npx cap add ios                 # 1回目だけ
npx capacitor-assets generate --ios
npx cap sync ios
bash tools/ios_setup.sh
npx cap open ios                # Xcode が ひらく
```
Xcode で：
1. 左の「App」→ Signing & Capabilities → Team に 自分の チームを えらぶ
2. 上の 端末えらびを「Any iOS Device (arm64)」に
3. メニュー Product → Archive → できたら「Distribute App」→「App Store Connect」→ Upload

## ステップ 1B：Mac が ない 場合（Codemagic）
1. codemagic.io に GitHub で ログインして、このリポジトリを 追加（無料枠で 月500分）
2. App Store Connect → ユーザとアクセス → 統合 → **App Store Connect API キー** を 作る（役割：App Manager）。.p8 ファイルを ダウンロード
3. Codemagic → Teams → Integrations → Developer Portal → キーを 登録。名前を **`manabi_asc_key`** に する
4. Codemagic の アプリ設定 → codemagic.yaml を 使う。
5. ビルド開始：GitHub で `app-v1.0.0` の ような タグを つけて push すると 自動で ビルド → TestFlight に とどく
   ```bash
   git tag app-v1.0.0 && git push origin app-v1.0.0
   ```
   （Codemagic の 画面の「Start new build」でも OK）

## ステップ 2：審査に 出す（あなた）
1. App Store Connect → アプリ → 1.0 の ページで、`store/metadata_ja.md` の 文章を コピペ
2. スクリーンショット 6枚（`store/screenshots/6.7inch/`）を アップロード
3. 「ビルド」で アップロードした ものを えらぶ（届くまで 10〜30分）
4. App のプライバシー：「データを 収集していない」
5. 年齢制限：すべて「なし」→ 4+
6. **価格**：
   - 無料版 → 「無料」
   - 有料版 → 価格を えらぶ ＋「契約／税金／口座情報」で 有料アプリ契約を 先に 完了
7. 「審査に 提出」→ ふつう 1〜3日

### TestFlight で 先に ためす（おすすめ）
審査の 前に、TestFlight アプリで 自分や 家族の iPhone に 入れて ためせます（内部テスター は 審査なし）。

## アップデートの しかた
1. Web版（index.html）を 直す
2. `appstore/package.json` の `version` を 上げる（例 1.0.1）
3. `python3 tools/build_app.py` → `npx cap sync ios` → `bash tools/ios_setup.sh` → Archive（または タグ `app-v1.0.1` を push）
4. App Store Connect で 新しい バージョンを 作って 提出

## 審査で よく ある 指摘と 対応
| 指摘 | 対応 |
|---|---|
| 4.2 最低限の 機能（Web を 包んだ だけ） | 全部 オフラインで 動く・内蔵 ゲームで ある ことを 審査メモに 書いて ある |
| 5.2 知的財産 | 古着編・検定名を 外して ある |
| 5.1.1 プライバシー | データ収集なし・カメラは 端末内のみ と 説明文と 審査メモに 書いて ある |
| 2.1 クラッシュ／動かない | TestFlight で 先に ためす |

## 公務員として（メモ）
- 無料・広告なし・課金なし なら 収入は 発生しない。有料に する ときは 職場の 許可を 取ってから 価格を 設定する。
- 個人で 登録すると App Store の 開発者名に 本名が 出る。
- 有料で 収入が 出たら、給与以外の 所得 年20万円を こえると 確定申告（住民税は 金額に 関係なく 申告）。
