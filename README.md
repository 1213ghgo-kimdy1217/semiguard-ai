# 🛡 SemiGuard AI

> **반도체 장비 예지안전 시스템** | Semiconductor Equipment Predictive Safety System

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Language](https://img.shields.io/badge/Language-TypeScript-blue.svg)](https://www.typescriptlang.org/)
[![AI](https://img.shields.io/badge/AI-LLM%20%2B%20Isolation%20Forest-orange.svg)](#ai-이상탐지-엔진)
[![i18n](https://img.shields.io/badge/i18n-KO%20%7C%20EN%20%7C%20JA-blueviolet.svg)](#다국어-지원)

---

## 📌 프로젝트 개요 | Overview

**SemiGuard AI**는 반도체 제조 현장의 장비 센서 데이터를 실시간으로 분석하여 고장 전 이상을 자동 탐지하고, LLM이 원인을 즉시 진단하여 비계획 정지 손실을 예방하는 **예지보전(Predictive Maintenance) 웹 시스템**입니다.

반도체 공장에서 장비 1대가 비계획 정지(Unplanned Downtime)되면 수억 원의 손실이 발생합니다. 기존의 사후 대응 방식에서 벗어나, **AI가 고장 전에 미리 감지하고 원인까지 설명**하는 것이 이 프로젝트의 핵심입니다.

---

## 🎯 문제 정의 | Problem Statement

| 기존 방식 | SemiGuard AI |
|----------|-------------|
| 장비 고장 후 수리 (사후 대응) | 고장 전 이상 징후 탐지 (예지 대응) |
| 수동 점검 (주기적, 인력 의존) | AI 자동 모니터링 (24/7, 실시간) |
| 고장 원인 파악 어려움 | LLM이 센서 데이터 기반 원인 자연어 진단 |
| 장비 1대 정지 시 수억 원 손실 | 조기 경보 + 예상 절감 비용 자동 산출 |

---

## 🏗 시스템 아키텍처 | Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                      SemiGuard AI                              │
├──────────────┬──────────────────────┬──────────────────────────┤
│  센서 레이어   │      AI 엔진          │     대시보드 레이어      │
│              │                      │                          │
│  전류 (A)    │  Isolation Forest    │  실시간 라인 차트          │
│  온도 (°C)   │  이상 점수 0~100 산출  │  위험도 게이지            │
│  진동 (mm/s) │  위험도 4단계 판정     │  LLM 이상 원인 분석 패널  │
│  소음 (dB)   │  LLM 원인 분석 (3개국) │  이상 이력 + AI 분석 로그 │
└──────────────┴──────────────────────┴──────────────────────────┘

[센서 데이터] → [Isolation Forest 이상 탐지] → [LLM 원인 분석 (KO/EN/JA)]
                                              ↓
                                   [MySQL DB 이상 이력 저장]
                                              ↓
                                   [React 실시간 대시보드]
```

---

## 🤖 AI 이상탐지 엔진 | AI Anomaly Detection Engine

Isolation Forest 알고리즘의 핵심 원리를 기반으로 구현된 이상탐지 엔진입니다.

**알고리즘 원리**: 각 센서의 z-score를 계산하여 정상 기준값에서 벗어난 정도를 이상 점수(0~100)로 환산합니다. 정상 데이터는 고립시키기 어렵고, 이상 데이터는 쉽게 고립됩니다.

**위험도 4단계**:

| 단계 | 이상 점수 | 색상 | 조치 |
|------|----------|------|------|
| 정상 (Normal) | 0 ~ 29 | 🟢 초록 | 정상 운전 |
| 주의 (Caution) | 30 ~ 49 | 🟡 노랑 | 모니터링 강화 |
| 경고 (Warning) | 50 ~ 69 | 🟠 주황 | 점검 준비 |
| 위험 (Danger) | 70 ~ 100 | 🔴 빨강 | 릴레이 차단 |

**정상 기준값**:

| 센서 | 정상 평균 | 표준편차 |
|------|---------|---------|
| 전류 | 5.0 A | ±0.5 |
| 온도 | 45.0 °C | ±3.0 |
| 진동 | 2.0 mm/s | ±0.3 |
| 소음 | 55.0 dB | ±4.0 |

---

## 🧠 LLM 이상 원인 분석 | LLM Anomaly Diagnosis

위험/경고 단계 탐지 시 LLM이 센서 데이터를 분석하여 **주요 원인 → 상세 분석 → 권장 조치** 3단계로 자연어 설명을 생성합니다.

- **3개 언어 동시 생성**: 탐지 즉시 한국어·영어·일본어 분석 결과를 병렬로 LLM 호출하여 DB에 저장
- **이상 이력 연동**: 각 이상 로그에 LLM 분석 결과가 함께 저장되어 과거 탐지 건 조회 가능
- **AI 분석 히스토리 패널**: 최근 5건의 LLM 분석 결과를 시간순으로 조회
- **언어 전환 즉시 반영**: 언어 설정 변경 시 저장된 분석 결과도 해당 언어로 즉시 표시

---

## ✨ 주요 기능 | Key Features

- **실시간 센서 대시보드**: 전류·온도·진동·소음 4종 센서값을 라인 차트로 실시간 시각화
- **AI 위험도 게이지**: 이상 점수 0~100을 원형 게이지와 4단계 색상으로 직관적 표현
- **LLM 이상 원인 분석**: 위험 탐지 시 AI가 원인·상세·권장 조치를 자연어로 즉시 진단
- **예상 절감 비용 자동 산출**: 위험 단계 탐지 1회당 약 5천만 원 절감 효과 누적 표시
- **장비 상태 시뮬레이터**: 정상/이상/주의/경고 주입 버튼으로 AI 반응 직접 체험
- **자동 데모 모드**: 설정 속도로 자동 데이터 주입 및 AI 분석 시연
- **이상 이력 로그**: 탐지된 이상 이벤트와 LLM 분석 결과를 DB에 저장하고 테이블로 조회
- **AI 분석 히스토리 패널**: 최근 LLM 분석 결과 5건 모아보기
- **임계값 커스터마이징**: 위험도 4단계 및 센서별 임계값을 UI에서 직접 조정
- **PDF 리포트 내보내기**: 현재 대시보드 상태를 PDF로 저장
- **CSV 이상 이력 내보내기**: 이상 로그를 CSV 파일로 다운로드
- **한국어 / 영어 / 일본어 다국어 지원**: 우측 상단 버튼으로 즉시 전환

---

## 🛠 기술 스택 | Tech Stack

| 분류 | 기술 |
|------|------|
| **프론트엔드** | React 19, TypeScript, Tailwind CSS 4, Recharts |
| **백엔드** | Node.js, Express, tRPC 11 |
| **데이터베이스** | MySQL (Drizzle ORM) |
| **AI 이상탐지** | Isolation Forest (TypeScript 구현) |
| **AI 원인 분석** | Manus Built-in LLM API (GPT-4o 기반) |
| **테스트** | Vitest |
| **배포** | Manus Cloud (Autoscale) |

---

## 🚀 실행 방법 | Getting Started

```bash
# 1. 저장소 클론
git clone https://github.com/1213ghgo-kimdy1217/semiguard-ai.git
cd semiguard-ai

# 2. 의존성 설치
pnpm install

# 3. 환경변수 설정 (.env)
DATABASE_URL=mysql://...
JWT_SECRET=your-secret

# 4. DB 마이그레이션
pnpm drizzle-kit generate

# 5. 개발 서버 실행
pnpm dev
```

---

## 🧪 테스트 | Testing

```bash
pnpm test
```

**테스트 항목** (7개 통과):
- 정상 데이터 → 낮은 이상 점수 반환 검증
- 이상 데이터 → 높은 이상 점수 반환 검증
- 이상 점수 0~100 범위 검증
- 위험도 4단계 분류 정확성 검증
- 정상/이상 데이터 생성기 동작 검증

---

## 📁 프로젝트 구조 | Project Structure

```
semiguard-ai/
├── client/src/
│   ├── pages/Dashboard.tsx    # 메인 대시보드 UI (실시간 모니터링, LLM 패널)
│   └── lib/i18n.ts            # 한국어/영어/일본어 다국어
├── server/
│   ├── semiguard.ts           # AI 이상탐지 엔진 (Isolation Forest)
│   ├── semiguardDb.ts         # DB 쿼리 헬퍼 (3개 언어 LLM 저장)
│   ├── semiguard.test.ts      # 유닛 테스트
│   └── routers.ts             # tRPC API 라우터
├── drizzle/schema.ts          # DB 스키마 (anomaly_logs + llm_analysis_ko/en/ja)
└── shared/semiguard.ts        # 공유 타입 정의
```

---

## 🤖 AI 사용 내역 | AI Usage Disclosure

본 프로젝트는 다음 AI 도구를 활용하여 개발되었습니다:
- **Manus AI**: 프로젝트 설계, 코드 생성, 디버깅 보조
- **Manus Built-in LLM API**: 이상 원인 자연어 분석 (런타임 기능)

핵심 알고리즘(이상탐지 엔진), 도메인 지식(반도체 장비 파라미터), 아키텍처 설계는 팀원이 직접 설계하였습니다.

---

## 👥 팀 소개 | Team

**SemiGuard 팀** | 충남반도체마이스터고등학교 장비과 2학년

| 이름 | 역할 |
|------|------|
| 김대영 | 팀장, 기획, 발표 , 백엔드 개발 |
| 김승현 | 프론트엔드 개발, 백엔드 개발 |

---

## 📄 라이선스 | License

MIT License © 2026 SemiGuard Team

---

> 💡 **대회 출품작**: 충남반도체마이스터고등학교 교내 AI 프로젝트 대회

---

## 🔗 외부 사용 내역 | External Resources

### 사용 AI 모델

| 모델 / 서비스 | 용도 |
|-------------|------|
| Manus Built-in LLM API (GPT-4o 기반) | 이상 원인 자연어 분석 (한국어·영어·일본어) |
| Manus AI Agent | 프로젝트 설계, 코드 생성, 디버깅 보조 |

### 사용 오픈소스 패키지

| 패키지 | 라이선스 | 용도 |
|--------|---------|------|
| React 19 | MIT | 프론트엔드 UI 프레임워크 |
| tRPC 11 | MIT | 타입 안전 API 통신 |
| Drizzle ORM | Apache-2.0 | 데이터베이스 ORM |
| Recharts | MIT | 센서 데이터 시각화 차트 |
| Tailwind CSS 4 | MIT | UI 스타일링 |
| shadcn/ui | MIT | UI 컴포넌트 라이브러리 |
| Vitest | MIT | 유닛 테스트 |
| jsPDF | MIT | PDF 리포트 내보내기 |

### 외부 자문

- 반도체 장비 센서 파라미터(전류·온도·진동·소음 정상 범위) 설정에 있어 **충남반도체마이스터고등학교 장비과 담당 교사**의 도메인 자문을 참고하였습니다.
- Isolation Forest 알고리즘 원리는 공개 논문 및 강의 자료를 참고하여 TypeScript로 직접 구현하였습니다.
