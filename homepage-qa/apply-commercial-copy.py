from pathlib import Path
import json,re,html
p=Path("index.html")
s=p.read_text(encoding="utf-8")
data=json.loads(Path("homepage-qa/commercial-copy.json").read_text())
pattern=re.compile(r'<details class="commercial-service"[^>]*>.*?</details>',re.S)
matches=list(pattern.finditer(s))
assert len(matches)==5, f"Expected five commercial cards, got {len(matches)}"
def change(m):
    card=m.group()
    title=re.search(r'<strong>(.*?)</strong>',card,re.S)
    assert title
    item=next(d for d in data if d["title"]==html.unescape(title.group(1)))
    # Only replace the existing commercial-copy paragraph and list, retaining the original cards, photos and buttons.
    pos=card.index('class="commercial-copy"')
    before,copy=card[:pos],card[pos:]
    copy,n=re.subn(r'<p(?:\s[^>]*)?>.*?</p>',lambda _: '<p>'+html.escape(item["description"])+'</p>',copy,count=1,flags=re.S)
    assert n==1,item["title"]
    copy,n=re.subn(r'<ul(?:\s[^>]*)?>.*?</ul>',lambda _: '<ul>'+''.join('<li>'+html.escape(x)+'</li>' for x in item["services"])+'</ul>',copy,count=1,flags=re.S)
    assert n==1,item["title"]
    # Preserve the existing mailto as fallback, add a guided route as primary without altering unrelated links.
    copy,n=re.subn(r'(<a\b[^>]*\bhref=")mailto:[^"]+(")',lambda m:m.group(1)+item["route"]+m.group(2),copy,count=1)
    assert n==1,item["title"]
    return before+copy
out=pattern.sub(change,s)
assert out!=s
assert pattern.sub('',out)==pattern.sub('',s), "Changes outside commercial cards"
old_footer="Founded and led by Chengetayi Mapaya, Du Airlines Elite Academy brings together specialist athletic development, institutional consultancy and leadership engagements, supported by the Du Airlines Performance Hub."
new_footer="Du Airlines Elite Academy brings together Chengetayi Mapaya’s international sporting experience, specialist athletic development, institutional consultancy and leadership engagements, supported by the Du Airlines Performance Hub."
assert out.count(old_footer)==1, "Expected original footer wording"
out=out.replace(old_footer,new_footer,1)
# Keep the headline championship band unchanged; update only expanded honours.
old_grid='<div class="premium-more-grid"><span>7th at World Indoor Championships · Nanjing 2025</span><span>9× All-American</span><span>3× Zimbabwe Sportsman of the Year Runner-up · Junior 2016 &amp; 2017 · Senior 2019</span><span>International championship representation for Zimbabwe</span><span>African U20 Champion &amp; Championship Record Holder · 16.30m, 2017</span><span>17.26m Triple Jump Personal Best · TCU Outdoor Record</span><span>No. 4 on the World Triple Jump Season Performance List · 11 June 2022 (TCU Athletics)</span></div>'
groups=[
("International championships",["7th · World Indoor Championships, Nanjing 2025","African U20 Champion & Championship Record Setter"]),
("National recognition",["Zimbabwe Senior Indoor Triple Jump Record Setter","3× Zimbabwe Sportsman of the Year Runner-up · Junior & Senior"]),
("NCAA & conference honours",["9× NCAA All-American","5× Big 12 Champion","NCAA Indoor & Outdoor Championships Medalist"]),
("University honours & records",["TCU Co-Male Athlete of the Year · 2018–19","The Bowerman Preseason Watch List · 2020","TCU Indoor & Outdoor Triple Jump Record Setter","17.26m Triple Jump Personal Best"])
]
new_grid='<div class="premium-more-grid" style="grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));gap:12px">'+''.join('<div style="min-width:0;border:1px solid rgba(202,164,93,.45);border-radius:8px;padding:14px"><strong style="display:block;color:#DFC18A;margin-bottom:8px">'+html.escape(label)+'</strong><ul style="margin:0;padding-left:18px;line-height:1.5">'+''.join('<li>'+html.escape(x)+'</li>' for x in items)+'</ul></div>' for label,items in groups)+'</div>'
assert out.count(old_grid)==1,"Expected original expanded credentials"
assert out.count("Explore all credentials")==1,"Expected credentials label"
out=out.replace(old_grid,new_grid,1).replace("Explore all credentials","Career Honours &amp; International Achievements",1)
p.write_text(out,encoding="utf-8")
print("Five commercial cards updated; all other homepage content preserved.")
