import json, os, pathlib, subprocess, urllib.error, urllib.request
API=os.environ['GH_API_URL'].rstrip('/')
REPO=os.environ['GH_REPOSITORY']
TOKEN=os.environ['GH_TOKEN']
BRANCH='exp/artifact-cleanup-kawai-01'
H={'Authorization':f'Bearer {TOKEN}','Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'}
def get(path):
    q=urllib.request.Request(API+path,headers=H)
    with urllib.request.urlopen(q) as r:
        raw=r.read(); return (r.status,dict(r.headers),json.loads(raw) if raw else None)
result={'run_id':os.environ.get('GITHUB_RUN_ID')}
try:
    status,headers,body=get('/rate_limit')
    result['rate_limit_status']=status
    result['rate_limit']=body
    result['rate_limit_headers']={k:v for k,v in headers.items() if k.lower().startswith('x-ratelimit')}
except Exception as e:
    result['rate_limit_error']=repr(e)
try:
    status,headers,body=get(f'/repos/{REPO}/actions/artifacts?per_page=1&page=1')
    result['artifact_probe']={'status':status,'headers':{k:v for k,v in headers.items() if k.lower().startswith('x-ratelimit')},'body_keys':sorted(body.keys()) if isinstance(body,dict) else None}
except urllib.error.HTTPError as e:
    result['artifact_probe']={'status':e.code,'headers':{k:v for k,v in e.headers.items() if k.lower().startswith('x-ratelimit')},'body':e.read().decode('utf-8','replace')[:1000]}
except Exception as e:
    result['artifact_probe']={'error':repr(e)}
p=pathlib.Path('infra/EXP_ARTIFACT_CLEANUP_KAWAI_01_rate_probe.json')
p.write_text(json.dumps(result,indent=2,sort_keys=True)+'\n',encoding='utf-8')
subprocess.run(['git','config','user.name','github-actions[bot]'],check=True)
subprocess.run(['git','config','user.email','41898282+github-actions[bot]@users.noreply.github.com'],check=True)
subprocess.run(['git','add',str(p)],check=True)
subprocess.run(['git','commit','-m','infra(exp): persist cleanup API rate probe'],check=True)
subprocess.run(['git','push','origin',f'HEAD:refs/heads/{BRANCH}'],check=True)
print(json.dumps(result,sort_keys=True))
