## HYROX Ticket Watch

HYROX sold-out ticket monitoring service for members.

현재 포함된 범위:

- Next.js App Router 기반 웹앱
- 회원용 인터랙티브 대시보드
- `GET /api/events`
- `GET /api/watchers`
- `POST /api/watchers`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- Prisma 스키마 초안
- 이메일 알림 MVP를 위한 데이터 구조
- 쿠키 세션 기반 데모 인증 흐름
- `DATABASE_URL` 존재 시 Prisma 경유, 없으면 mock fallback
- 모니터링 실행 서비스 / 이메일 큐 인터페이스 분리
- HYROX 수집기 fetch 우선, Playwright fallback 구조
- vivenu `__NEXT_DATA__` 기반 티켓 정의 추출과 옵션별 이름 매칭

## Getting Started

프로젝트 루트에서 로컬 Node 런타임을 먼저 활성화합니다.

```bash
source ../use-local-node.sh
```

그 다음 앱 폴더에서 실행합니다.

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:3000`을 열면 됩니다.

## Environment

`.env.example`을 참고해 `.env`를 만듭니다.

```bash
cp .env.example .env
```

로컬/배포 환경에서 `SESSION_SECRET`은 반드시 교체하는 것을 권장합니다.

## Database

Prisma 스키마는 `prisma/schema.prisma` 에 있습니다.

DB 연결 후 사용할 명령:

```bash
npm run db:generate
npm run db:push
npm run db:seed
```

현재 API는 DB 미연결 상태에서도 화면 개발이 가능하도록 mock 모드로 응답합니다.

브라우저 기반 수집 정확도를 높이려면 필요 시 Playwright 브라우저를 설치합니다.

```bash
npx playwright install chromium
```

실제 페이지 요청/응답과 렌더링 텍스트를 점검하려면 진단 스크립트를 실행합니다.

```bash
npm run diagnose:hyrox
```

결과는 `tmp/hyrox-diagnostics/` 아래에 저장됩니다.

## Vercel

Vercel 배포 전 준비:

```bash
npx vercel
```

배포 환경변수로 아래 항목을 넣습니다.

- `SESSION_SECRET`
- `DATABASE_URL`  설정 시 Prisma 데이터 모드로 전환
- `CRON_SECRET`  추후 모니터링 작업 보호용
- `RESEND_API_KEY`  설정 시 실제 이메일 공급자 연동 준비
- `HYROX_MONITOR_TIMEOUT_MS`
- `HYROX_MONITOR_URL_OVERRIDE`  티켓 URL 강제 override가 필요할 때 사용

## Next Steps

- Prisma 실제 연결
- 로그인 세션 구현
- 관심 티켓 CRUD UI 연결
- Playwright 수집기 정확도 개선
- Resend 이메일 발송 연결
