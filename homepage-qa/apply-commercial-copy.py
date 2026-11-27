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
p.write_text(out,encoding="utf-8")
print("Five commercial cards updated; all other homepage content preserved.")
