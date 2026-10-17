#!/usr/bin/env python3
"""App Store 版（iPhone アプリ）用の www/ を つくる スクリプト。

  python3 appstore/tools/build_app.py

- リポジトリの index.html（Web版）から、App Store 版の appstore/www/index.html を つくる
- 古着編（西海岸・東海岸・日本編）を 外す（他社の商標を ふくむため）
- Google Fonts を やめて、アプリの中に 入れた フォント（OFL）を 使う → ネットなしで 動く
- 裏機能「たま」を 外す（DEVWORD を 入れた ときだけ 有効）
- アプリ内に「クレジット・ライセンス」画面を 追加
- 保存データを Capacitor Preferences にも バックアップ（iOS が 消しても もどせる）
フォントの サブセット化には fonttools が 必要（pip install fonttools）。
"""
import os, re, sys, json, shutil, subprocess

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
APP = os.path.join(ROOT, 'appstore')
WWW = os.path.join(APP, 'www')
FONTSRC = os.environ.get('FONTSRC', os.path.join(APP, 'fonts-src'))
DEVWORD = os.environ.get('DEVWORD', '')  # 開発者だけが 知っている 合言葉（空なら 裏機能なし）

src = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
s = src

def rep(a, b, count=1):
    global s
    n = s.count(a)
    if n != count:
        sys.exit(f'置きかえ失敗（{n}件）: {a[:80]}')
    s = s.replace(a, b)

# 1) 古着編を 外す
rep("const pkList=()=>['kanken','suken','eiken','chu','sea','land','sky','asia','eu','oki','west','east','jpn','ura']",
    "const pkList=()=>['kanken','suken','eiken','chu','sea','land','sky','asia','eu','oki','ura']")

# 2) 裏機能（たま）
rep("const devTama=()=>slotName()==='たま';",
    "const devTama=()=>!!window.DEVWORD&&slotName()===window.DEVWORD;")

# 2b) 検定の 名前（他団体の 商標）を 一般的な よび方に
for x, y in [('英検Jr.', 'えいごジュニア'), ('英検', '英語テスト'), ('漢検', '漢字テスト'), ('算数検定', '算数テスト'), ('数学検定', '数学テスト')]:
    s = s.replace(x, y)

# 3) Google Fonts → アプリ内フォント
s = re.sub(r'<link rel="preconnect" href="https://fonts\.googleapis\.com">\s*', '', s)
s = re.sub(r'<link rel="preconnect" href="https://fonts\.gstatic\.com" crossorigin>\s*', '', s)
s = re.sub(r'<link rel="stylesheet" href="https://fonts\.googleapis\.com/css2[^"]*">', '<link rel="stylesheet" href="fonts/fonts.css">', s)
if 'fonts.googleapis.com' in s:
    sys.exit('Google Fonts の 読みこみが のこっています')

# 4) アプリ用の 設定・クレジット・バックアップ
head_inject = ('<meta name="format-detection" content="telephone=no">\n'
               f'<script>window.APPSTORE=1;window.DEVWORD={json.dumps(DEVWORD)};</script>\n')
rep('<link rel="stylesheet" href="fonts/fonts.css">', head_inject + '<link rel="stylesheet" href="fonts/fonts.css">')

credits_btn = '<button class="appcred" id="appCred" type="button">ⓘ クレジット・ライセンス</button>'
rep('<p class="plank">小1 → 中3　さんすう・えいご・かんじ RPG</p>',
    '<p class="plank">小1 → 中3　さんすう・えいご・かんじ RPG</p>' + credits_btn)

credits = open(os.path.join(APP, 'tools', 'credits.html'), encoding='utf-8').read()
app_js = open(os.path.join(APP, 'tools', 'app_extra.js'), encoding='utf-8').read()
i = s.rindex('</body>') if '</body>' in s else s.rindex('</html>')
s = s[:i] + credits + '\n<script>\n' + app_js + '\n</script>\n' + s[i:]

os.makedirs(WWW, exist_ok=True)
open(os.path.join(WWW, 'index.html'), 'w', encoding='utf-8').write(s)
print('www/index.html を つくりました', len(s) // 1024, 'KB')

# 5) フォント（使っている 文字だけに しぼる）
FONTS = [
    ('Dela Gothic One', 400, 'delagothicone/DelaGothicOne-Regular.ttf', 'dela-400'),
    ('M PLUS Rounded 1c', 500, 'mplusrounded1c/MPLUSRounded1c-Medium.ttf', 'mplus-500'),
    ('M PLUS Rounded 1c', 800, 'mplusrounded1c/MPLUSRounded1c-ExtraBold.ttf', 'mplus-800'),
    ('Zen Maru Gothic', 700, 'zenmarugothic/ZenMaruGothic-Bold.ttf', 'zenmaru-700'),
    ('Zen Maru Gothic', 900, 'zenmarugothic/ZenMaruGothic-Black.ttf', 'zenmaru-900'),
    ('Klee One', 600, 'kleeone/KleeOne-SemiBold.ttf', 'klee-600'),
]
chars = set(s)
# かな・英数・記号は ぜんぶ 入れる（名前入力などのため）
for a, b in [(0x20, 0x7e), (0x3000, 0x30ff), (0xff00, 0xffef), (0x2000, 0x206f), (0x2190, 0x21ff), (0x25a0, 0x25ff), (0x2600, 0x26ff)]:
    chars.update(chr(c) for c in range(a, b + 1))
text = ''.join(sorted(c for c in chars if c.isprintable()))
fdir = os.path.join(WWW, 'fonts')
os.makedirs(fdir, exist_ok=True)
open(os.path.join(fdir, 'chars.txt'), 'w', encoding='utf-8').write(text)
css = []
if not os.path.isdir(os.path.join(FONTSRC, 'ofl')):
    print('⚠ フォントの 元ファイルが ありません:', FONTSRC, '\n  git clone --depth 1 --filter=blob:none --sparse https://github.com/google/fonts appstore/fonts-src && cd appstore/fonts-src && git sparse-checkout set ofl/delagothicone ofl/zenmarugothic ofl/mplusrounded1c ofl/kleeone')
else:
    for fam, w, rel, out in FONTS:
        dst = os.path.join(fdir, out + '.woff')
        subprocess.run([sys.executable, '-m', 'fontTools.subset', os.path.join(FONTSRC, 'ofl', rel),
                        '--text-file=' + os.path.join(fdir, 'chars.txt'), '--flavor=woff',
                        '--layout-features=*', '--output-file=' + dst], check=True)
        css.append(f"@font-face{{font-family:'{fam}';font-weight:{w};font-style:normal;font-display:swap;src:url('{out}.woff') format('woff')}}")
        print('  ', out, os.path.getsize(dst) // 1024, 'KB')
    open(os.path.join(fdir, 'fonts.css'), 'w').write('\n'.join(css) + '\n')
    for d in ['zenmarugothic', 'delagothicone', 'kleeone']:
        shutil.copy(os.path.join(FONTSRC, 'ofl', d, 'OFL.txt'), os.path.join(fdir, f'OFL-{d}.txt'))
os.remove(os.path.join(fdir, 'chars.txt'))
print('できあがり:', WWW)
