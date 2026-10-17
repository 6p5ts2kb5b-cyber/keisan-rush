#!/usr/bin/env python3
"""store/screenshots/raw/*.png（1290x2796）に 見出しを つけて store/screenshots/6.7inch/ に 出力"""
import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter
D=os.path.join(os.path.dirname(__file__),'..')
RAW=os.path.join(D,'store/screenshots/raw');OUT=os.path.join(D,'store/screenshots/6.7inch');os.makedirs(OUT,exist_ok=True)
F=os.path.join(D,'fonts-src/ofl/zenmarugothic/ZenMaruGothic-Black.ttf')
CAP={'1_title':('小1〜中3の','さんすう・えいご・かんじ RPG'),'2_map':('学年ごとの 島を','ぼうけんしよう'),'3_battle':('正解すると こうげき！','はやいほど つよくなる'),
     '4_english':('英語は 読み上げつき','リスニングも ばっちり'),'5_kanji':('漢字の 書き順・画数も','楽しく おぼえる'),'6_cage':('つかまえた 虫を 育てて','進化・合体！')}
COL=['#ff9f6a','#ffd23f','#7ad88a','#6ab8ff','#ff8ab0','#b08aff']
for i,(k,(a,b)) in enumerate(CAP.items()):
    src=os.path.join(RAW,k+'.png')
    if not os.path.exists(src):continue
    W,H=1290,2796;img=Image.new('RGB',(W,H),'#fff8e8');d=ImageDraw.Draw(img)
    for y in range(H):
        t=y/H;c1=(255,248,232);c2=tuple(int(COL[i][j:j+2],16) for j in (1,3,5));c=tuple(int(c1[n]*(1-t*.55)+c2[n]*t*.55) for n in range(3));d.line([(0,y),(W,y)],fill=c)
    f1=ImageFont.truetype(F,104);f2=ImageFont.truetype(F,120)
    for txt,y,f in [(a,120,f1),(b,260,f2)]:
        sz=f.size
        while d.textlength(txt,font=f)>1180:sz-=6;f=ImageFont.truetype(F,sz)
        w=d.textlength(txt,font=f);d.text(((W-w)/2+5,y+6),txt,font=f,fill=(90,60,30,120));d.text(((W-w)/2,y),txt,font=f,fill='#3b2c1c')
    shot=Image.open(src).convert('RGB');sc=(H-470-70)/shot.height;sw,sh=int(shot.width*sc),int(shot.height*sc);shot=shot.resize((sw,sh),Image.LANCZOS)
    x0,y0=(W-sw)//2,470;sh_=Image.new('L',(W,H),0);ImageDraw.Draw(sh_).rounded_rectangle([x0+12,y0+24,x0+sw+12,y0+sh+24],60,fill=110);sh_=sh_.filter(ImageFilter.GaussianBlur(30))
    img.paste(Image.new('RGB',(W,H),'#5a4020'),(0,0),sh_)
    m=Image.new('L',(sw,sh),0);ImageDraw.Draw(m).rounded_rectangle([0,0,sw-1,sh-1],60,fill=255);img.paste(shot,(x0,y0),m)
    ImageDraw.Draw(img).rounded_rectangle([x0-6,y0-6,x0+sw+6,y0+sh+6],66,outline='#3b2c1c',width=12)
    img.save(os.path.join(OUT,k+'.png'));print(k)
