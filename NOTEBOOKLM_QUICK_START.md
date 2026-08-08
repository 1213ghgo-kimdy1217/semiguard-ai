# NotebookLM 빠른 시작 가이드 - SemiGuard AI

## 🚀 5분 안에 시작하기

### 1단계: 파일 준비 (1분)

다음 파일들을 준비하세요:

```
📁 NotebookLM 업로드 폴더
├── 📄 NOTEBOOKLM_GUIDE.pdf          ← 프로젝트 전체 가이드
├── 📄 NOTEBOOKLM_QUESTIONS.pdf      ← 질문 템플릿
└── 📄 GitHub 저장소 링크
    https://github.com/[username]/semiguard-ai
```

### 2단계: NotebookLM 접속 (1분)

1. https://notebooklm.google.com 접속
2. Google 계정으로 로그인
3. "Create new notebook" 클릭

### 3단계: 파일 업로드 (2분)

1. "Upload files" 클릭
2. 다음 파일들 선택:
   - NOTEBOOKLM_GUIDE.pdf
   - NOTEBOOKLM_QUESTIONS.pdf
3. GitHub 저장소 링크 추가 (선택사항)

### 4단계: 질문 시작 (1분)

다음 중 하나를 복사해서 질문하세요:

**질문 1: 현재 상황 파악**
```
SemiGuard AI 프로젝트의 현재 상황을 요약해 주세요.
- 완료된 것
- 진행 중인 것
- 남은 작업
```

**질문 2: 문제 해결**
```
로그인 안 된 상태에서도 대시보드가 보이는 문제를 해결하려고 합니다.
이 문제의 원인이 뭘까요?
단계별로 해결 방법을 설명해 주세요.
```

**질문 3: 다음 단계**
```
소셜 로그인이 완료되었습니다.
다음으로 데이터 격리를 구현하려고 합니다.
어떻게 해야 할까요?
```

---

## 📋 자주 하는 질문 (FAQ)

### Q1: 어떤 파일을 업로드해야 하나요?

**A**: 최소한 다음 2개 파일을 업로드하세요:

1. **NOTEBOOKLM_GUIDE.pdf** (필수)
   - 프로젝트 전체 구조
   - 데이터베이스 스키마
   - API 엔드포인트
   - 진행 상황

2. **NOTEBOOKLM_QUESTIONS.pdf** (권장)
   - 질문 템플릿
   - 효과적인 질문 방법
   - 예제

### Q2: GitHub 저장소도 업로드해야 하나요?

**A**: 선택사항입니다. 하지만 업로드하면:
- NotebookLM이 최신 코드를 볼 수 있음
- 더 정확한 조언 가능
- 코드 리뷰가 더 효과적

**업로드 방법**:
1. NotebookLM에서 "Add source" 클릭
2. GitHub 저장소 URL 입력
3. 또는 README.md 파일 업로드

### Q3: 어떤 질문을 해야 하나요?

**A**: 다음 순서로 질문하세요:

1. **프로젝트 이해**
   ```
   SemiGuard AI 프로젝트의 아키텍처를 설명해 주세요.
   ```

2. **현재 문제**
   ```
   로그인 안 된 상태에서 대시보드가 보이는 문제가 있습니다.
   원인이 뭘까요?
   ```

3. **해결 방법**
   ```
   이 문제를 어떻게 해결할 수 있을까요?
   코드 예제를 보여 주세요.
   ```

4. **다음 단계**
   ```
   다음으로 뭘 구현해야 할까요?
   우선순위는?
   ```

### Q4: 코드를 어떻게 공유하나요?

**A**: 다음 방법 중 하나를 사용하세요:

**방법 1: 파일 업로드**
```
1. NotebookLM에서 "Upload files" 클릭
2. 코드 파일 선택 (예: Dashboard.tsx)
3. 업로드 완료
```

**방법 2: 텍스트 복사**
```
질문에 코드를 직접 붙여넣기:

"다음 코드를 리뷰해 주세요:

[코드 붙여넣기]

문제점이 있을까요?"
```

### Q5: NotebookLM이 잘못된 조언을 주면?

**A**: 다음과 같이 대응하세요:

```
"당신의 조언을 시도했는데 작동하지 않았습니다.
에러 메시지는 다음과 같습니다:

[에러 메시지]

다른 방법이 있을까요?"
```

---

## 💡 효과적인 질문 예제

### 예제 1: 버그 리포트

```
【프로젝트】
SemiGuard AI - 반도체 장비 모니터링 시스템

【문제】
로그인 안 된 상태에서도 대시보드가 보입니다.

【예상】
로그인 페이지로 리다이렉트되어야 합니다.

【실제】
대시보드가 바로 표시됩니다.

【코드】
// App.tsx의 ProtectedRoute
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!loading && !user) {
      setLocation("/login");
    }
  }, [user, loading, setLocation]);

  if (loading) return <LoadingSpinner />;
  if (!user) return null;
  return <>{children}</>;
}

【질문】
useAuth()의 loading 상태가 제대로 작동하지 않는 이유가 뭘까요?
어떻게 해결할 수 있을까요?
```

### 예제 2: 기능 구현 상담

```
【기능】
데이터 공유 기능

【요구사항】
- 사용자 A가 사용자 B와 데이터 공유
- 읽기/쓰기 권한 구분
- 공유 취소 기능

【질문】
1. 데이터베이스 스키마는 어떻게 설계할까요?
2. 백엔드 API는 어떻게 구현할까요?
3. 프론트엔드 UI는 어떻게 만들까요?
4. 성능 최적화 방법이 있을까요?
```

### 예제 3: 코드 리뷰

```
【코드】
[코드 붙여넣기]

【우려 사항】
1. useEffect 의존성 배열이 맞는가?
2. 무한 루프가 발생할 수 있는가?
3. 성능 문제는 없는가?

【질문】
이 코드에 문제가 있을까요?
개선할 점이 있을까요?
```

---

## 🎯 질문 체크리스트

질문하기 전에 다음을 확인하세요:

- [ ] 프로젝트 컨텍스트를 설명했는가?
- [ ] 구체적인 문제를 설명했는가?
- [ ] 관련 코드를 포함했는가?
- [ ] 시도한 방법을 설명했는가?
- [ ] 원하는 결과를 명시했는가?

---

## 🔄 NotebookLM과의 대화 흐름

### 첫 번째 대화: 프로젝트 이해

```
당신: "SemiGuard AI 프로젝트를 설명해 주세요."

NotebookLM: 
"SemiGuard AI는 React + Express 스택의 반도체 모니터링 시스템입니다.
- 소셜 로그인 (Google, Naver, Kakao) 구현됨
- 실시간 데이터 분석 기능
- 사용자별 데이터 격리 필요
- 데이터 공유 기능 미구현"
```

### 두 번째 대화: 문제 해결

```
당신: "로그인 안 된 상태에서 대시보드가 보이는 문제를 해결하려고 합니다."

NotebookLM:
"원인: useAuth() 훅의 loading 상태가 제대로 업데이트되지 않음

해결 방법:
1. 브라우저 콘솔에서 확인
2. 네트워크 탭에서 /api/trpc/auth.me 요청 확인
3. 서버 포트 확인
4. 다음 코드로 수정..."
```

### 세 번째 대화: 다음 단계

```
당신: "이제 데이터 격리를 구현하려고 합니다. 어떻게 해야 할까요?"

NotebookLM:
"다음 단계로 진행하세요:
1. 모든 쿼리를 protectedProcedure로 변환
2. WHERE 절에 userId 필터 추가
3. 테스트 작성
4. 배포 전 검증"
```

---

## 📚 추가 리소스

### NotebookLM 공식 문서
- https://support.google.com/notebooklm

### SemiGuard AI 문서
- NOTEBOOKLM_GUIDE.pdf - 전체 가이드
- NOTEBOOKLM_QUESTIONS.pdf - 질문 템플릿
- GitHub 저장소 - 최신 코드

### 유용한 팁

1. **정기적으로 업데이트**
   - 새로운 파일을 작성하면 NotebookLM에 업로드
   - 진행 상황을 문서에 기록

2. **대화 기록 저장**
   - NotebookLM의 좋은 답변은 저장
   - 나중에 참고할 수 있도록

3. **여러 Notebook 활용**
   - 프로젝트별 Notebook 생성
   - 주제별 Notebook 분리

---

## ⚡ 빠른 질문 모음

### 상황별 즉시 사용 가능한 질문

**상황 1: 버그 발생**
```
[버그 설명]이 발생했습니다.
에러 메시지: [에러 메시지]
어떻게 해결할 수 있을까요?
```

**상황 2: 기능 구현**
```
[기능 설명]을 구현하려고 합니다.
요구사항: [요구사항 나열]
어떻게 구현할 수 있을까요?
```

**상황 3: 코드 리뷰**
```
다음 코드를 리뷰해 주세요:
[코드]
문제점이 있을까요?
```

**상황 4: 성능 최적화**
```
이 부분의 성능을 개선하고 싶습니다:
[코드]
어떻게 최적화할 수 있을까요?
```

---

## 🎓 학습 팁

### NotebookLM을 최대한 활용하기

1. **구체적으로 질문하기**
   - "버그가 있어요" ❌
   - "로그인 안 된 상태에서 대시보드가 보여요" ✅

2. **컨텍스트 제공하기**
   - 프로젝트 설명
   - 기술 스택
   - 현재 상황

3. **단계별로 진행하기**
   - 이해 → 문제 파악 → 해결 → 다음 단계

4. **피드백 반영하기**
   - NotebookLM의 조언을 코드에 적용
   - 결과를 다시 보고
   - 필요시 추가 질문

---

## 🚀 지금 바로 시작하기

### 1단계: 파일 다운로드
```bash
# 프로젝트 폴더에서
ls -la NOTEBOOKLM_*.pdf
```

### 2단계: NotebookLM 접속
```
https://notebooklm.google.com
```

### 3단계: 파일 업로드
- NOTEBOOKLM_GUIDE.pdf
- NOTEBOOKLM_QUESTIONS.pdf

### 4단계: 첫 질문하기
```
"SemiGuard AI 프로젝트의 현재 상황을 요약해 주세요."
```

---

## 💬 예상 대화

### 당신의 첫 질문
```
"SemiGuard AI는 React + Express 스택의 반도체 모니터링 시스템입니다.
소셜 로그인이 완료되었는데, 로그인 안 된 상태에서도 대시보드가 보이는 
문제가 있습니다. 이 문제를 어떻게 해결할 수 있을까요?"
```

### NotebookLM의 응답
```
"이 문제는 useAuth() 훅의 loading 상태가 제대로 작동하지 않기 때문입니다.

해결 방법:
1. 브라우저 콘솔에서 확인:
   const auth = useAuth();
   console.log(auth.loading, auth.user);

2. 네트워크 탭에서 /api/trpc/auth.me 요청 확인

3. 만약 요청이 pending이면:
   - 서버가 포트 3000에서 실행 중인지 확인
   - CORS 설정 확인

4. 다음 코드로 수정:
   [수정된 코드]"
```

---

## 📞 도움이 필요하면

1. **NotebookLM 도움말**: https://support.google.com/notebooklm
2. **GitHub Issues**: 프로젝트 저장소에서 문제 보고
3. **이 가이드**: NOTEBOOKLM_GUIDE.pdf 참고

---

**작성일**: 2026년 8월 6일
**버전**: 1.0
**목적**: NotebookLM으로 SemiGuard AI 프로젝트 계속 진행하기
