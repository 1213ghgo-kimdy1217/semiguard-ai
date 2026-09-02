# ChatGPT 이전 파일 목록과 업로드 순서

> **목표:** 아래 파일만 내려받아 ChatGPT에 순서대로 올리면, 프로젝트·대회·현재 작업 상태를 이해한 뒤 SemiGuard AI를 이어서 작업할 수 있습니다.

## 가장 쉬운 방법

1. `ChatGPT_이전_핵심문서.zip`을 ChatGPT에 업로드합니다.
2. `CHATGPT_START_PROMPT.md`를 열어 코드 블록 전체를 새 ChatGPT 대화의 첫 메시지로 붙여 넣습니다.
3. ChatGPT가 코드 변경을 도와야 할 때만 `SemiGuard_AI_소스코드_안전사본.zip`을 추가 업로드합니다.

> 핵심 문서 압축본은 대회·현재 상태·다음 작업·프롬프트를 먼저 이해시키기 위한 파일입니다. 소스 압축본은 코드 수정이 필요할 때만 올리면 됩니다.

## 지금 내려받아 올릴 파일

| 우선순위 | 파일 | ChatGPT에 올리는 목적 |
| --- | --- | --- |
| 1 | `CHATGPT_HANDOVER.md` | 대회, 제품, 현재 상태, 과거 결정, 안전 제약 전체 요약 |
| 2 | `CHATGPT_START_PROMPT.md` | 새 대화에 붙여 넣을 작업 지시문 |
| 3 | `ChatGPT_이전_핵심문서.zip` | W1·W2·AI·검증 문서를 한 번에 제공하는 압축본 |
| 4 | `SemiGuard_AI_소스코드_안전사본.zip` | 실제 소스·테스트·설정 파일 전체. 코드 수정 때만 필요 |
| 선택 | `OAUTH_SETUP_GUIDE.md`, `ENVIRONMENT_VARIABLE_TEMPLATE.md` | 다른 환경에서 로그인·OAuth 설정을 점검할 때 |
| 선택·비공개 | `CHATGPT_PRIVATE_PROFILE_ADDENDUM.md` | 대영님이 허용한 이름·학교·학년·역할·연락 이메일이 필요할 때만 직접 업로드 |
| 선택 | `W1_TEAM_GOALS_SUBMISSION_DRAFT.md`, `W1_RESUBMISSION_POST_TEXT.md` | W1 제출물 보완을 요청할 때 |
| 선택 | `W2_INTERVIEW_QUESTIONNAIRE_DRAFT.md`, `W2_ANONYMOUS_QUOTE_CONSENT_FORM.md`, `W2_INTERVIEW_RUNBOOK.md` | W2 인터뷰·동의·문제 정의 작업을 요청할 때 |
| 선택 | `AI_USAGE.md`, `TECHNICAL_REFERENCE.md`, `VALIDATION_PLAN.md` | 탐지 방식·AI 한계·실증 계획을 상세히 검토할 때 |

## 첫 메시지에 붙여 넣을 순서

1. `CHATGPT_HANDOVER.md`를 먼저 업로드합니다.
2. `CHATGPT_START_PROMPT.md`의 코드 블록을 복사해 첫 메시지로 보냅니다.
3. ChatGPT가 문서를 읽었다고 답하면, 다음처럼 요청합니다.

> “첨부한 인수인계 문서와 현재 파일을 기준으로 작업을 이어가 주세요. 실제 인터뷰·수치·성과는 만들지 말고, 먼저 현재 상태와 가장 우선인 다음 작업을 짧게 정리해 주세요.”

4. 코드 수정이 필요하다는 답을 받았을 때만 `SemiGuard_AI_소스코드_안전사본.zip`을 올립니다.
5. 로그인 기능을 다른 환경에서 실행해야 할 때는 `OAUTH_SETUP_GUIDE.md`와 `ENVIRONMENT_VARIABLE_TEMPLATE.md`를 추가합니다. 실제 키 값은 올리지 않습니다.

## 대회 맥락을 ChatGPT가 반드시 알아야 하는 내용

| 주제 | 반드시 전달할 사실 |
| --- | --- |
| 대회 | 전국 마이스터고 스타프로젝트의 주차별 과제 수행 중 |
| 팀 | 김대영(팀장)·김승현(팀원), 정확히 2명 |
| W1 | A4 한 장 팀 목표 문안·PDF·게시글 본문 초안은 준비됨. 외부 제출 페이지 수정은 사용자가 직접 수행 |
| W2 | 실제 인터뷰 4건과 익명 인용 동의는 확보했지만, 5명 기준은 아직 충족하지 않음 |
| 탐지 | 학습된 모델이 아닌 z-score 기반 규칙형 위험 점수. 실제 팹 성능은 검증 전 |
| 데모 | 공개 `/demo`는 가상 데이터 기반 읽기 전용 시연이며 실제 설비를 제어하지 않음 |
| 다음 우선순위 | W2 다섯 번째 실제 인터뷰 또는 다음 주 인터뷰 기반 개선 후보의 실제 기능화 |

## 올리면 안 되는 파일·내용

- API 키, `.env`, OAuth 비밀값, 비밀번호, 세션·쿠키, 데이터베이스 접속 정보
- 실제 인터뷰 DM 원문, 스크린샷, 녹음·녹화, 참여자 이름·연락처·회사/학교·SNS 계정
- 실제 설비명·공정·라인·레시피·내부 수치·사진·보고서
- `node_modules`, `dist`, `.git`, `.manus-logs`

제3자 정보가 필요해 보이는 경우에도 원문을 올리지 말고, 익명 역할 범주와 비식별화된 요약만 제공합니다. 실제 인터뷰를 하지 않은 사람의 답변·인용·숫자를 만들어 달라고 요청하지 않도록 합니다.

## 패키지에 이미 들어 있는 문서

`ChatGPT_이전_핵심문서.zip`에는 `CHATGPT_HANDOVER.md`, `CHATGPT_START_PROMPT.md`, `README.md`, `todo.md`, W1·W2 문서, AI·기술·검증 문서가 들어 있습니다. `SemiGuard_AI_소스코드_안전사본.zip`에는 GitHub의 최신 소스·테스트·설정 파일이 들어 있으며, 패키지 생성 시 `.env`, `node_modules`, `.git`, 로그, 비공개 인터뷰 작업본을 제외했습니다.

## 참고 링크

- [SemiGuard AI GitHub 저장소](https://github.com/1213ghgo-kimdy1217/semiguard-ai)
- [공개 읽기 전용 데모](https://semiguardai-jifnzsvd.manus.space/demo?lang=ko)
- [ChatGPT 인수인계 문서](CHATGPT_HANDOVER.md)
- [ChatGPT 시작 프롬프트](CHATGPT_START_PROMPT.md)
- [OAuth 설정 가이드](OAUTH_SETUP_GUIDE.md)
- [환경변수 이름 템플릿](ENVIRONMENT_VARIABLE_TEMPLATE.md)
