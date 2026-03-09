# HOBIS v6 - 프로젝트 기획서

## Project & Schedule Management System

> Flow 마이그레이션을 넘어, 더 나은 프로젝트 일정 관리 시스템으로

---

## 1. 프로젝트 개요

### 1.1 배경
HOBIS v5에서 Flow(협업 도구)의 캘린더 데이터를 JSON으로 크롤링하여 읽기 전용으로 조회하는 기능을 구현했다. 그러나 Flow의 핵심 기능(일정 생성/수정/삭제, 댓글, 프로젝트 관리)은 아직 구현되지 않았으며, Flow 서비스 자체의 한계를 넘어서는 시스템이 필요하다.

### 1.2 목표
- **단기**: Flow의 핵심 기능을 HOBIS v6에 이식하고, 로컬 JSON/localStorage 기반으로 CRUD 동작 구현
- **중기**: 백엔드(DB + API)를 구축하여 데이터 영속성과 다중 사용자 지원
- **장기**: Google 계정 로그인, 회사별 워크스페이스, 팀 단위 프로젝트 관리가 가능한 SaaS 웹서비스

### 1.3 기존 자산 (hobis-v5에서 계승)
| 구분 | 내용 |
|------|------|
| UI 프레임워크 | 사이버펑크 디자인 시스템 (CSS variables, 패널 구조) |
| 캘린더 뷰 | 월별 그리드, 일별 이벤트 칩, 네비게이션 |
| 검색 시스템 | 다중 필터(제목/본문/프로젝트/작성자/참석자/댓글/위치/날짜/파일/전체), 정렬, 페이지네이션 |
| 이벤트 상세 | 메타데이터, 본문, 참석자 칩, 파일 목록, 댓글 스레드 표시 |
| 반응형 레이아웃 | PC 모달 / 모바일 인라인 디테일, iOS PWA 지원 |
| 기존 모듈 | DECAY, SHIELD, LOGISTICS (방사선 보호 계산기) |

---

## 2. 기능 요구사항

### Phase 1: 로컬 CRUD (프론트엔드 완성)

#### 2.1 프로젝트 관리
- [ ] 프로젝트 생성/수정/삭제
- [ ] 프로젝트별 색상 지정 (기존 FC_PROJ_COLORS 확장)
- [ ] 프로젝트 목록 사이드바 또는 드롭다운
- [ ] 프로젝트 아카이브 (숨기기/보이기)

#### 2.2 일정(이벤트) CRUD
- [ ] 일정 생성 폼 (제목, 날짜/시간, 설명, 위치, 프로젝트 선택)
- [ ] 일정 수정 (인라인 편집 또는 모달)
- [ ] 일정 삭제 (확인 다이얼로그)
- [ ] 일정 복제
- [ ] 반복 일정 (매일/매주/매월/커스텀)
- [ ] 종일 일정 vs 시간 지정 일정
- [ ] 드래그로 날짜 이동 (캘린더 뷰)

#### 2.3 댓글 시스템
- [ ] 이벤트별 댓글 작성/수정/삭제
- [ ] 댓글에 작성자/시간 표시
- [ ] 댓글 내 @멘션 (추후 멀티유저 시)

#### 2.4 참석자 관리
- [ ] 참석자 추가/제거
- [ ] 참석 상태 (참석/불참/미정)
- [ ] 참석자 프로필 (이름, 이메일, 직급)

#### 2.5 파일 첨부
- [ ] 이벤트에 파일 첨부 (로컬: 파일명 참조)
- [ ] 파일 목록 표시 및 다운로드 링크

#### 2.6 데이터 저장
- [ ] localStorage 기반 자동 저장
- [ ] JSON 내보내기/가져오기 (기존 flow_events_web.json 호환)
- [ ] Flow 크롤링 데이터 임포트 호환성 유지

#### 2.7 뷰 모드 확장
- [ ] 월간 캘린더 (기존)
- [ ] 주간 캘린더 (시간대별 타임라인)
- [ ] 일간 뷰 (상세 타임라인)
- [ ] 리스트 뷰 (기존 검색 결과 뷰 확장)
- [ ] 프로젝트별 간트 차트 (선택적)

### Phase 2: 백엔드 구축

#### 2.8 기술 스택 (제안)
| 구분 | 기술 | 이유 |
|------|------|------|
| 런타임 | Node.js + Express 또는 Hono | 프론트엔드와 동일 언어, 빠른 개발 |
| DB | PostgreSQL + Prisma ORM | 관계형 데이터에 적합, 타입 안전성 |
| 인증 | Google OAuth 2.0 (Firebase Auth 또는 직접) | 구글 계정 로그인 요구사항 |
| 배포 | Vercel / Railway / Fly.io | 무료 티어 활용, 간편한 배포 |

#### 2.9 데이터 모델

```
Workspace (회사/팀)
+-- id, name, slug, created_at
+-- members[] -> User (role: owner/admin/member)
|
+-- Project
|   +-- id, name, color, archived, created_at
|   |
|   +-- Event
|       +-- id, title, description, location
|       +-- start, end, all_day, recurrence_rule
|       +-- project_id -> Project
|       +-- author_id -> User
|       +-- created_at, updated_at
|       |
|       +-- Attendee[]
|       |   +-- user_id -> User
|       |   +-- status (accepted/declined/pending)
|       |
|       +-- Comment[]
|       |   +-- id, content, author_id -> User
|       |   +-- created_at, updated_at
|       |
|       +-- Attachment[]
|           +-- id, filename, url, size
|           +-- uploaded_by -> User
|
+-- User
    +-- id, email, name, avatar_url
    +-- google_id (OAuth 연동)
    +-- position (직급)
```

#### 2.10 API 엔드포인트 (RESTful)

```
인증
POST   /auth/google          Google OAuth 로그인
GET    /auth/me               현재 사용자 정보

워크스페이스
GET    /workspaces            내 워크스페이스 목록
POST   /workspaces            워크스페이스 생성
PATCH  /workspaces/:id        워크스페이스 수정
POST   /workspaces/:id/invite 멤버 초대

프로젝트
GET    /workspaces/:wid/projects
POST   /workspaces/:wid/projects
PATCH  /projects/:id
DELETE /projects/:id

이벤트
GET    /projects/:pid/events?start=&end=
POST   /projects/:pid/events
PATCH  /events/:id
DELETE /events/:id

댓글
GET    /events/:eid/comments
POST   /events/:eid/comments
PATCH  /comments/:id
DELETE /comments/:id

참석자
POST   /events/:eid/attendees
PATCH  /attendees/:id         상태 변경
DELETE /attendees/:id

첨부파일
POST   /events/:eid/attachments  (multipart upload)
DELETE /attachments/:id
```

### Phase 3: SaaS 웹서비스

#### 2.11 멀티테넌시
- [ ] 회사별 워크스페이스 분리
- [ ] 워크스페이스 초대/가입 시스템
- [ ] 역할 기반 권한 (소유자/관리자/멤버)

#### 2.12 실시간 협업
- [ ] WebSocket 기반 실시간 업데이트 (이벤트 변경, 새 댓글)
- [ ] 온라인 상태 표시
- [ ] 알림 시스템 (인앱 + 이메일)

#### 2.13 고급 기능
- [ ] 캘린더 공유/구독 (iCal 형식)
- [ ] Google Calendar 연동 (양방향 동기화)
- [ ] 대시보드 (오늘의 일정, 마감 임박 등)
- [ ] 검색 히스토리 및 저장된 필터
- [ ] 모바일 앱 (PWA 고도화 또는 React Native)

---

## 3. 기술 마이그레이션 전략

### 3.1 프론트엔드 현대화 로드맵

현재 바닐라 JS + 단일 HTML 구조에서 단계적으로 전환:

```
Stage 0 (현재)     : Vanilla JS + index.html (monolithic)
  |
Stage 1 (Phase 1)  : Vanilla JS 모듈화 + localStorage CRUD
                     기존 UI 구조 유지, flow-calendar.js를 CRUD 지원으로 확장
  |
Stage 2 (Phase 2)  : Vite + Vanilla JS 또는 경량 프레임워크(Lit/Preact)
                     빌드 도구 도입, API 연동, 컴포넌트 분리
  |
Stage 3 (Phase 3)  : React/Vue/Svelte (선택) + TypeScript
                     본격적 SPA, 라우팅, 상태관리
```

### 3.2 데이터 마이그레이션
1. 기존 flow_events_web.json -> hobis-v6 로컬 포맷으로 변환
2. 로컬 데이터 -> DB 마이그레이션 스크립트
3. 기존 HOBIS 기능(DECAY/SHIELD/LOGISTICS)은 별도 모듈로 보존

---

## 4. UI/UX 방향

### 4.1 디자인 원칙
- **사이버펑크 아이덴티티 유지**: 기존 HOBIS 디자인 시스템 계승
- **기능성 우선**: Flow 대비 더 빠른 검색, 더 직관적인 일정 관리
- **점진적 복잡도**: 기본 기능은 심플하게, 고급 기능은 점차 노출

### 4.2 주요 UI 변경점
| 영역 | v5 (현재) | v6 (목표) |
|------|-----------|-----------|
| 일정 생성 | 없음 (읽기 전용) | 캘린더 날짜 클릭 -> 생성 모달 |
| 일정 수정 | 없음 | 디테일 뷰에서 직접 편집 |
| 댓글 | 읽기 전용 | 작성/수정/삭제 가능 |
| 프로젝트 | JSON에서 자동 추출 | 직접 생성/관리 |
| 캘린더 뷰 | 월간만 | 월/주/일 전환 |
| 데이터 | JSON 파일 로드 | 자동 저장 + 클라우드 동기화 |

---

## 5. 개발 로드맵

### Milestone 1: CRUD 기반 완성 (Phase 1)
```
Sprint 1 (1~2주): 프로젝트 & 이벤트 CRUD
  - 프로젝트 생성/관리 UI
  - 이벤트 생성 모달 (캘린더 날짜 클릭)
  - 이벤트 수정/삭제
  - localStorage 자동 저장

Sprint 2 (1~2주): 댓글 & 참석자 & 뷰
  - 댓글 CRUD
  - 참석자 관리
  - 주간/일간 캘린더 뷰
  - JSON 가져오기/내보내기 (Flow 호환)
```

### Milestone 2: 백엔드 연동 (Phase 2)
```
Sprint 3 (2주): 서버 & DB 세팅
  - Node.js API 서버
  - PostgreSQL + Prisma 스키마
  - 기본 CRUD API

Sprint 4 (2주): 인증 & 연동
  - Google OAuth 로그인
  - 프론트엔드 <-> API 연결
  - 데이터 마이그레이션 (로컬 -> DB)
```

### Milestone 3: SaaS 기능 (Phase 3)
```
Sprint 5~6 (3~4주):
  - 워크스페이스 & 멀티테넌시
  - 멤버 초대/권한 관리
  - 실시간 업데이트 (WebSocket)
  - 알림 시스템
  - 배포 & 운영
```

---

## 6. Flow 대비 개선 포인트

| 항목 | Flow | HOBIS v6 |
|------|------|----------|
| 검색 | 기본 텍스트 검색 | 다중 필드 필터 + 정렬 + 페이지네이션 (이미 구현) |
| UI/UX | 일반적 비즈니스 UI | 사이버펑크 디자인 (차별화) |
| 속도 | 서버 의존 | 로컬 우선 -> 빠른 반응 |
| 커스터마이즈 | 제한적 | 완전한 소유권, 자유로운 확장 |
| 오프라인 | 미지원 | PWA 오프라인 지원 가능 |
| 데이터 소유 | Flow 서버 | 내 서버, 내 데이터 |
| 기존 도구 연동 | 불가 | HOBIS DECAY/SHIELD/LOGISTICS 통합 |

---

## 7. 파일 구조 (Phase 1 목표)

```
hobis-v6/
+-- index.html              <- 메인 SPA
+-- css/
|   +-- hobis.css           <- 통합 스타일 (기존 + v6 확장)
+-- js/
|   +-- core.js             <- 탭 전환, 공통 유틸
|   +-- store.js            <- [NEW] 데이터 저장소 (localStorage 래퍼)
|   +-- projects.js         <- [NEW] 프로젝트 CRUD
|   +-- events.js           <- [NEW] 이벤트 CRUD (flow-calendar.js 리팩토링)
|   +-- comments.js         <- [NEW] 댓글 CRUD
|   +-- calendar-views.js   <- [NEW] 월/주/일 캘린더 렌더링
|   +-- event-form.js       <- [NEW] 이벤트 생성/수정 폼
|   +-- import-export.js    <- [NEW] JSON 가져오기/내보내기
|   +-- calculator.js       <- 기존 방사선 계산
|   +-- calc-ui.js          <- 기존 계산 UI
|   +-- chart.js            <- 기존 차트
|   +-- logistics.js        <- 기존 물류
|   +-- log.js              <- 기존 미션 로그
|   +-- utils.js            <- 기존 유틸리티
+-- hobis_db.js             <- 기존 방사선 데이터
+-- PLAN.md                 <- 이 기획서
```

---

## 8. 성공 지표

### Phase 1 완료 기준
- [ ] 프로젝트 생성 후 일정을 만들고 저장하면 새로고침 후에도 유지
- [ ] 기존 Flow JSON 데이터를 임포트하면 모든 이벤트가 정상 표시
- [ ] 일정에 댓글을 달고 수정/삭제 가능
- [ ] 월간/주간 캘린더 뷰 전환 동작
- [ ] 기존 HOBIS 기능(DECAY/SHIELD/LOGISTICS)이 깨지지 않음

### Phase 2 완료 기준
- [ ] Google 계정으로 로그인 가능
- [ ] 서버에 데이터 저장/조회 정상 동작
- [ ] 여러 기기에서 동일 데이터 접근 가능

### Phase 3 완료 기준
- [ ] 회사별 워크스페이스 분리 동작
- [ ] 팀원 초대 후 동일 프로젝트 일정 공유
- [ ] 실시간 업데이트 (한 명이 수정하면 다른 사람에게 반영)

---

*작성일: 2026-03-09*
*레포지토리: https://github.com/jyc0289y-art/hobis-v6*
