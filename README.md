# 🛡 SemiGuard AI

> **반도체 장비 예지안전 시스템** | Semiconductor Equipment Predictive Safety System

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Language](https://img.shields.io/badge/Language-TypeScript-blue.svg)](https://www.typescriptlang.org/)
[![AI](https://img.shields.io/badge/AI-Isolation%20Forest-orange.svg)](#ai-이상탐지-엔진)

---

## 📌 프로젝트 개요 | Overview

**SemiGuard AI**는 반도체 제조 현장의 장비 전장부에서 발생하는 이상 징후를 AI가 실시간으로 탐지하고, 위험 단계 도달 시 릴레이를 자동 차단하여 장비 손상과 생산 손실을 예방하는 **예지안전(Predictive Safety) 웹 시스템**입니다.

반도체 공장에서 장비 1대가 비계획 정지(Unplanned Downtime)되면 수억 원의 손실이 발생합니다. 기존의 사후 대응 방식에서 벗어나, **AI가 고장 전에 미리 감지**하는 것이 이 프로젝트의 핵심입니다.

**SemiGuard AI** is a predictive safety web system that uses AI to detect anomalies in semiconductor equipment in real time, automatically tripping a relay when danger is detected to prevent equipment damage and production loss.

---

## 🎯 문제 정의 | Problem Statement

| 기존 방식 | SemiGuard AI |
|----------|-------------|
| 장비 고장 후 수리 (사후 대응) | 고장 전 이상 징후 탐지 (예지 대응) |
| 수동 점검 (주기적, 인력 의존) | AI 자동 모니터링 (24/7, 실시간) |
| 고장 원인 파악 어려움 | 4가지 센서 데이터 기반 근거 제시 |
| 장비 1대 정지 시 수억 원 손실 | 조기 경보로 손실 최소화 |

---

## 🏗 시스템 아키텍처 | Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    SemiGuard AI                         │
├─────────────┬───────────────────────┬───────────────────┤
│  센서 레이어  │      AI 엔진           │   대시보드 레이어   │
│             │                       │                   │
│  전류 (A)   │  Isolation Forest     │  실시간 라인 차트   │
│  온도 (°C)  │  이상 점수 계산 (0~100) │  위험도 게이지      │
│  진동 (mm/s)│  위험도 4단계 판정     │  경고등 / 부저      │
│  소음 (dB)  │  릴레이 차단 트리거    │  이상 이력 로그     │
└─────────────┴───────────────────────┴───────────────────┘

[아두이노 센서] → [Python 백엔드 (FastAPI + AI)] → [React 대시보드]
                                                  ↓
                                         [MySQL DB (이상 이력)]
```

---

## 🤖 AI 이상탐지 엔진 | AI Anomaly Detection Engine

Isolation Forest 알고리즘의 핵심 원리를 기반으로 구현된 이상탐지 엔진입니다.

**알고리즘 원리**: 정상 데이터는 고립시키기 어렵고(많은 분기 필요), 이상 데이터는 쉽게 고립됩니다(적은 분기). 각 센서의 z-score를 계산하여 정상 기준값에서 벗어난 정도를 이상 점수(0~100)로 환산합니다.

**위험도 4단계**:

| 단계 | 이상 점수 | 색상 | 조치 |
|------|----------|------|------|
| 정상 (Normal) | 0 ~ 29 | 🟢 초록 | 정상 운전 |
| 주의 (Caution) | 30 ~ 49 | 🟡 노랑 | 모니터링 강화 |
| 경고 (Warning) | 50 ~ 69 | 🟠 주황 | 점검 준비 |
| 위험 (Danger) | 70 ~ 100 | 🔴 빨강 | 릴레이 차단 |

**정상 기준값 (학습 데이터 기반)**:

| 센서 | 정상 평균 | 표준편차 |
|------|---------|---------|
| 전류 | 5.0 A | ±0.5 |
| 온도 | 45.0 °C | ±3.0 |
| 진동 | 2.0 mm/s | ±0.3 |
| 소음 | 55.0 dB | ±4.0 |

---

## ✨ 주요 기능 | Key Features

- **실시간 센서 대시보드**: 전류·온도·진동·소음 4종 센서값을 라인 차트로 실시간 시각화 (4초 자동 갱신)
- **AI 위험도 게이지**: 이상 점수 0~100을 원형 게이지와 4단계 색상으로 직관적 표현
- **장비 상태 시뮬레이터**: 정상 주입 / 이상 주입 버튼으로 심사위원이 직접 AI 반응 체험 가능
- **자동 릴레이 차단**: 위험 단계(70점 이상) 도달 시 릴레이 차단 시뮬레이션 및 경고 알림
- **경고등 / 부저**: 위험 단계에서 깜빡임 애니메이션으로 시각적 경보 표현
- **Heartbeat 인디케이터**: AI 시스템 정상 작동 여부 실시간 표시
- **이상 이력 로그**: 탐지된 이상 이벤트를 DB에 저장하고 테이블로 조회
- **한국어 / 영어 다국어 지원**: 우측 상단 버튼으로 즉시 전환

---

## 🛠 기술 스택 | Tech Stack

| 분류 | 기술 |
|------|------|
| **프론트엔드** | React 19, TypeScript, Tailwind CSS 4, Recharts |
| **백엔드** | Node.js, Express, tRPC 11 |
| **데이터베이스** | MySQL (Drizzle ORM) |
| **AI 엔진** | Isolation Forest (TypeScript 구현) |
| **테스트** | Vitest |
| **배포** | Manus Cloud (Autoscale) |

---

## 🚀 실행 방법 | Getting Started

```bash
# 1. 저장소 클론
git clone https://github.com/your-team/semiguard-ai.git
cd semiguard-ai

# 2. 의존성 설치
pnpm install

# 3. 환경변수 설정 (.env)
DATABASE_URL=mysql://...
JWT_SECRET=your-secret

# 4. DB 마이그레이션
pnpm db:push

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
│   ├── pages/Dashboard.tsx    # 메인 대시보드 UI
│   └── lib/i18n.ts            # 한국어/영어 다국어
├── server/
│   ├── semiguard.ts           # AI 이상탐지 엔진
│   ├── semiguardDb.ts         # DB 쿼리 헬퍼
│   ├── semiguard.test.ts      # 유닛 테스트
│   └── routers.ts             # tRPC API 라우터
├── drizzle/schema.ts          # DB 스키마 (anomaly_logs)
└── shared/semiguard.ts        # 공유 타입 정의
```

---

## 🤖 AI 사용 내역 | AI Usage Disclosure

본 프로젝트는 다음 AI 도구를 활용하여 개발되었습니다:
- **Manus AI**: 프로젝트 설계, 코드 생성, 디버깅 보조
- **AI 모델**: 코드 리뷰 및 최적화 제안

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

> 💡 **대회 출품작**: 제4회 NAVER OGQ마켓 AI Competition — 전기·전자·메카트로닉스 트랙
