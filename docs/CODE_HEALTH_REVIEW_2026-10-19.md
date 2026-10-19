# 저장소 점검 · 2026-10-19

## 기준과 범위

- 기준 main: `2b46a735aa8f847fa45391158ba02600998a3184`. GitHub 비교 결과, 점검 시작 시점의 main과 일치했습니다.
- 별도 로컬 브랜치: `fix/review-test-portability-20261019`. 기존 변경이 있는 다른 작업 폴더는 수정하지 않았습니다.
- 전체 타입 검사·전체 Vitest·production build를 실행하고, 주요 화면/API/공유 데이터 계약을 소스로 확인했습니다. 모든 소스의 모든 줄을 수동 검토했거나, 전면 보안·의존성 감사를 완료했다는 뜻은 아닙니다.
- 이번 변경은 테스트 픽스처와 점검 문서뿐입니다. 날짜를 바꾸기 위한 빈 수정, 기존 커밋 날짜 변경, 강제 푸시, 관련 없는 파일의 재포맷은 하지 않았습니다.

## 주요 소스 확인

| 범위 | 확인한 연결과 경계 |
| --- | --- |
| 화면 진입 | `client/src/App.tsx`의 공개 소개·샘플과 로그인 후 연습·개인 기록 경로 |
| 관찰·제출·재시도 | `ProcessTraining.tsx`, `EtchTraining.tsx`, `TrainingRetry.tsx`의 관찰 완료 조건, 일시정지, 새 시도 확인, 저장 요청 상태 |
| 복기·관측 범위 | `processReviewNavigation.ts`, `trainingReplay.ts`, `observationComparison.ts`, `edsObservation.ts`, `processObservation.ts`, `inspectionEvidence.ts`의 원본 기록 재사용·관측 시점 제한 |
| 계정 기록 | `trainingRecords.ts`, `trainingDrafts.ts`, `trainingRecord.ts`, `trainingDraft.ts`, `TrainingCheckpoint.tsx`의 소유자 조건과 선택 답안 전용 저장 계약 |
| 기록 목록 | `TrainingHistoryList.tsx`, `trainingHistoryPagination.ts`, `trainingReview.ts`, `processProgress.ts`의 최대 20건 창·5건씩 보기와 전체 완료 이력의 구분 |
| 동의·통계 | `googleAnalytics.ts`, `measurementChoice.ts`, `practiceMeasurement.ts`, `practiceMetricsAccess.ts`, `_core/trpc.ts`, `routers.ts`의 선택 동의·허용 항목·집계 읽기 권한 |
| 로그아웃·공유 | `AccountSession.tsx`, `logoutSession.ts`, `trainingShare.ts`의 로컬 정리, 계정별 공유 대상 조회와 7일 선택 답안 토큰 |
| 실행 진입점 | `package.json`, `vitest.config.ts`, `vercel.json`, `api/index.mjs`, `server/vercel.ts`, `scripts/verify-vercel.mjs`의 빌드·검사 경로 |

위 표는 수동으로 살펴본 주요 경로입니다. 전체 자동 검사에는 기존 계약·회귀 테스트가 그대로 포함되었습니다. DB 테이블·마이그레이션을 실행하거나 운영 환경을 바꾸지는 않았습니다.

## 재현한 문제와 수정

`server/judgment-coach.test.ts`는 매개변수 테스트를 수집할 때 `ENV.nvidiaApiKey`로 안전 분류용 응답을 만들고, `beforeEach`에서 별도의 가짜 키를 설정하고 있었습니다. 테스트 수집은 `beforeEach`보다 먼저 실행됩니다.

키가 비어 있는 환경에서는 응답의 질문이 빈 문자열이 되어, 의도한 안전 분류가 아닌 문자열 길이 검증에서 실패했습니다. 수정 전 해당 파일의 103개 테스트 중 1개 실패를 실제로 재현했습니다.

수정은 고정된 합성 키 상수를 테스트 수집과 `beforeEach`에서 함께 쓰도록 한 것입니다. 제품의 검증 함수·안전 기준·허용 응답·키 설정은 바꾸지 않았고, 기존 테스트나 검증 기대값도 삭제·완화하지 않았습니다. 실제 환경의 키를 테스트 사례에 복사할 필요도 없어졌습니다.

## 실제 실행 결과

실행 환경은 Node `v24.20.0`, 기존 설치 pnpm `10.18.0`입니다. 저장소에 선언된 pnpm 버전은 변경하지 않았습니다. 이 환경에서는 `node node_modules/pnpm/bin/pnpm.cjs`와 프로세스에만 적용한 `npm_config_manage_package_manager_versions=false`로 실행했습니다. 잠금 파일·의존성은 수정하지 않았고 기존 설치 폴더를 재사용했습니다.

검사 프로세스의 `DATABASE_URL`, `NVIDIA_API_KEY`, `BUILT_IN_FORGE_API_KEY`, `OGQ_API_KEY`는 비웠습니다. 테스트 내부의 합성 값과 모의 응답은 실제 서비스 키·사용자 결과가 아닙니다.

| 검사 | 실제 결과 |
| --- | --- |
| 수정 전 키 없는 환경에서 해당 코치 테스트 실행 | 102개 통과 / 1개 실패, 원인 재현 |
| `pnpm check` | 종료 코드 0 |
| 수정 후 제한 환경의 전체 테스트 | 362개 파일 통과 / 3개 파일 실패, 1,746개 테스트 통과 / 21개 실패. 실패는 로컬 HTTP 연결의 `EACCES 127.0.0.1` |
| 로컬 통신 허용 후 실패한 3개 파일 재검사 | 3개 파일 / 33개 테스트 통과 |
| 같은 허용 환경에서 전체 `pnpm test --maxWorkers 4 --minWorkers 2 --no-cache --reporter=dot` 재실행 | **365개 파일 / 1,767개 테스트 통과**, 종료 코드 0, 71.16초 |
| 다른 합성 환경 키로 코치 테스트 재실행 | 1개 파일 / 103개 테스트 통과. 실제 키는 사용하지 않음 |
| `pnpm build` | 종료 코드 0. 브라우저 자산·로컬 서버·Vercel 서버 번들 생성, Vite 31.85초 |
| `node scripts/verify-vercel.mjs` | 종료 코드 0. 실제 빌드된 API의 로컬 상태 확인과 인증 미설정 시 차단 확인 |
| 점검 문서 추가 후 문서 링크·제품 고지·코치 회귀 검사 | 2개 파일 / 109개 테스트 통과, 종료 코드 0 |

로컬 통신 허용은 기존 테스트의 HTTP 서버 연결에 필요했습니다. 보호된 미리보기·운영 계정·외부 제공자 접근을 우회한 것이 아닙니다. 제한 환경의 실패를 제품 오류로 감추거나 테스트를 제외하지 않고, 같은 전체 검사를 다시 실행했습니다.

## 남은 문제와 미검증

- 빌드의 기존 500 kB 초과 청크 경고가 남아 있습니다. 기본 청크는 654.69 kB이며, 경고를 숨기거나 번들 설정을 변경하지 않았습니다.
- 이전 운영 AI 코칭의 `invalid-response` 사례는 이번 테스트 픽스처 수정으로 해결했다고 주장하지 않습니다. 실제 제공자 응답은 새로 호출하지 않았습니다.
- 이번 변경에는 화면·서버 기능 코드가 없습니다. 브라우저 재시연, 신규 계정 저장·다른 기기 이어하기·공유 수신·회원탈퇴는 이번 변경 검증에서 새로 실행하지 않았습니다.
- 같은 날짜의 별도 운영 점검에서는 공개 화면·8개 공정 관찰 진입·저장 기록 조회·18개 좁은 화면/언어 조합을 확인했지만, 모든 공정의 신규 제출·복기와 실제 AI 성공까지 확인한 것은 아닙니다. 이를 이번 테스트 실행 결과와 합쳐 과장하지 않습니다.
- 실제 사용자 수·재사용률·학습 효과·현장 성능을 새로 측정하거나 만들어 넣지 않았습니다.
- pnpm 자체 버전 관리가 켜진 별도 버전 확인 시도는 로컬 도구 캐시의 권한 오류로 실패했습니다. 이후 위 프로세스 설정으로 기존 pnpm 버전을 확인했으며, 저장소 의존성·잠금 파일은 그대로입니다.

## 반영 상태

사용자가 검증 결과를 확인한 뒤 테스트 수정·README·이 점검 기록·인계 기록의 **4개 파일을 GitHub main에 반영하는 것을 승인**했습니다. 게시 직전에도 main이 기준 커밋과 동일함을 다시 확인했습니다. 승인 범위는 이 4개 파일이며, 앱 기능·DB·비밀값·권한·운영 설정은 바꾸지 않습니다. 기존 이력을 고치지 않고 실제 새 커밋으로 반영하며, 변경하지 않은 코드 파일·폴더의 GitHub 마지막 수정 시각은 그대로 유지됩니다.

GitHub 연동으로 자동 빌드·배포가 시작될 수 있지만, 이는 운영 로그인·DB·외부 AI의 성공을 확인한 결과가 아닙니다. 수동 배포·배포 승격이나 운영 설정 변경은 이번 게시 범위에 포함하지 않습니다.

실행 로그는 개발 작업 폴더의 `work/verification-artifacts/code-health-*-20261019.log`에 보관하며 Git에 추가하지 않습니다. 문서 작성은 기존 README·인계 기록의 문체를 참고했고, 수치와 완료 여부는 실제 실행 결과만 기록했습니다.
