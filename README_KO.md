# 물 만난 고릴라 키우기 — 온라인 서버 시작판

이 폴더는 계정 로그인, 온라인 플레이어 목록, 서버 저장 데이터, 개발자 전용 보상 지급 API가 포함된 Node.js 서버 시작판입니다. **아직 게임 HTML과 로그인/보상 API가 완전히 연결된 상태는 아닙니다.** 현재 `public/index.html`은 기존 게임 복사본입니다. 서버를 켜는 것만으로 기존 게임의 개발자 버튼이 온라인 지급 기능으로 바뀌지는 않습니다.

## 1. 준비
- Node.js 20 이상 설치
- 이 폴더에서 터미널 열기
- `npm install`
- `.env.example`을 참고해 환경 변수 설정

## 2. 환경 변수 설정
환경 변수에 아래 값을 넣으세요. 실제 공개 서버에서는 비밀번호/키를 코드에 적거나 깃허브에 올리지 마세요.
- `PORT=3000`
- `JWT_SECRET`: 32자 이상의 무작위 비밀 문자열
- `DEVELOPER_NICKNAME=개발자`
- `DEVELOPER_PASSWORD`: 12자 이상 강한 비밀번호

Windows PowerShell 예시:
```powershell
$env:PORT="3000"
$env:JWT_SECRET="여기에_충분히_긴_무작위_비밀키_입력"
$env:DEVELOPER_NICKNAME="개발자"
$env:DEVELOPER_PASSWORD="여기에_12자_이상_강한_비밀번호"
npm install
npm start
```
브라우저에서 `http://localhost:3000`을 엽니다.

## API
- `POST /api/register` — 일반 계정 생성 `{name,password}`
- `POST /api/login` — 일반 계정 로그인
- `POST /api/developer/login` — 서버 환경변수로 지정된 개발자 계정 로그인
- `GET /api/players` — 인증된 플레이어 목록
- `GET /api/me` — 내 서버 저장 데이터
- `PUT /api/me/save` — 내 저장 데이터 저장 `{save:{...}}`
- `POST /api/heartbeat` — 온라인 상태 갱신 `{level}`
- `GET /api/rewards` — 로그인한 플레이어의 보상 수령
- `POST /api/developer/grant` — 개발자만 가능 `{targetId,reward:{type:...}}`

모든 API 경로는 `/api` 아래에 있으며, 로그인 후 `Authorization: Bearer <token>` 헤더가 필요합니다(회원가입/로그인 제외). 개발자 보상 권한은 서버에서 검사합니다.

## 공개 배포
이 서버는 현재 로컬에서 실행하는 시작판입니다. 다른 컴퓨터에서도 접속하려면 Node.js를 지원하는 호스팅에 배포하고 HTTPS를 설정해야 합니다. `data.json`은 파일 저장 방식이므로 호스팅이 디스크를 초기화하는 환경에서는 영구 데이터베이스로 교체해야 합니다. 공개 서비스 전에 HTML을 서버 API에 연결하고 실제 게임 저장 형식에 맞춘 보상 검증/적용을 구현해야 합니다.
