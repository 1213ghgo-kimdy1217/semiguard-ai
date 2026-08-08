# NotebookLM 질문 템플릿 - SemiGuard AI

## 📖 이 문서의 목적

NotebookLM에 효과적으로 질문하기 위한 템플릿과 예제를 제공합니다.
각 상황별로 복사해서 사용하면 됩니다.

---

## 🎯 상황별 질문 템플릿

### 템플릿 1️⃣: 버그 해결 요청

**상황**: 코드에 버그가 있거나 예상과 다르게 작동할 때

**템플릿**:
```
SemiGuard AI 프로젝트에서 다음 문제가 발생했습니다.

【문제 설명】
- 증상: [구체적으로 무엇이 잘못되었는가?]
- 예상: [원래 어떻게 작동해야 하는가?]
- 실제: [실제로 어떻게 작동하는가?]

【관련 코드】
[코드 붙여넣기]

【시도한 것】
1. [시도한 방법 1]
2. [시도한 방법 2]

【원하는 결과】
[어떻게 해결되어야 하는가?]

【질문】
이 문제를 어떻게 해결할 수 있을까요?
단계별로 설명해 주세요.
```

**예제**:
```
SemiGuard AI 프로젝트에서 다음 문제가 발생했습니다.

【문제 설명】
- 증상: 로그인 안 된 상태에서도 대시보드가 보임
- 예상: 로그인 페이지로 리다이렉트되어야 함
- 실제: 대시보드가 바로 표시됨

【관련 코드】
// App.tsx의 ProtectedRoute 컴포넌트
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!loading && !user) {
      setLocation("/login");
    }
  }, [user, loading, setLocation]);

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}

【시도한 것】
1. useAuth() 훅의 loading 상태 확인
2. 브라우저 콘솔에서 user 값 확인
3. 쿠키 삭제 후 재로그인 시도

【원하는 결과】
로그인 안 된 사용자는 자동으로 /login으로 리다이렉트되어야 합니다.

【질문】
useAuth()의 loading 상태가 제대로 작동하지 않는 이유가 뭘까요?
어떻게 해결할 수 있을까요?
```

---

### 템플릿 2️⃣: 기능 구현 요청

**상황**: 새로운 기능을 구현하고 싶을 때

**템플릿**:
```
SemiGuard AI에 다음 기능을 구현하고 싶습니다.

【기능 요구사항】
- 목표: [무엇을 구현할 것인가?]
- 사용자: [누가 사용할 것인가?]
- 이점: [왜 필요한가?]

【기술 스택】
- 프론트엔드: React 19, TypeScript
- 백엔드: Express, tRPC
- 데이터베이스: MySQL

【현재 상태】
- 완료된 것: [이미 구현된 관련 기능]
- 필요한 것: [추가로 필요한 것]

【구현 계획】
1. [단계 1]
2. [단계 2]
3. [단계 3]

【질문】
1. 이 구현 계획이 맞을까요?
2. 더 좋은 방법이 있을까요?
3. 주의할 점이 있을까요?
```

**예제**:
```
SemiGuard AI에 다음 기능을 구현하고 싶습니다.

【기능 요구사항】
- 목표: 사용자가 다른 사용자와 센서 데이터를 공유
- 사용자: 반도체 장비 관리자들
- 이점: 팀 간 데이터 협업 가능

【기술 스택】
- 프론트엔드: React 19, TypeScript
- 백엔드: Express, tRPC
- 데이터베이스: MySQL

【현재 상태】
- 완료된 것: 사용자 인증, 데이터 격리
- 필요한 것: 데이터 공유 기능

【구현 계획】
1. data_sharing 테이블 생성 (ownerId, sharedWithId, permission)
2. 백엔드 API 구현 (공유하기, 공유 취소, 권한 확인)
3. 프론트엔드 UI 구현 (공유 버튼, 공유 목록)

【질문】
1. 이 구현 계획이 맞을까요?
2. 권한 검증은 어디서 해야 할까요?
3. 성능 최적화 방법이 있을까요?
```

---

### 템플릿 3️⃣: 코드 리뷰 요청

**상황**: 작성한 코드가 맞는지 확인하고 싶을 때

**템플릿**:
```
다음 코드를 리뷰해 주세요.

【코드 목적】
[이 코드가 하는 일]

【코드】
[코드 붙여넣기]

【우려 사항】
1. [우려 사항 1]
2. [우려 사항 2]
3. [우려 사항 3]

【질문】
1. 이 코드에 문제가 있을까요?
2. 개선할 점이 있을까요?
3. 성능 문제는 없을까요?
4. 보안 문제는 없을까요?
```

**예제**:
```
다음 코드를 리뷰해 주세요.

【코드 목적】
로그인 안 된 사용자를 /login으로 리다이렉트하는 컴포넌트

【코드】
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!loading && !user) {
      setLocation("/login");
    }
  }, [user, loading, setLocation]);

  if (loading) {
    return <div className="animate-spin">로딩 중...</div>;
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}

【우려 사항】
1. useEffect 의존성 배열이 맞는가?
2. loading 상태가 제대로 업데이트되는가?
3. 무한 루프가 발생할 수 있는가?

【질문】
1. 이 코드에 문제가 있을까요?
2. useEffect 의존성을 어떻게 설정해야 할까요?
3. 더 좋은 방법이 있을까요?
```

---

### 템플릿 4️⃣: 아키텍처 설계 상담

**상황**: 시스템 설계나 구조에 대해 조언받고 싶을 때

**템플릿**:
```
SemiGuard AI의 다음 부분을 설계하고 싶습니다.

【현재 상황】
[현재 어떻게 구현되어 있는가?]

【요구사항】
1. [요구사항 1]
2. [요구사항 2]
3. [요구사항 3]

【제안 방안】
[당신이 생각하는 설계 방안]

【고려 사항】
- 성능: [성능 요구사항]
- 확장성: [향후 확장 계획]
- 보안: [보안 고려사항]

【질문】
1. 이 설계가 적절할까요?
2. 더 좋은 방법이 있을까요?
3. 주의할 점이 있을까요?
```

**예제**:
```
SemiGuard AI의 데이터 공유 기능을 설계하고 싶습니다.

【현재 상황】
- 각 사용자는 자신의 데이터만 볼 수 있음
- 데이터 격리는 userId 기반으로 구현됨

【요구사항】
1. 사용자 A가 사용자 B와 데이터 공유
2. 읽기/쓰기 권한 구분
3. 공유 취소 기능

【제안 방안】
- data_sharing 테이블 추가
- 권한 검증은 백엔드에서 수행
- 프론트엔드에서 공유 UI 제공

【고려 사항】
- 성능: 1000명 이상의 사용자 지원
- 확장성: 향후 역할 기반 권한 추가
- 보안: 권한 없는 접근 차단

【질문】
1. 이 설계가 적절할까요?
2. 권한 검증은 어디서 해야 할까요?
3. 성능 최적화 방법이 있을까요?
```

---

### 템플릿 5️⃣: 에러 해결 요청

**상황**: 에러 메시지를 받았을 때

**템플릿**:
```
다음 에러가 발생했습니다.

【에러 메시지】
[전체 에러 메시지 복사]

【발생 상황】
- 언제: [언제 발생했는가?]
- 어디서: [어디서 발생했는가?]
- 무엇을 할 때: [무엇을 하다가 발생했는가?]

【관련 코드】
[에러와 관련된 코드]

【시도한 것】
1. [시도한 방법 1]
2. [시도한 방법 2]

【질문】
이 에러의 원인이 뭘까요?
어떻게 해결할 수 있을까요?
```

**예제**:
```
다음 에러가 발생했습니다.

【에러 메시지】
ReferenceError: Dashboard is not defined
  at https://3000-ifsj9osf0s1l6rceuy2v3-4f293e10.sg1.manus.computer/src/pages/Dashboard.tsx?t=1785986637844:4501:26

【발생 상황】
- 언제: 페이지 로드 시
- 어디서: /src/pages/Dashboard.tsx
- 무엇을 할 때: 홈 페이지(/) 접속 시

【관련 코드】
// Dashboard.tsx 끝부분
function DashboardContent() {
  // ... 컴포넌트 코드
}

export default DashboardContent;

【시도한 것】
1. 브라우저 캐시 삭제
2. 개발 서버 재시작
3. 파일 저장 다시 확인

【질문】
이 에러의 원인이 뭘까요?
어떻게 해결할 수 있을까요?
```

---

### 템플릿 6️⃣: 최적화 요청

**상황**: 코드 성능이나 효율성을 개선하고 싶을 때

**템플릿**:
```
다음 코드의 성능을 최적화하고 싶습니다.

【현재 코드】
[코드 붙여넣기]

【성능 문제】
- [성능 문제 1]
- [성능 문제 2]

【제약 조건】
- [제약 조건 1]
- [제약 조건 2]

【질문】
1. 이 코드를 어떻게 최적화할 수 있을까요?
2. 더 효율적인 방법이 있을까요?
3. 주의할 점이 있을까요?
```

---

## 💬 실제 사용 예제

### 예제 1: 로그인 문제 해결

**당신의 질문**:
```
SemiGuard AI 프로젝트에서 다음 문제가 발생했습니다.

【문제 설명】
- 증상: 로그인 안 된 상태에서도 대시보드가 보임
- 예상: 로그인 페이지로 리다이렉트되어야 함
- 실제: 대시보드가 바로 표시됨

【관련 코드】
// App.tsx
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!loading && !user) {
      setLocation("/login");
    }
  }, [user, loading, setLocation]);

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}

【시도한 것】
1. useAuth() 훅의 loading 상태 확인
2. 브라우저 콘솔에서 user 값 확인

【질문】
useAuth()의 loading 상태가 제대로 작동하지 않는 이유가 뭘까요?
```

**NotebookLM의 예상 응답**:
```
문제 분석:
1. useAuth() 훅의 loading 상태가 항상 true일 가능성
2. meQuery.isLoading이 제대로 업데이트되지 않음
3. tRPC 요청이 응답하지 않음

해결 방법:
1. 브라우저 콘솔에서 확인:
   - const auth = useAuth(); console.log(auth.loading, auth.user);
   
2. 네트워크 탭에서 확인:
   - /api/trpc/auth.me 요청이 완료되는지 확인
   
3. 만약 요청이 pending이면:
   - 서버 포트 확인
   - CORS 설정 확인
   - 서버 로그 확인

4. 해결책:
   - 서버가 포트 3000에서 실행 중인지 확인
   - 프론트엔드가 /api/trpc로 요청하는지 확인
```

---

### 예제 2: 기능 구현 상담

**당신의 질문**:
```
SemiGuard AI에 데이터 공유 기능을 구현하고 싶습니다.

【기능 요구사항】
- 사용자 A가 사용자 B와 데이터 공유
- 읽기/쓰기 권한 구분
- 공유 취소 기능

【기술 스택】
- 프론트엔드: React 19
- 백엔드: Express, tRPC
- 데이터베이스: MySQL

【질문】
1. 데이터베이스 스키마는 어떻게 설계할까요?
2. 백엔드 API는 어떻게 구현할까요?
3. 프론트엔드 UI는 어떻게 만들까요?
```

**NotebookLM의 예상 응답**:
```
데이터 공유 기능 구현 가이드:

1. 데이터베이스 스키마:
CREATE TABLE data_sharing (
  id INT PRIMARY KEY AUTO_INCREMENT,
  ownerId INT NOT NULL,
  sharedWithId INT NOT NULL,
  permission VARCHAR(50) DEFAULT 'read',
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ownerId) REFERENCES users(id),
  FOREIGN KEY (sharedWithId) REFERENCES users(id)
);

2. 백엔드 API:
- shareData: 데이터 공유
- revokeShare: 공유 취소
- getSharedData: 공유받은 데이터 조회
- checkPermission: 권한 확인

3. 프론트엔드 UI:
- 공유 버튼
- 공유 목록
- 권한 선택 드롭다운
- 공유 취소 버튼

4. 권한 검증:
- 백엔드에서 data_sharing 테이블 확인
- 권한이 있는 경우만 데이터 반환
```

---

## ✅ 질문 체크리스트

질문하기 전에 다음을 확인하세요:

- [ ] 프로젝트 컨텍스트를 명확히 설명했는가?
- [ ] 구체적인 문제를 설명했는가?
- [ ] 관련 코드를 포함했는가?
- [ ] 시도한 방법을 설명했는가?
- [ ] 원하는 결과를 명시했는가?
- [ ] 질문이 명확한가?

---

## 🎯 효과적인 질문의 특징

### ✅ 좋은 질문
```
"SemiGuard AI는 React + Express 스택의 반도체 모니터링 시스템입니다.
현재 로그인 안 된 사용자가 대시보드에 접근할 수 있는 문제가 있습니다.

ProtectedRoute 컴포넌트를 만들었는데, useAuth()의 loading 상태가 
제대로 작동하지 않습니다. 

어떻게 해결할 수 있을까요?"
```

### ❌ 나쁜 질문
```
"로그인이 안 돼요. 어떻게 해야 해요?"
```

---

## 📝 질문 작성 팁

1. **구체적으로 작성**: "버그가 있어요" ❌ → "로그인 안 된 상태에서 대시보드가 보여요" ✅

2. **코드 포함**: 설명만 하지 말고 실제 코드를 보여주세요

3. **시도한 것 설명**: 이미 시도한 방법을 알려주면 더 빠른 해결 가능

4. **원하는 결과 명시**: "어떻게 되어야 하는가?"를 명확히 하세요

5. **에러 메시지 전체 복사**: 에러 메시지는 완전히 복사하세요

---

## 🚀 다음 단계

1. **이 파일 저장**: NOTEBOOKLM_QUESTIONS.md
2. **PDF로 변환**: 필요시 PDF로 변환
3. **NotebookLM 업로드**: 이 파일을 NotebookLM에 업로드
4. **템플릿 사용**: 질문할 때 적절한 템플릿 사용
5. **피드백 반영**: NotebookLM의 답변을 코드에 적용

---

**작성일**: 2026년 8월 6일
**버전**: 1.0
**목적**: NotebookLM을 효과적으로 활용하기 위한 가이드
