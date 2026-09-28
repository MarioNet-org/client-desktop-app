# MarioNet Client

Electron + Svelte 기반의 MarioNet Client 데스크톱 앱이다.

## 실행 방법

Node.js 22.15 이상이 필요하다.

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

`.env`의 `MARIONET_API_URL`에 MarioNet 서버 주소를 지정한다. 기본값은 `http://127.0.0.1:4000`이다.

## 일반 빌드

```powershell
npm run build
```

일반 빌드는 타입 검사와 renderer 번들링만 수행한다.

## Windows 앱 패키징

```powershell
npm run package:portable   # 설치 없이 실행하는 Portable 앱
npm run package:installer  # NSIS 설치 프로그램
npm run package            # 두 형식 모두
```

패키징 결과는 `release/`에 생성된다. 패키징된 앱을 실행하는 PC에는 Node.js가 필요하지 않다. 앱 실행 시 MarioNet API 서버는 별도로 실행되어 있어야 한다.

## 테스트

```powershell
npm run check
npm test
```
