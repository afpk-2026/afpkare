# no-named

## 개요
- 제1회 전국 대학생 AI 재무설계 콘테스트 「AFPK 영 플래너 챌린지 2026」 제출작 레포이다.

## 파일구조
- AGENTS.md: 에이전트가 개발시 준수해야하는 대원칙
- .agents/docs/*: 에이전트가 개발시 참고하는 문서 규칙
- frontend: 프론트 코드
- backend: 백엔드 코드
- infra: 인프라 코드

## 실행

Python3.12와 Node22 이상, uv 또는 pip를 사용한다.

```bash
uv venv backend/.venv --python 3.12
uv pip install --python backend/.venv/bin/python -r backend/requirements-dev.txt
npm ci --prefix frontend
# 생성한 해시 행을 로컬 .env에 추가
PYTHONPATH=backend backend/.venv/bin/python -m app.auth
backend/.venv/bin/python scripts/run_api.py
# 다른 터미널
npm run dev --prefix frontend
```

개발 화면은 `http://127.0.0.1:5173/`, API는 8000 포트다. 시뮬레이터는 비로그인으로 실행되며 개인 계정 로그인은 헤더에서 선택한다. 로컬 실행기는 루프백에서 개발용 HTTP 로그인을 허용하며 운영 로그인에는 HTTPS가 필요하다. `.env`의 `UPSTAGE_LLM_API_KEY`를 서버에서만 읽는다. `UPSTAGE_MODEL` 기본값은 `solar-mini4`다. 키가 없어도 수동 계산은 동작한다.

```bash
docker compose up -d --build --wait
# 컨테이너 상태 확인. 운영 로그인에는 HTTPS 구성이 필요하다.
backend/.venv/bin/python -m pytest -q
npm test --prefix frontend
npm run build --prefix frontend
terraform -chdir=infra init -backend=false
terraform -chdir=infra validate
terraform -chdir=infra test
```

## 계산의 의미

가상 사례의 B/B′를 가정 기반으로 직접 계산한다. 보고서 화면은 v1.5 기준값으로 열리며 현재 가정 및 저장 슬롯 보기에서 83세·95세·선택 종료 나이 비용(생활비 부족액 × 3 + 무신탁 대비 급여 감소분)을 확인할 수 있다. 보고서 고정값과 기관 해석 미확인 내용을 화면에서 구별한다. 상세 계산 계약은 `.agents/docs/arithmetic.md` 6절과 `backend/app/assumptions.json`, 남은 보강은 `.agents/docs/todo.md`를 참고한다. 회원가입은 아이디와 비밀번호를 받으며 비밀번호는 계정별 salt를 사용한 scrypt 해시로 저장한다. 적용 입력과 전략, 사례 슬롯, 접근성 설정은 브라우저에 보관한다. 계정과 세션은 SQLite에 저장한다. 세션은 8시간 뒤 만료되고 로그아웃 시 폐기되며 서버 재시작 후에도 유지된다. 사례 슬롯은 브라우저 저장소를 사용하므로 같은 브라우저의 다른 계정에서도 공유된다.

## Vultr 배포

단일 Seoul `vc2-1c-2gb`(1vCPU/2GB/55GB) 플랜. 2026-11-09 Vultr 공개 API 기준 월10달러, 시간당0.014달러, 포함 전송량2048GB. 초과 트래픽·세금·Upstage 호출 비용은 별도다. 백업·DDoS 추가 옵션은 켜지 않는다. 기존 서버를 재사용하거나 수정하지 않는다.

```bash
python3 scripts/infra.py plan ~/.config/no-named/vultr.env
# 계획: 새 인스턴스/SSH키/방화벽그룹/방화벽규칙2개, 변경/삭제0 확인
python3 scripts/infra.py apply ~/.config/no-named/vultr.env
```

Vultr 키는 파일에서 읽어 프로세스 환경으로만 전달한다. Terraform state/plan 및 SSH 비밀키는 `~/.local/state/no-named/`, API 키는 저장소 밖 권한600 파일에 둔다. state에는 서버 기본 비밀번호 등 민감 값이 들어가므로 공유하지 않는다.

서버 최초 SSH 호스트키는 생성된 서버 IP에 TOFU(`StrictHostKeyChecking=accept-new`)로 등록하고 이후에는 strict 검증으로 변경된 키를 거부한다. 최초 지문은 별도로 보관한다. 콘솔과의 독립 지문 대조는 운영 후속 확인 사항이다. 앱 전용 env에 Upstage 설정과 데모 비밀번호 해시를 둔다. Vultr 키는 별도 파일로 관리한다.

```bash
scripts/deploy.sh SERVER_IPV4 ~/.local/state/no-named/deploy_ed25519 ~/.config/no-named/app.env RELEASE_ID
```

소스는 허용한 frontend/backend/compose만 압축하며 `.env`·Git·state·로컬 의존성은 제외한다. env는 별도로 전송해600 권한으로 둔다. `/opt/family-finance/releases/RELEASE_ID`에서 빌드·기동·health 확인 후 current 링크를 갱신한다. 롤백은 이전 release 디렉터리에서 `docker compose up -d --wait --no-build`를 실행한 뒤 health와 화면을 확인하고 current를 해당 디렉터리로 바꾼다. 컨테이너/이미지는 동일 compose 프로젝트를 사용하므로 릴리스 태그별 이미지를 보관해야 한다(배포 스크립트 참조).

배포 성공만으로 P0 완료를 선언하지 않는다. 공개 URL에서 F06/F07·재계산·두 그래프·근거·새로고침 복원·초기화·오류/미지원 상태를 다시 확인하고 `.agents/verification/`에 기록한다.


## 공개 시연 및 검증 상태

공개 URL: http://158.247.203.92/ · 앱0.2.0 · 릴리스p0-3afdfd6.

명시한 가상 계산 계약 기준 P0 흐름을 공개 Chrome과 API에서 검증했다. 기록은 `.agents/verification/checks.md`와 `deployment.json`을 참고한다. 기관 급여 규칙·상품·보고서 원 엔진은 검증 완료로 보지 않으며 `.agents/docs/todo.md`에서 보강한다.


## P1 공개 배포 · 2026-11-09

최신 URL: https://158.247.203.92/ · 앱0.3.0 · p1-cbe8301. 민감도 분석(F08), 최대3개 사례 비교(F09), 근거 JSON/CSV/독립 HTML 보고서(F10)를 구현하고 공개 Chrome/API/실제 파일로 검증했다. 프론트19시험·기존 계산72시험·Terraform mock1시험 통과. 증거는 `.agents/verification/p1/checks.md`, HTTPS 운영은 `.agents/docs/https.md`.

이번 공개 배포는 사용자 선택대로 기존 `scenario-2026-11-09-v1` 가상 계약을 유지한다. 별도 로컬 보고서 재현 엔진 변경은 포함하지 않았다. 계산 결과/비교 카드/분석/자연어는 localStorage에 저장하지 않는다. HTTP와 HTTPS의 적용 설정은 서로 독립적이다. 인증서는 무료이며 기존 서버 월$10는 동일하다.


## main 자동 배포

사용자 승인으로 현재 코드와 보고서 재현 엔진을 원격 main에 직접 반영한다. 이후 main push는 GitHub Actions 시험(백엔드76개·프론트19개·빌드·Terraform 검증) 통과 후 기존 Vultr 서버에 자동 배포된다. `.github/workflows/checks.yml`과 `.agents/docs/cicd.md` 참조. 업스테이지 키는 서버에만 유지하며 SSH 공개 범위를 추가로 열지 않는다. 공개 health의 release는 `main-커밋앞12자리`로 확인한다. 앞선 P0/P1의 수치·계약·배포 기록은 당시 버전의 이력이다.


## 개인 계정 로그인

헤더의 로그인 → 계정 만들기에서 가입한다. 아이디는 영문·숫자로 시작하는 3~32자이며 점·밑줄·하이픈을 허용하고 대소문자를 구분하지 않는다. 비밀번호는 12~128자다. 기존 공용 데모 비밀번호는 개인 계정으로 자동 전환되지 않는다.

로컬 계정 DB는 기본적으로 `~/.local/share/care-partners/accounts.sqlite3`에 생성된다. `CARE_AUTH_DB`로 경로를 지정할 수 있다. Docker는 `accounts` named volume의 `/var/lib/care-partners/accounts.sqlite3`를 사용한다. 배포와 컨테이너 재생성 시 이 볼륨을 보존한다. 계정 DB를 삭제하거나 `docker compose down -v`를 실행하면 계정과 세션이 삭제된다.

운영자가 계정을 생성할 때는 컨테이너에서 `python -m app.auth`를 실행해 아이디·비밀번호를 입력할 수 있다. 로그인 공개 점검에는 `CARE_SMOKE_USERNAME`과 `CARE_SMOKE_PASSWORD`를 함께 전달한다. 기본 CI 공개 점검은 비로그인 계산을 확인한다. 회원가입과 로그인에는 HTTPS가 필요하며 로컬 실행기는 루프백 HTTP를 허용한다.


신탁 자료의 기본 검색은 브라우저에서 키워드를 대조한다. 사용자가 AI 의미 검색을 선택하면 Upstage Solar Embedding 2로 검토된 은행 상품 자료 및 보고서 용어의 요약을 검색한다. Solar가 검색 후보 안에서 출처를 선택하고 화면은 등록된 요약과 원문 링크를 표시한다. 임베딩이 실패하면 Solar가 검토된 전체 자료에서 출처를 고른다. 외부 검색을 사용할 수 없으면 키워드 검색 결과를 사용한다.
