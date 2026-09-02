# 환경변수 이름 템플릿

> 이 문서는 **변수 이름만** 보여주는 안전한 템플릿입니다. 실제 값은 이 문서, GitHub, ChatGPT 대화에 적지 말고 로컬 `.env` 또는 배포 환경의 Secrets 설정 화면에만 입력하세요.

```dotenv
# 데이터베이스·세션 — 실제 값을 ChatGPT·GitHub에 올리지 않음
DATABASE_URL=<mysql_or_tidb_connection_string>
JWT_SECRET=<new_random_secret_per_environment>

# Google OAuth — 소셜 계정 연결 기능 사용 시
GOOGLE_CLIENT_ID=<google_oauth_client_id>
GOOGLE_CLIENT_SECRET=<google_oauth_client_secret>

# Naver OAuth — 소셜 계정 연결 기능 사용 시
NAVER_CLIENT_ID=<naver_oauth_client_id>
NAVER_CLIENT_SECRET=<naver_oauth_client_secret>

# Kakao OAuth — 소셜 계정 연결 기능 사용 시
KAKAO_CLIENT_ID=<kakao_oauth_client_id>
KAKAO_CLIENT_SECRET=<kakao_oauth_client_secret>

# Manus 관리형 환경에서만 제공되는 값
VITE_APP_ID=<manus_oauth_app_id_if_using_manus>
OAUTH_SERVER_URL=<manus_oauth_server_url_if_using_manus>
BUILT_IN_FORGE_API_URL=<manus_forge_api_url_if_using_manus>
BUILT_IN_FORGE_API_KEY=<manus_forge_api_key_if_using_manus>
```

## 입력 위치

| 환경 | 실제 값 입력 위치 |
| --- | --- |
| 로컬 개발 | Git에 추가하지 않는 로컬 `.env` 파일 |
| 새 호스팅 서비스 | 해당 서비스의 Secrets 또는 환경변수 설정 화면 |
| 현재 Manus 배포 | 관리형 프로젝트 Secrets에 이미 주입된 값 |

새 환경에서 소셜 로그인을 활성화할 때의 Redirect URI·검증 순서는 [OAuth 설정 가이드](OAUTH_SETUP_GUIDE.md)를 따릅니다.
