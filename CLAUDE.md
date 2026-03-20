# HOBIS v6 — 프로젝트 지침

## 프로젝트 개요
방사선 방호 계산기(HOBIS v5)를 프로젝트/일정 관리 SaaS로 확장하는 v6 프로젝트.
Vanilla JS SPA, 빌드 도구 없음, 사이버펑크 UI 테마.

## 기술 스택
- **프론트엔드**: Vanilla JS (ES6), no framework, no build tools
- **데이터 저장**: IndexedDB (`hobis_v6_db`, 50MB+), localStorage 폴백
- **차트**: Chart.js
- **지도**: Leaflet
- **UI 테마**: 사이버펑크 (CSS 변수: `--hobis-green`, `--hobis-cyan`, `--hobis-bg` 등)
- **폰트**: Orbitron (제목), Share Tech Mono (본문)

## 파일 구조
```
index.html          — SPA 메인 페이지
css/hobis.css       — 모든 스타일
js/
  store.js          — IndexedDB 데이터 레이어 (비동기 Promise)
  projects.js       — 프로젝트 관리 UI
  event-form.js     — 일정 생성/수정 모달 (참석자 칩 UI)
  events.js         — 캘린더 + 검색 + 상세 + 댓글 CRUD
  import-export.js  — JSON 내보내기/임포트
  core.js           — 탭 관리 + 비동기 초기화
  ri-order.js       — RI 구매요청 집계
  calculator.js     — 방사선 계산 엔진 (decay/shield)
  calc-ui.js        — 계산기 UI
  chart.js          — Chart.js 래퍼
  utils.js          — 유틸리티
  log.js            — 미션 로그
  logistics.js      — 물류 모듈
hobis_db.js         — 핵종 데이터베이스
```

## 핵심 패턴

### 데이터 레이어 (store.js)
- `storeLoad()` → **Promise 반환** (비동기). `core.js`에서 `.then()` 체인 사용
- `storeSave()` → fire-and-forget IndexedDB 쓰기
- 인메모리 캐시 `_storeData` — 모든 읽기는 메모리, 쓰기는 비동기 IndexedDB
- UUID 기반 ID: `generateId('ev_')`, `generateId('pj_')`, `generateId('cm_')`
- Flow JSON 임포트 시 `flowId` + `title|start` 복합키 dedup

### 캘린더 (events.js)
- 월간/주간/일간 3개 뷰 (`fcCalView = 'month' | 'week' | 'day'`)
- `fcRenderCalendar()` → 뷰에 따라 dispatch
- +N MORE 클릭 → 오버레이 팝업 (검색탭 전환 아님)
- 댓글 CRUD: `fcShowCommentForm`, `fcSaveComment`, `fcDeleteComment`

### CSS 변수
```css
--hobis-green: #00ff33;   --hobis-cyan: #00f7ff;
--hobis-bg: #0a0a0c;      --hobis-panel: #111418;
--hobis-border: #2a3b47;   --hobis-alert: #ff3300;
--hobis-warn: #ffcc00;
```

## 완료된 작업 (Sprint 1~2)
- 일정 CRUD, 프로젝트 관리, 컬러 피커
- IndexedDB 마이그레이션 (localStorage → 50MB+)
- Flow JSON 임포트 (중복방지 dedup)
- 댓글 CRUD, 참석자 칩 UI
- 월간/주간/일간 캘린더 뷰
- 캘린더 +N 오버레이, 기본 서브탭 캘린더
- 감마상수 단위 표시 수정, 차폐 그래프 수정
- v6 형식 임포트 IndexedDB 호환
- RI-ORDER 구매요청 집계 모듈

## 코딩 규칙
- 한국어 UI 텍스트 사용
- 모든 문서는 `YYYYMMDD_HHmmss_제목.확장자` 형식
- `var` 대신 `let`/`const` 사용
- HTML 이스케이프: `fcEsc()` 함수 사용
- 프로젝트 컬러: 8색 자동 순환 (`_AUTO_COLORS`)

## 로컬 실행
```bash
npx http-server . -p 8080 -c-1
# 브라우저에서 http://localhost:8080
```
