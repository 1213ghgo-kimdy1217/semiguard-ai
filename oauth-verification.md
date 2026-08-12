# OAuth 검증 기록

2026-08-12 검증 결과:

- 모바일 뷰포트 390x844에서 `/login` 화면이 정상적으로 표시됨.
- 회사 명찰 번호·비밀번호 로그인 폼과 Google·Naver·Kakao 버튼이 화면 안에 들어옴.
- `/login?oauth_error=google` 접근 시 원문 JSON 오류 대신 사용자가 이해할 수 있는 Google 로그인 실패 안내 배너가 표시됨.
- 개발 서버 재시작 후 TypeScript 오류가 없고 서버가 포트 3000에서 실행됨.
- Kakao Client Secret 검증 테스트가 통과함.

남은 실제 검증:
- 실제 Google·Naver·Kakao 계정으로 로그인하여 각 제공자 콘솔의 redirect URI 설정까지 확인해야 함.

## 2026-08-12 Google 재로그인 검증

사용자가 배포된 로그인 페이지에서 Google 버튼을 눌렀고, Google 계정의 기존 인증 세션과 동의 기록으로 별도 계정 입력 없이 인증 후 대시보드로 이동했다. 브라우저에서 `/api/trpc/auth.me`를 호출한 결과 HTTP 200이며 `loginMethod: "google"`, `openId: "google_108663582798959432999"`가 반환되었다. 이전의 `google_undefined` 문제는 재현되지 않았고 사이트 세션 쿠키와 대시보드 보호 라우팅이 정상 작동했다.

## 2026-08-12 최신 배포 재로그인 검증

사용자가 최신 배포본에서 로그아웃 후 Google 버튼을 눌렀고, 기존 Google 인증 세션으로 자동 로그인되어 대시보드에 도착했다. `/api/trpc/auth.me`는 HTTP 200을 반환했고 `loginMethod: "google"`, `openId: "google_108663582798959432999"`를 확인했다. `google_undefined`는 재현되지 않았다.
