# MornContract

MornContract 鏄竴涓熀浜?Next.js App Router 鐨勬暟瀛楀悎鍚屽钩鍙帮紝鏀寔鍚堝悓鍒涘缓銆佸垎鏋愩€佺缃层€佸鍑恒€佸洟闃熷崗浣溿€佹枃妗ｉ獙鐪熶笌璁㈤槄鏀粯銆? 
椤圭洰閲囩敤 **CN / INTL 鍙屽尯鍩熸灦鏋?*锛屽悓涓€濂椾唬鐮佹牴鎹幆澧冨彉閲忚嚜鍔ㄥ垏鎹㈣璇併€佹暟鎹簱涓庢敮浠樿兘鍔涖€?
## 鏍稿績鑳藉姏

- 鍚堝悓鍏ㄦ祦绋嬶細鍒涘缓銆佺紪杈戙€丄I 杈呭姪鍒嗘瀽/鐢熸垚銆佺缃层€佸鍑猴紙PDF/Word/HTML锛?- 宸ヤ綔鍙颁笌鍥㈤槦锛欴ashboard銆佹ā鏉跨鐞嗐€佹垚鍛橀個璇枫€佹枃妗ｅ簱銆佽处鍗曢〉
- 澶氭敮浠樻帴鍏ワ細寰俊鏀粯銆佹敮浠樺疂銆丼tripe锛堝惈 webhook 涓庣姸鎬佸悓姝ワ級
- 鍖哄煙鍒嗘祦锛氭寜閮ㄧ讲鍖哄煙鍒囨崲璁よ瘉/鏁版嵁搴?鏀粯閫氶亾
- 瀹夊叏娌荤悊锛氳璇佷繚鎶ゃ€佷腑闂翠欢鏍￠獙銆丆SRF銆侀槻鍒枫€佽繍琛屾椂閰嶇疆鏍￠獙
- 鍙娴嬫€э細涓氬姟閾捐矾鏃ュ織銆佸叧閿祦绋嬫不鐞嗘祴璇?
## 鍖哄煙鍙屾爤璁捐

褰撳墠閮ㄧ讲閰嶇疆锛坄lib/config/deployment.config.ts`锛夛細

- `CN`
  - 璁よ瘉锛欳loudBase锛堥偖绠?鎵嬫満楠岃瘉鐮佺瓑锛?  - 鏁版嵁搴擄細CloudBase
  - 鏀粯锛歐eChat Pay銆丄lipay
- `INTL`
  - 璁よ瘉锛歋upabase
  - 鏁版嵁搴擄細Supabase
  - 鏀粯锛歋tripe锛堝綋鍓嶉厤缃富閫氶亾锛?
> 鍖哄煙鐢变互涓嬪彉閲忓喅瀹氾細`NEXT_PUBLIC_DEPLOYMENT_REGION`（唯一真源，`APP_REGION` / `NEXT_PUBLIC_APP_REGION` 仅兼容过渡）銆?
## 鎶€鏈爤

- Next.js 15 + React 19 + TypeScript
- Tailwind CSS + Radix UI
- Supabase / CloudBase 鍙屾暟鎹眰
- Stripe / WeChat / Alipay锛堜唬鐮佸眰锛?- Jest + ts-jest锛堟牳蹇冩不鐞嗕笌鍥炲綊娴嬭瘯锛?
## 蹇€熷紑濮?
### 1) 鐜瑕佹眰

- Node.js 20+
- npm 10+

### 2) 瀹夎渚濊禆

```bash
npm install
```

### 3) 鍒濆鍖栫幆澧冩枃浠?
```powershell
Copy-Item .env.cn.example .env.cn
Copy-Item .env.intl.example .env.intl
```

> `scripts/use-env.mjs` 浼氭妸鐩爣鐜澶嶅埗鍒?`.env.local`銆? 
> 姣忔鍒囨崲鍖哄煙閮戒細瑕嗙洊 `.env.local`銆?
### 4) 鍚姩寮€鍙戠幆澧?
```bash
# CN锛堥粯璁わ級
npm run dev:cn

# INTL
npm run dev:intl
```

涔熷彲鍙垏鎹㈢幆澧冭€屼笉鍚姩锛?
```bash
npm run env:cn
npm run env:intl
```

## 甯哥敤鍛戒护

```bash
# 寮€鍙?npm run dev
npm run dev:cn
npm run dev:intl

# 鏋勫缓
npm run build
npm run build:cn
npm run build:intl

# 璐ㄩ噺妫€鏌?npm run lint
npm test
npm run test:mainline
npm run test:region-consistency
npm run test:release-gate

# 鍖哄煙鏁版嵁鍒濆鍖?/ 杩佺Щ
npm run db:workspace:cn
npm run db:workspace:intl
npm run db:workspace:rollout
```

## 鍏抽敭鐜鍙橀噺锛堟渶灏忛泦锛?
### CN

- 鍖哄煙涓庡煙鍚嶏細`NEXT_PUBLIC_DEPLOYMENT_REGION=CN`銆乣APP_URL`
- CloudBase锛歚NEXT_PUBLIC_WECHAT_CLOUDBASE_ID`銆乣CLOUDBASE_SECRET_ID`銆乣CLOUDBASE_SECRET_KEY`
- 閴存潈锛歚JWT_SECRET`
- 寰俊鏀粯锛歚WECHAT_PAY_MCH_ID`銆乣WECHAT_PAY_API_V3_KEY`銆乣WECHAT_PAY_SERIAL_NO`銆乣WECHAT_PAY_PRIVATE_KEY`銆乣WECHAT_PAY_PLATFORM_PUBLIC_KEY`
- 鏀粯瀹濓細`ALIPAY_APP_ID`銆乣ALIPAY_PRIVATE_KEY`銆乣ALIPAY_ALIPAY_PUBLIC_KEY`
- AI锛歚DASHSCOPE_API_KEY`

### INTL

- 鍖哄煙涓庡煙鍚嶏細`NEXT_PUBLIC_DEPLOYMENT_REGION=INTL`銆乣APP_URL`
- Supabase锛歚NEXT_PUBLIC_SUPABASE_URL`銆乣NEXT_PUBLIC_SUPABASE_ANON_KEY`銆乣SUPABASE_SERVICE_ROLE_KEY`
- 閴存潈锛歚JWT_SECRET`
- Stripe锛歚NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`銆乣STRIPE_SECRET_KEY`銆乣STRIPE_WEBHOOK_SECRET`
- AI锛歚OPENAI_API_KEY`

## 椤圭洰缁撴瀯

```text
app/                   # 椤甸潰涓?API 璺敱锛圓pp Router锛?  api/                 # 鎸変笟鍔″煙鎷嗗垎鐨勬湇鍔＄鎺ュ彛
components/            # 涓氬姟缁勪欢涓?UI 缁勪欢
lib/                   # 涓氬姟鏍稿績锛坅uth/payment/contracts/dashboard/security/...锛?supabase/              # SQL schema 涓?migrations
scripts/               # 鐜鍒囨崲銆佽縼绉汇€佸垵濮嬪寲鑴氭湰
tests/                 # 娌荤悊涓荤嚎涓庡洖褰掓祴璇?docs/qa/               # 鍥炲綊鐭╅樀涓庢祦绋嬫枃妗?```

## API 妯″潡姒傝

`app/api` 褰撳墠涓昏鍒嗙粍锛?
- `auth`锛氱櫥褰曘€佹敞鍐屻€佸埛鏂般€佷細璇濅笌鎵惧洖娴佺▼
- `contracts`锛氬悎鍚?CRUD銆佸垎鏋愩€佺敓鎴愩€佸鍑?- `dashboard`锛氭瑙堛€佹ā鏉裤€佸洟闃熴€佹枃妗ｃ€佽处鍗?- `payment`锛氬垱寤恒€佺‘璁ゃ€佺姸鎬併€亀ebhook銆佷竴娆℃€ф敮浠?- `admin`锛氱鐞嗙鐢ㄦ埛銆佺増鏈€佸垎鏋愩€佽闃呫€佸璁?- `public` / `team-invites`锛氬叕寮€楠岀湡涓庨個璇风浉鍏虫帴鍙?
## 璐ㄩ噺涓庡彂甯冨缓璁?
- 鏈湴鏈€灏忓彂甯冮棬绂侊細`npm run lint && npm run test:release-gate && npm run build`
- 鍖哄煙涓€鑷存€у彂甯冮棬绂侊細棰濆鎵ц `npm run test:region-consistency`
- 鍥炲綊鐭╅樀鍙傝€冿細`docs/qa/region-dual-stack-regression-matrix.md`

## 宸茬煡绾︽潫

- `middleware.ts` 瀵瑰彈淇濇姢璺敱浼氬仛鐧诲綍鏍￠獙涓庤鑹插垽鏂€?- 閮ㄥ垎鍦板尯璁块棶绛栫暐鐢变腑闂翠欢涓庡湴鐞嗘娴嬮€昏緫鎺у埗銆?- 绾夸笂蹇呴』瀹屾暣閰嶇疆鍖哄煙瀵瑰簲鐨勯壌鏉冦€佹暟鎹簱銆佹敮浠樺瘑閽ワ紙灏ゅ叾寰俊骞冲彴鍏挜涓?Stripe webhook secret锛夈€?
## License

MIT

