# OAuth·환경변수 설정 가이드

> **목적:** 이 문서는 SemiGuard AI를 ChatGPT의 도움을 받아 다른 개발·배포 환경에서 실행할 때, 로그인 기능을 안전하게 다시 설정하는 방법을 설명합니다. 실제 비밀값은 이 파일·GitHub·ChatGPT 대화에 넣지 않습니다.

## 1. 중요한 구분

현재 Manus에 배포된 SemiGuard AI는 환경변수와 일부 플랫폼 인증 구성을 관리형 환경에서 주입받습니다. 따라서 **현재 공개 사이트의 로그인 기능을 유지하기 위해 기존 키를 복사할 필요는 없습니다.** 다른 호스팅 환경으로 옮기거나 로컬에서 소셜 로그인을 검증하려는 경우에만 새 환경에서 필요한 키를 설정합니다.

| 구분 | ChatGPT·GitHub에 올려도 되는 것 | 올리면 안 되는 것 |
| --- | --- | --- |
| 환경 설정 | 변수 이름, 콜백 경로, 설정 순서, `ENVIRONMENT_VARIABLE_TEMPLATE.md` | 실제 값이 입력된 `.env` 파일 |
| OAuth | Client ID의 자리 표시자, 제공자 콘솔 설정 절차 | Client Secret, Access Token, Refresh Token |
| 로그인 | 오류 문구, 비식별 테스트 절차 | 비밀번호, 세션 쿠키, 사용자 인증 정보 |

## 2. 현재 코드가 참조하는 핵심 환경변수

아래 변수 이름은 `server/_core/env.ts`에 정의되어 있습니다. [환경변수 이름 템플릿](ENVIRONMENT_VARIABLE_TEMPLATE.md)에는 이름만 있으며, 실제 값은 배포 환경의 Secrets 또는 환경변수 설정에 직접 입력합니다.

| 변수 | 용도 | ChatGPT에 실제 값 제공 여부 |
| --- | --- | --- |
| `DATABASE_URL` | MySQL/TiDB 데이터베이스 연결 문자열 | 제공 금지 |
| `JWT_SECRET` | 로그인 세션 서명 비밀값 | 제공 금지 |
| `GOOGLE_CLIENT_ID` | Google OAuth 앱 식별자 | 자리 표시자만 허용 |
| `GOOGLE_CLIENT_SECRET` | Google OAuth 앱 비밀값 | 제공 금지 |
| `NAVER_CLIENT_ID` | Naver OAuth 앱 식별자 | 자리 표시자만 허용 |
| `NAVER_CLIENT_SECRET` | Naver OAuth 앱 비밀값 | 제공 금지 |
| `KAKAO_CLIENT_ID` | Kakao OAuth 앱 식별자 | 자리 표시자만 허용 |
| `KAKAO_CLIENT_SECRET` | Kakao OAuth 앱 비밀값 | 제공 금지 |
| `VITE_APP_ID` | Manus 관리형 OAuth 앱 식별자 | 다른 환경에서는 별도 인증 구조 검토 |
| `OAUTH_SERVER_URL` | Manus OAuth 서버 주소 | 다른 환경에서는 별도 인증 구조 검토 |
| `BUILT_IN_FORGE_API_KEY` | Manus AI·스토리지 등 서버 측 API 키 | 제공 금지 |

## 3. 소셜 로그인 콜백 주소

현재 서버 구현은 아래 세 콜백 경로를 확인합니다. 새 환경의 각 OAuth 제공자 콘솔에 **배포 도메인으로 바꾼 동일 경로**를 등록해야 합니다. 예를 들어 새 도메인이 `https://example.com`이라면 Google 콜백은 `https://example.com/api/oauth/google/callback`입니다.

| 제공자 | 등록할 Redirect URI |
| --- | --- |
| Google | `{APP_ORIGIN}/api/oauth/google/callback` |
| Naver | `{APP_ORIGIN}/api/oauth/naver/callback` |
| Kakao | `{APP_ORIGIN}/api/oauth/kakao/callback` |

콜백 주소에는 임의의 쿼리 문자열을 붙이지 않습니다. 현재 구현은 OAuth `state` 값과 브라우저 쿠키의 nonce를 비교하고, 제공자별 콜백 경로가 일치할 때만 토큰 교환을 진행합니다.

## 4. 다른 환경에서의 안전한 설정 순서

1. 저장소를 복제한 뒤 [환경변수 이름 템플릿](ENVIRONMENT_VARIABLE_TEMPLATE.md)을 참고해 **로컬 전용 `.env` 파일**을 만듭니다. `.env`는 Git에 커밋하지 않습니다.
2. 새 배포 환경에서 사용할 Google·Naver·Kakao 개발자 콘솔에 새 OAuth 앱을 만들거나, 기존 앱의 허용된 Redirect URI에 새 도메인을 직접 추가합니다.
3. 각 제공자의 Client ID·Client Secret을 새 배포 환경의 **Secrets/환경변수 설정 화면**에 직접 입력합니다. ChatGPT 대화창이나 코드 파일에는 붙여 넣지 않습니다.
4. `JWT_SECRET`은 새 환경마다 충분히 긴 무작위 값으로 새로 만듭니다. 예: `openssl rand -base64 48`로 생성한 값을 Secrets 화면에만 저장합니다.
5. 개발 환경에서 회원가입·일반 로그인·소셜 계정 연결·연결 후 로그인·실패 경로를 차례대로 검증합니다. 실제 계정이 아닌 별도 테스트 계정을 사용합니다.
6. Redirect URI 불일치, 쿠키 `SameSite`/`Secure` 설정, 도메인 HTTPS 여부를 점검한 뒤에만 운영 도메인에서 검증합니다.

## 5. ChatGPT에 요청하는 예시

ChatGPT에는 실제 키를 주지 말고 아래와 같이 요청합니다.

> “첨부한 `ENVIRONMENT_VARIABLE_TEMPLATE.md`와 `OAUTH_SETUP_GUIDE.md`를 기준으로 소셜 로그인 오류를 점검해 주세요. 실제 Client Secret·JWT Secret·DB URL은 공유하지 않습니다. 필요한 변수 이름, Redirect URI, 코드 변경 위치와 테스트 방법만 알려 주세요.”

## 6. 흔한 문제와 먼저 확인할 항목

| 증상 | 먼저 확인할 내용 |
| --- | --- |
| Redirect URI 오류 | 제공자 콘솔의 URI가 도메인·프로토콜·경로까지 정확히 일치하는지 |
| 로그인 뒤 화면 복귀 실패 | `/api/oauth/{provider}/callback` 뒤 `/login` 또는 `/`으로 돌아가는지 |
| 계정 연결 실패 | 일반 회원가입·로그인 후 ‘연결’ 모드로 시작했는지 |
| 운영에서만 쿠키가 사라짐 | HTTPS, `Secure`, `SameSite`와 도메인이 일치하는지 |
| 서버에서 키를 읽지 못함 | 환경변수 이름 오타와 배포 환경의 Secrets 설정 여부 |

## 7. 현재 프로젝트의 로그인 정책

SemiGuard AI에서는 일반 회원가입 후에만 Google·Naver·Kakao 계정을 연결할 수 있습니다. 소셜 계정만으로 새 로컬 계정을 만드는 흐름은 의도적으로 허용하지 않습니다. 이 정책과 실제 콜백 검증 로직은 `server/_core/socialOAuth.ts`와 관련 테스트에서 관리합니다.

> **최종 주의:** ChatGPT가 코드를 도와줄 수는 있지만, 실제 키를 보관하거나 새로운 OAuth 앱을 대신 만들 필요는 없습니다. 키 입력·제공자 콘솔 저장·외부 배포 설정은 반드시 대영님이 직접 처리해야 합니다.
