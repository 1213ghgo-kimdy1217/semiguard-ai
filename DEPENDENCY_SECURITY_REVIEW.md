# SemiGuard AI 의존성 보안 검토 기록

> [README로 돌아가기](README.md) · [작업 기록](todo.md) · [AI 활용과 안전장치](AI_USAGE.md)

## 1. 검토 범위와 현재 결과

이 문서는 운영 의존성 감사에서 확인된 전이 의존성의 경로와 **자동 패치를 보류한 이유**를 기록합니다. 2026-08-18에 `pnpm install --frozen-lockfile --ignore-scripts`를 실행해 잠금 파일 기반 설치가 재현되는 것을 확인했고, 2026-08-19에 `pnpm audit --prod --json`을 다시 실행했습니다. 운영 의존성 감사 결과는 critical 0건, high 3건, moderate 16건, low 3건으로 총 22건입니다.

| 고위험 패키지 | 현재 잠금 경로 | 검토 판단 |
|---|---|---|
| `path-to-regexp@0.1.12` | `express@4.21.2 → path-to-regexp@0.1.12` | Express 라우팅 해석과 직접 연결되므로 재정의 또는 Express 변경 전 라우트·인증 흐름 회귀 검증이 필요합니다. |
| `lodash-es@4.17.21` | `streamdown@1.4.0 → mermaid@11.12.0 → langium/chevrotain 계열 → lodash-es@4.17.21` | 채팅·매뉴얼의 마크다운·다이어그램 렌더링 경로에 연결될 수 있어 단일 하위 패키지 고정보다 상위 패키지 호환성 검토가 우선입니다. |
| `lodash@4.17.21` | `recharts@2.15.4 → lodash@4.17.21` | 대시보드 센서·위험도 차트 및 보고서 화면과 연결되므로 Recharts 호환성을 확인한 뒤 업데이트합니다. |

> 이 기록은 취약점이 해소됐다는 선언이 아닙니다. 현재 배포 버전의 감사 결과와, 호환성 검토 없이 전이 의존성을 강제로 교체하지 않는 운영 원칙을 투명하게 보여 주기 위한 것입니다.

### 1-1. 2026-08-19 정적 영향 분석

`express@4.21.2`의 설치 메타데이터와 잠금 파일은 모두 `path-to-regexp@0.1.12`를 **정확한 버전**으로 선언합니다. 따라서 권고 버전 `0.1.13`을 pnpm 재정의로 강제하면 Express가 선언한 설치 계약을 벗어나므로, 단순한 마이너 패치처럼 자동 반영하지 않습니다. Express와 path-to-regexp의 공식 공지는 `/:a-:b-:c`처럼 하나의 경로 세그먼트에 매개변수 3개 이상을 결합할 때의 정규식 기반 서비스 거부 위험을 설명합니다. 현재 `server/`의 Express 경로 정의를 정적으로 점검한 결과 해당 형태는 발견되지 않았습니다. 이는 현재 라우트의 노출 형태를 좁히는 근거일 뿐, 취약한 전이 버전이 설치된 사실을 해소하지는 않습니다.

운영 의존성과 분리해 전체 개발 의존성까지 포함한 `pnpm audit`도 확인했습니다. 이 범위는 개발 도구 경고까지 포함하므로 배포 런타임 감사와 구분해야 하며, 별도 업그레이드 검토가 필요합니다. 제출 안정성을 위해 이 검토에서는 패키지 설치·재정의·메이저 업그레이드를 실행하지 않았습니다.

## 2. 최소 변경 후보와 검증 조건

`path-to-regexp`는 권고 버전으로의 재정의가 가장 작아 보일 수 있지만, Express 4가 선언한 정확한 전이 버전과 다르므로 설치만 성공해도 라우트 매칭·세션·OAuth 콜백이 동일하게 동작한다는 보장은 없습니다. `lodash-es`와 `lodash`는 각각 Streamdown/Mermaid와 Recharts의 상위 호환 버전을 우선 검토해야 하며, 개별 강제 고정은 번들·렌더링 오류를 유발할 수 있습니다.

| 후보 | 변경 전 필수 확인 | 변경 후 필수 검증 | 현재 결정 |
|---|---|---|---|
| `path-to-regexp@0.1.13` 재정의 | Express 4 라우트 계약과 lockfile diff 검토 | 로그인·세션·OAuth 콜백·tRPC 경로, TypeScript·Vitest·빌드, 공개 `/demo` | 보류 |
| Streamdown/Mermaid 계열 업데이트 | 마크다운·다이어그램 사용 위치와 상위 버전 호환성 확인 | 챗봇 답변·매뉴얼 RAG 출처·다이어그램 렌더링, 모바일 화면, 전체 회귀 | 보류 |
| Recharts 계열 업데이트 | React 19·기존 차트 API 호환성 검토 | 센서·위험도 차트, 확대·내보내기·기간 보고서, 전체 회귀 | 보류 |

## 3. 실제 소스 영향 범위

정적 소스 점검 결과, Streamdown과 Recharts는 잠금 파일에만 남은 미사용 의존성이 아닙니다. Streamdown은 `client/src/components/AIChatBox.tsx`에서 AI 답변을 `<Streamdown>{message.content}</Streamdown>`으로 직접 렌더링하고, `client/src/pages/Home.tsx`에서도 직접 사용합니다. 전이 경로는 `streamdown@1.4.0 → mermaid@11.12.0`입니다. Recharts는 `client/src/pages/Dashboard.tsx`와 `client/src/components/ui/chart.tsx`에서 직접 사용하며, 전이 경로는 `recharts@2.15.4 → lodash@4.17.21`입니다. 따라서 두 계열의 업데이트는 단순 설치 성공 여부가 아니라 아래 화면·기능을 포함해 확인해야 합니다.

| 계열 | 직접 사용 위치 | 변경 후 확인할 사용자 경험 |
|---|---|---|
| Streamdown | `AIChatBox.tsx`, `Home.tsx` | AI 상담의 마크다운·코드·표현, RAG 출처 표시, 긴 응답의 모바일 스크롤과 접근성 |
| Recharts | `Dashboard.tsx`, `components/ui/chart.tsx` | 센서 추이·위험도 차트, 확대·이동, 툴팁·키보드 탐색, 기간 보고서와 내보내기 |
| Express 라우팅 | `server/_core`의 tRPC·인증 경로 | 로그인·세션·OAuth 콜백·tRPC 요청·공개 `/demo` 라우팅 |

## 4. 후속 작업 원칙

실제 변경은 하나의 후보만 별도 작업에서 적용하고, 잠금 파일 차이와 영향 경로를 먼저 검토합니다. 이후 동결 설치, TypeScript 검사, Vitest, 프로덕션 빌드, 공개 데모, 로그인 화면, 보호된 대시보드 핵심 흐름을 확인합니다. 하나라도 실패하면 이전 안정 체크포인트로 복구하고 후보를 보류합니다.

현재는 제출용 안정성을 우선하여 패키지 버전을 임의로 올리거나 대규모 의존성 교체를 실행하지 않습니다. 실제 패치가 승인·검증되기 전까지는 README와 `todo.md`의 감사 결과·보류 조건을 최신 상태로 유지합니다.

## 5. 참고 자료

- [Express 2026년 3월 보안 공지](https://expressjs.com/en/blog/2026-03-30-security-releases/): `path-to-regexp@0.1.13` 이상 권고와 영향 조건
- [path-to-regexp GHSA-37ch-88jc-xwx2](https://github.com/pillarjs/path-to-regexp/security/advisories/GHSA-37ch-88jc-xwx2): 여러 매개변수 경로 패턴의 ReDoS 조건과 우회 방법
