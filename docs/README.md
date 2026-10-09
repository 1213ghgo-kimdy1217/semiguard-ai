# SemiGuard 문서 안내

현재 제품을 이해하려면 [README](../README.md)와 [AI·데이터·OGQ IP 고지](../AI_USAGE.md)부터 확인하세요.

## 현재 구현을 확인할 곳

| 확인할 내용 | 구현 근거 |
| --- | --- |
| 화면과 접근 경계 | [라우팅](../client/src/App.tsx), [로그인 없는 샘플](../client/src/pages/TrainingPreview.tsx) |
| 8개 판단 연습·장비 출처 | [가상 기록과 기준](../shared/processScenarios.ts), [장비 사례](../shared/processEquipment.ts) |
| 학습 시각 설명 | [공정 개념 그림](../shared/processVisuals.ts), [Learning Hub](../client/src/pages/LearningHub.tsx) |
| AI 코칭·학습 질문 | [판단 코치](../server/judgmentCoach.ts), [학습 도우미](../server/learningAssistant.ts) |
| 로그인 계정의 저장 범위 | [제출 기록](../server/trainingRecords.ts), [중간 저장](../server/trainingDrafts.ts), [선택 답안 공유](../server/trainingShare.ts) |
| 실행·배포 | [스크립트](../package.json), [Vercel 설정](../vercel.json), [환경변수 이름](../server/_core/env.ts) |

소스의 존재는 운영 성공을 증명하지 않습니다. 공개 사이트의 로그인·저장·AI 흐름은 실제 배포 환경에서 따로 확인해야 합니다. 비밀값과 사용자 원문은 문서·검증 기록에 넣지 않습니다.

## 과거 기록

[보관 문서 안내](archive/README.md)에서 이전 대회 제출물, 발표 대본, 인수인계, 실증·검증 양식과 작업 이력을 찾을 수 있습니다. 옛 제품 방향과 경로는 작성 당시의 기록이며 현재 이용 안내가 아닙니다.
