# 검증 기록 · 2026-11-09

상태: **명시한 가상 계산 계약 기준 P0 구현·공개 URL 검증 완료**. 기관 급여 코드북·보고서 원 엔진 검증과 구별한다. 공개 주소: http://158.247.203.92/ · 배포 p0-3afdfd6 · 가정 scenario-2026-11-09-v1.

## 실행한 검증

- Python3.12 / FastAPI API·계산 시험:72개 통과. 실제 TestClient 실행. Starlette의 httpx 사용 deprecation 경고1건(실패 아님).
- Node26 로컬 / Node22 Docker 빌드. 저장소·금액 변환6시험 통과, TypeScript와 Vite 본번들 빌드 통과.
- npm audit 및 Python requirements.lock pip-audit: 알려진 취약점0건. transitive 의존성도 lock에 고정.
- Docker Compose에서 backend health, nginx 정적 화면과 /api 경로 확인. 서버 DB·계정·지속 데이터 볼륨 없음.
- Terraform1.15.8 / Vultr provider2.33.2: init·fmt·validate·mock plan1시험 통과.
- 실제 저장 plan:5추가/0변경/0삭제(새 서울2GB 인스턴스·SSH키·방화벽그룹·HTTP/단일IP SSH 규칙). 기존 서버 변경 없음. plan/state는 저장소 밖에 보관.
- Vultr 공개 플랜API:vc2-1c-2gb,1vCPU/2GB/55GB/2048GB 포함, 월$10/시간$0.014. 백업·DDoS 옵션off. 세금·초과전송·LLM 호출비 별도.

## 실제 Chrome 검증

- 기준 사례: 보고서 고정값과 가정 기반 직접 계산, 두 세대 그래프·연도표·기관/상품 미확인 근거 표시.
- F06 생활비185만 미리보기 후 적용. 적용 전 계산 결과 유지 확인.
- B′ 선택 후 새로고침:185만과 B′ 복원 확인. 초기화 후180만/B 기준 복귀와 삭제 안내 확인.
- 재취업 실패:부모 최저-1.41억, 첫 음수2035년, 재원 재검토 표시 확인.
- F07 실제 Upstage 호출로 생활비220만 제안. 확인 전180만 계산 유지, 확인 후220만 재계산(필요3.42억, 자녀부족1.97억) 확인.
- 수익률-0.5% 최초 응답은-0.5로 잘못 반환됐으나 서버 범위 검증이 적용을 거부. JSON 스키마 범위·단위 예시 보강 후 실제 응답-0.005로 성공 확인. 잘못된 LLM 결과를 숫자 계산으로 전달하지 않음.

## 계산 증거 파일

- `calculation-cases.json`: 기준과 생활비185/220만, 유족연금0, 재취업0, 수익률0/-0.5%, 종료83세의 B/B′ 요약.
- `baseline-b-child_timeline.csv`, `baseline-b-parent_timeline.csv`, `baseline-b_prime-child_timeline.csv`, `baseline-b_prime-parent_timeline.csv`: 전체 연도별 원 단위 계산.
- `local-api.json`: 실제 localhost Nginx API 대조 스크립트 실행 결과. 브라우저 localStorage 파일이 아니며 비밀값/자연어 원문을 포함하지 않음.
- `local-calculated.jpg`: 가상 계산 화면. 공개 배포 증거와 구별.

## 배포 과정에서 해결한 항목

- Vultr API의 IP 미허용 401을 확인한 뒤 사용자 승인으로 현재 컴퓨터의 /32만 추가했다. 인증 200을 확인했다. API 키는 저장소 밖에만 존재한다.
- 실제 인스턴스 생성과 앱 배포를 마쳤다. Terraform 결과는 5개 추가, 기존 자원 변경·삭제 0개다.

## 완료 범위 밖의 후속 확인

- 보고서 원 엔진·원 입력표의 독립 재현과 기관 급여 코드북 검증은 미완료다. 현재 시험은 사용자가 판단을 위임한 가상 계약에 한정한다.
- 기관·상품 확인, 부모 현금흐름 가정의 팀 보강, 보고서 원본 부록 수정은 todo에 남아 있다. 이 항목을 실제 수급 판정이나 실상품 실행 검증 완료로 표현하지 않는다.


## 최종 공개 URL 실행 증거

- `public-api.json`: 공개 Nginx→FastAPI→실제 Upstage 경로 대조 스크립트 통과. health의release는p0-3afdfd6.
- Chrome에서 F06 생활비185만 미리보기 시1.74억 결과 유지, 적용 시1.96억으로 변경. B′ 선택 시56세1.75억·부족2,694만 원 표시.
- 새로고침 후185만·B′ 복원(입력값185, aria-pressed true) 확인. 초기화→새로고침 후180만·B 복귀 확인.
- F07 실제185만 변경 제안을 받은 뒤 확인 전180만 유지, 확인 후185만/필요1.96억으로 재계산 확인.
- 재취업 실패 사건의 부모 최저-1.41억·첫 음수2035년 확인.
- 자녀 연도표의2071/65세 전환 행:연초115,362,950원, 인출4,563,600원, 급여4,196,400원, 수익1,107,994원, 연말111,907,344원, 부족0원.
- 모호한 자연어 입력은 지원 형식 오류로 표시. 생활비1,000만·유족연금0의 필요 잔액은 ‘계산 미지원 · 월 인출 한도’로 표시. 음수 생활비 입력은 브라우저에서‘값은0 이상이어야 합니다’로 거부.
- `public-errors.json`:4KB 초과413 JSON, 제안 요청 과다429 JSON, 그 후 수동 계산200 확인. 이 시험은 잘못된 본문만 보내므로 외부 LLM 호출을 추가하지 않음.
- 기준/변경 그래프, A/D 변경 상태 비활성, 보고서 고정값·기관/상품 미확인 근거 확인.
- `public-calculated.jpg`, `public-f07-proposal.jpg`, `public-unsupported.jpg`:공개 화면 증거. 마지막 공개 탭은 기준 사례로 초기화해 둠.
- 최초 기존 탭의navigation은ERR_BLOCKED_BY_CLIENT로 실패했으나 같은 Chrome 새 탭에서공개URL 전체흐름을 검증했다. URL 접근 불가로 남아 있지 않음.
- API key/state/private SSH key는 저장소 밖. 서버 앱env 권한600, 브라우저에는 키 전달 없음. 최초SSH 호스트키는TOFU로 고정했으며 이후strict검증 사용.
